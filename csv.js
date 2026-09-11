/* ============================================================
   The upload template. One row per call sold. Rows that share a
   position_id describe the same lot of shares; a row with no "sold"
   date defines a position that has no calls logged yet.
   ============================================================ */
import { uid, OUTCOMES } from "./engine.js";

export const COLUMNS = [
  "position_id", "ticker", "shares", "cost_basis", "opened",
  "position_status", "exit_price", "closed_date", "exit_reason",
  "sold", "expiry", "contracts", "strike", "credit", "buyback", "fees",
  "stock_at_sale", "stock_at_expiry", "outcome",
];

export const COLUMN_HELP = [
  ["position_id", "Any label that groups rows into one lot of shares, like SOUN-1. Blank falls back to ticker plus opened date."],
  ["ticker", "Symbol as Finnhub knows it. Required."],
  ["shares", "Shares in the lot. Required, whole number."],
  ["cost_basis", "Price paid per share. Required."],
  ["opened", "Date the shares were bought, YYYY-MM-DD or M/D/YYYY. Required."],
  ["position_status", "open or closed. Blank means open."],
  ["exit_price", "Per-share price the lot was sold or called away at. Required when closed."],
  ["closed_date", "Date the lot left the account. Required when closed."],
  ["exit_reason", "sold or assigned. Blank means sold."],
  ["sold", "Date the call was sold. Leave the rest of the row blank to log a position with no calls."],
  ["expiry", "Expiration date of the call."],
  ["contracts", "Number of contracts, whole number."],
  ["strike", "Strike price."],
  ["credit", "Total premium received for all contracts, in dollars."],
  ["buyback", "Total paid to close early. Blank means 0."],
  ["fees", "Total commissions on the trade. Blank means 0."],
  ["stock_at_sale", "Share price on the day the call was sold. Optional, feeds the price line."],
  ["stock_at_expiry", "Share price at expiry. Optional."],
  ["outcome", "open, expired, assigned, rolled, or bought_back. Blank means open."],
];

/* ---- tiny RFC 4180 parser: quotes, embedded commas, CRLF, BOM ---- */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const num = (s) => {
  if (s == null) return null;
  const t = String(s).replace(/[$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : NaN;
};
const date = (s) => {
  const t = (s || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return NaN;
};
const low = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, "_");

/* ---- validate and build positions + trades ---- */
export function importLedger(text) {
  const errors = [], warnings = [];
  const rows = parseCsv(text);
  if (!rows.length) return { errors: [{ row: 0, msg: "The file is empty." }], warnings, positions: [], trades: [] };

  const header = rows[0].map((h) => low(h));
  const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)]));
  const missing = COLUMNS.filter((c) => idx[c] === -1 && !["position_id", "buyback", "fees", "stock_at_sale", "stock_at_expiry", "exit_reason", "position_status", "outcome"].includes(c));
  if (missing.length) {
    return { errors: [{ row: 1, msg: `Header is missing: ${missing.join(", ")}. Download the template and keep its first row.` }], warnings, positions: [], trades: [] };
  }
  const get = (r, c) => (idx[c] === -1 ? "" : (r[idx[c]] ?? "").trim());

  const positions = new Map();  // key -> position
  const trades = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const bad = (msg) => errors.push({ row: line, msg });
    const warn = (msg) => warnings.push({ row: line, msg });

    const ticker = get(r, "ticker").toUpperCase();
    const shares = num(get(r, "shares"));
    const basis = num(get(r, "cost_basis"));
    const opened = date(get(r, "opened"));
    if (!ticker) bad("ticker is blank.");
    if (shares == null || !(shares > 0)) bad("shares must be a positive number.");
    if (basis == null || !(basis > 0)) bad("cost_basis must be a positive number.");
    if (opened === null) bad("opened is blank.");
    else if (Number.isNaN(opened)) bad("opened is not a date I can read. Use YYYY-MM-DD.");

    const statusRaw = low(get(r, "position_status")) || "open";
    if (!["open", "closed"].includes(statusRaw)) bad(`position_status "${get(r, "position_status")}" must be open or closed.`);
    const exitPrice = num(get(r, "exit_price"));
    const closedDate = date(get(r, "closed_date"));
    const exitReason = low(get(r, "exit_reason")) || "sold";
    if (statusRaw === "closed") {
      if (exitPrice == null || !(exitPrice > 0)) bad("exit_price is required when position_status is closed.");
      if (!closedDate) bad("closed_date is required when position_status is closed.");
      else if (Number.isNaN(closedDate)) bad("closed_date is not a date I can read.");
      if (!["sold", "assigned"].includes(exitReason)) bad("exit_reason must be sold or assigned.");
    }

    const key = get(r, "position_id") || `${ticker}|${opened}`;
    if (!positions.has(key)) {
      positions.set(key, {
        id: uid(), ticker, shares: shares || 0, costBasis: basis || 0, price: 0,
        opened: opened || "", status: statusRaw,
        exitPrice: statusRaw === "closed" ? exitPrice : "", closedDate: statusRaw === "closed" ? (closedDate || "") : "",
        exitReason: statusRaw === "closed" ? exitReason : "sold",
        priceUpdated: "", priceSource: "", label: key,
      });
    } else {
      const p = positions.get(key);
      if (p.ticker !== ticker || p.shares !== shares || p.costBasis !== basis || p.opened !== opened) {
        warn(`position ${key}: share, basis, or date differs from an earlier row. Keeping the first values.`);
      }
    }
    const pos = positions.get(key);

    const sold = date(get(r, "sold"));
    if (sold === null) return; // position-only row
    if (Number.isNaN(sold)) { bad("sold is not a date I can read."); return; }

    const expiry = date(get(r, "expiry"));
    const contracts = num(get(r, "contracts"));
    const strike = num(get(r, "strike"));
    const credit = num(get(r, "credit"));
    const buyback = num(get(r, "buyback")) ?? 0;
    const fees = num(get(r, "fees")) ?? 0;
    const pAtSale = num(get(r, "stock_at_sale"));
    const pAtExp = num(get(r, "stock_at_expiry"));
    const outcome = low(get(r, "outcome")) || "open";

    if (!expiry) bad("expiry is required on a call row.");
    else if (Number.isNaN(expiry)) bad("expiry is not a date I can read.");
    else if (expiry < sold) bad("expiry is before the sold date.");
    if (contracts == null || !(contracts >= 1) || contracts % 1) bad("contracts must be a whole number of at least 1.");
    if (strike == null || !(strike > 0)) bad("strike must be a positive number.");
    if (credit == null || !(credit >= 0)) bad("credit must be a number (total dollars received).");
    if (Number.isNaN(buyback) || buyback < 0) bad("buyback must be a number.");
    if (Number.isNaN(fees) || fees < 0) bad("fees must be a number.");
    if (Number.isNaN(pAtSale)) bad("stock_at_sale is not a number.");
    if (Number.isNaN(pAtExp)) bad("stock_at_expiry is not a number.");
    if (!OUTCOMES.includes(outcome)) bad(`outcome "${get(r, "outcome")}" must be one of ${OUTCOMES.join(", ")}.`);
    if (contracts && shares && contracts * 100 > shares) warn(`${ticker}: ${contracts} contracts covers more shares than the lot holds (${shares}).`);

    trades.push({
      id: uid(), positionId: pos.id, date: sold, expiry: expiry || "",
      contracts: contracts || 0, strike: strike || 0, credit: credit || 0, buyback, fees,
      priceAtSale: pAtSale ?? "", priceAtExpiry: pAtExp ?? "", outcome,
    });
  });

  return { errors, warnings, positions: [...positions.values()], trades };
}

/* ---- export the live ledger back into the same template ---- */
const q = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function exportLedger(positions, trades) {
  const lines = [COLUMNS.join(",")];
  positions.forEach((p, i) => {
    const pid = p.label && !p.label.includes("|") ? p.label : `${p.ticker || "POS"}-${i + 1}`;
    const base = [
      pid, p.ticker, p.shares, p.costBasis, p.opened, p.status,
      p.status === "closed" ? p.exitPrice : "", p.status === "closed" ? p.closedDate : "",
      p.status === "closed" ? p.exitReason : "",
    ];
    const ts = trades.filter((t) => t.positionId === p.id);
    if (!ts.length) lines.push([...base, "", "", "", "", "", "", "", "", "", ""].map(q).join(","));
    ts.forEach((t) => lines.push([
      ...base, t.date, t.expiry, t.contracts, t.strike, t.credit, t.buyback, t.fees,
      t.priceAtSale, t.priceAtExpiry, t.outcome,
    ].map(q).join(",")));
  });
  return lines.join("\r\n") + "\r\n";
}

export function download(name, text, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
