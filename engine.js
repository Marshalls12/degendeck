/* ============================================================
   Premium Ledger engine. Pure functions, no React.
   Formulas are unchanged from v2. New in v3:
     - per call: ifAssignedPL, upsideForgone, dte to today
     - portfolio: upsideCapped, byTicker, outcome split by period
     - riskBoard: every open call against the current price
   ============================================================ */

export const DAY = 86400000;
export const iso = (d) => new Date(d).toISOString().slice(0, 10);
export const parse = (s) => new Date(s + "T12:00:00");
export const today = () => iso(new Date());
export const uid = () => Math.random().toString(36).slice(2, 9);
export const addDays = (s, n) => iso(new Date(+parse(s) + n * DAY));

export const money = (n, d = 2) =>
  (n < 0 ? "-$" : "$") + Math.abs(n || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n, d = 1) => (n == null || !isFinite(n) ? "n/a" : (n * 100).toFixed(d) + "%");
export const signed = (n) => (n >= 0 ? "+" : "") + money(n);

export const OUTCOMES = ["open", "expired", "assigned", "rolled", "bought_back"];

export function periodKey(dateStr, gran) {
  const d = parse(dateStr), y = d.getFullYear(), m = d.getMonth();
  if (gran === "year") return String(y);
  if (gran === "quarter") return `${y} Q${Math.floor(m / 3) + 1}`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function xnpv(r, f) {
  const t0 = f[0].t;
  return f.reduce((s, x) => s + x.amount / Math.pow(1 + r, (x.t - t0) / (365 * DAY)), 0);
}
export function xirr(f) {
  if (f.length < 2 || !f.some((x) => x.amount > 0) || !f.some((x) => x.amount < 0)) return null;
  let lo = -0.99999, hi = 20, fLo = xnpv(lo, f), fHi = xnpv(hi, f);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 240; i++) {
    const m = (lo + hi) / 2, fm = xnpv(m, f);
    if (fm * fLo <= 0) { hi = m; fHi = fm; } else { lo = m; fLo = fm; }
  }
  return (lo + hi) / 2;
}

export const net = (t) => (+t.credit || 0) - (+t.buyback || 0) - (+t.fees || 0);
export const covered = (t) => (+t.contracts || 0) * 100;

export const DEFAULTS = { taxRate: 24, premiumPct: 1.5, otmPct: 7, dte: 7, contractFee: 0.65 };

export const newPosition = (over = {}) => ({
  id: uid(), ticker: "", shares: 100, costBasis: 0, price: 0,
  opened: today(), status: "open", closedDate: "", exitPrice: "",
  exitReason: "sold", priceUpdated: "", priceSource: "", ...over,
});

/* ---------------- per position ---------------- */
export function positionMetrics(p, trades, settings) {
  const ts = trades.filter((t) => t.positionId === p.id);
  const totalNet = ts.reduce((a, t) => a + net(t), 0);
  const grossCredit = ts.reduce((a, t) => a + (+t.credit || 0), 0);
  const buybacks = ts.reduce((a, t) => a + (+t.buyback || 0), 0);
  const fees = ts.reduce((a, t) => a + (+t.fees || 0), 0);

  const book = p.shares * p.costBasis;
  const isClosed = p.status === "closed";
  const mark = isClosed ? (+p.exitPrice || 0) : (+p.price || 0);
  const stockPL = (mark - p.costBasis) * p.shares;
  const premPerShare = p.shares ? totalNet / p.shares : 0;

  const endDate = isClosed && p.closedDate ? p.closedDate : today();
  const days = Math.max(1, (parse(endDate) - parse(p.opened)) / DAY);
  const totalPL = totalNet + stockPL;
  const roc = book ? totalPL / book : 0;

  const closed = ts.filter((t) => t.outcome !== "open");
  const wins = closed.filter((t) => t.outcome === "expired").length;

  const perTrade = ts.map((t) => {
    const dte = Math.max(1, (parse(t.expiry || t.date) - parse(t.date)) / DAY);
    const collateral = covered(t) * p.costBasis;
    const n = net(t);
    const px = +t.priceAtExpiry || 0;
    const upsideForgone = t.outcome === "assigned" && px > +t.strike ? (px - +t.strike) * covered(t) : 0;
    return {
      ...t, ticker: p.ticker, dte, collateral, net: n,
      annualized: collateral ? (n / collateral) * (365 / dte) : 0,
      moneyness: t.priceAtSale ? (+t.strike - +t.priceAtSale) / +t.priceAtSale : null,
      breached: t.priceAtExpiry ? +t.priceAtExpiry > +t.strike : null,
      ifAssignedPL: (+t.strike - p.costBasis) * covered(t) + n,
      upsideForgone,
    };
  });

  return {
    ...p, trades: ts, perTrade, book, mark, isClosed,
    totalNet, grossCredit, buybacks, fees, premPerShare,
    effBasis: p.costBasis - premPerShare,
    stockPL, realizedStock: isClosed ? stockPL : 0, unrealizedStock: isClosed ? 0 : stockPL,
    totalPL, roc, days, annualizedROC: days > 0 ? roc * (365 / days) : 0,
    incomeYield: book ? totalNet / book : 0,
    incomeYieldAnn: book && days > 0 ? (totalNet / book) * (365 / days) : 0,
    cushion: p.costBasis ? premPerShare / p.costBasis : 0,
    count: ts.length, closedCount: closed.length,
    openCount: ts.filter((t) => t.outcome === "open").length,
    wins, winRate: closed.length ? wins / closed.length : null,
    assignedCount: ts.filter((t) => t.outcome === "assigned").length,
    avgNet: ts.length ? totalNet / ts.length : 0,
    avgAnn: perTrade.length ? perTrade.reduce((a, t) => a + t.annualized, 0) / perTrade.length : 0,
    avgDte: perTrade.length ? perTrade.reduce((a, t) => a + t.dte, 0) / perTrade.length : 0,
    weeklyPace: days > 0 ? totalNet / (days / 7) : 0,
    afterTaxNet: totalNet * (1 - settings.taxRate / 100),
    upsideForgone: perTrade.reduce((a, t) => a + t.upsideForgone, 0),
  };
}

/* ---------------- whole book ---------------- */
export function portfolioMetrics(pms, settings) {
  const sum = (f) => pms.reduce((a, p) => a + f(p), 0);
  const openPos = pms.filter((p) => !p.isClosed);
  const totalNet = sum((p) => p.totalNet);
  const realized = sum((p) => p.realizedStock);
  const unrealized = sum((p) => p.unrealizedStock);
  const deployed = openPos.reduce((a, p) => a + p.book, 0);
  const marketValue = openPos.reduce((a, p) => a + p.shares * p.mark, 0);
  const allDates = pms.map((p) => p.opened).filter(Boolean).sort();
  const first = allDates[0] || today();
  const days = Math.max(1, (parse(today()) - parse(first)) / DAY);

  const flows = [];
  pms.forEach((p) => {
    flows.push({ t: parse(p.opened).getTime(), amount: -p.book });
    p.trades.forEach((t) => flows.push({ t: parse(t.date).getTime(), amount: net(t) }));
    if (p.isClosed) flows.push({ t: parse(p.closedDate || today()).getTime(), amount: p.shares * p.mark });
  });
  if (openPos.length) flows.push({ t: parse(today()).getTime(), amount: marketValue });
  flows.sort((a, b) => a.t - b.t);

  const allTrades = pms.flatMap((p) => p.perTrade);
  const closedT = allTrades.filter((t) => t.outcome !== "open");

  // Premium by ticker, with an annualized yield that weights each call by the
  // collateral it tied up and how long it was out. Comparable across tickers.
  const byTickerMap = new Map();
  pms.forEach((p) => {
    const key = p.ticker || "n/a";
    if (!byTickerMap.has(key)) byTickerMap.set(key, { ticker: key, premium: 0, calls: 0, collateralDays: 0, assigned: 0, stock: 0, positions: 0 });
    const b = byTickerMap.get(key);
    b.positions++;
    b.stock += p.stockPL;
    p.perTrade.forEach((t) => {
      b.premium += t.net; b.calls++;
      b.collateralDays += t.collateral * t.dte;
      if (t.outcome === "assigned") b.assigned++;
    });
  });
  const byTicker = [...byTickerMap.values()].map((b) => ({
    ...b,
    total: b.premium + b.stock,
    yieldAnn: b.collateralDays ? (b.premium / b.collateralDays) * 365 : 0,
  })).sort((a, b) => b.premium - a.premium);

  return {
    totalNet, realized, unrealized, deployed, marketValue, days,
    totalPL: totalNet + realized + unrealized,
    grossCredit: sum((p) => p.grossCredit), buybacks: sum((p) => p.buybacks), fees: sum((p) => p.fees),
    capitalEver: sum((p) => p.book),
    roc: deployed ? (totalNet + realized + unrealized) / deployed : 0,
    incomeYieldAnn: deployed && days > 0 ? (totalNet / deployed) * (365 / days) : 0,
    xirr: xirr(flows),
    afterTaxNet: totalNet * (1 - settings.taxRate / 100),
    tradeCount: allTrades.length,
    openCalls: allTrades.filter((t) => t.outcome === "open").length,
    winRate: closedT.length ? closedT.filter((t) => t.outcome === "expired").length / closedT.length : null,
    avgAnn: allTrades.length ? allTrades.reduce((a, t) => a + t.annualized, 0) / allTrades.length : 0,
    assignedCount: allTrades.filter((t) => t.outcome === "assigned").length,
    weeklyPace: days > 0 ? totalNet / (days / 7) : 0,
    positions: pms.length, openPositions: openPos.length,
    best: allTrades.length ? allTrades.reduce((a, b) => (b.net > a.net ? b : a)) : null,
    worst: allTrades.length ? allTrades.reduce((a, b) => (b.net < a.net ? b : a)) : null,
    upsideCapped: sum((p) => p.upsideForgone),
    byTicker,
    allTrades,
  };
}

/* ---------------- open calls against the market ---------------- */
export function riskBoard(pms) {
  const now = today();
  const rows = [];
  pms.filter((p) => !p.isClosed).forEach((p) => {
    p.perTrade.filter((t) => t.outcome === "open").forEach((t) => {
      const spot = +p.price || 0;
      const strike = +t.strike || 0;
      const dte = t.expiry ? Math.round((parse(t.expiry) - parse(now)) / DAY) : null;
      rows.push({
        ...t,
        positionId: p.id, ticker: p.ticker, spot, costBasis: p.costBasis,
        daysLeft: dte,
        room: spot && strike ? (strike - spot) / spot : null,   // positive means still OTM
        itm: spot && strike ? spot > strike : null,
        ifAssignedPL: t.ifAssignedPL,
        ifAssignedROC: t.collateral ? t.ifAssignedPL / t.collateral : 0,
        capRisk: spot > strike ? (spot - strike) * covered(t) : 0, // upside already above the cap
      });
    });
  });
  return rows.sort((a, b) => {
    const ra = a.room == null ? 99 : a.room, rb = b.room == null ? 99 : b.room;
    return ra - rb;
  });
}

/* ---------------- time series ---------------- */
export function priceSeries(p, trades, prices) {
  const pts = new Map();
  const put = (d, v) => { if (d && v > 0) pts.set(d, +v); };
  put(p.opened, p.costBasis);
  trades.filter((t) => t.positionId === p.id).forEach((t) => {
    put(t.date, t.priceAtSale); put(t.expiry, t.priceAtExpiry);
  });
  prices.filter((x) => x.ticker === p.ticker).forEach((x) => put(x.date, x.price));
  if (p.status === "closed") put(p.closedDate, p.exitPrice); else put(today(), p.price);
  return [...pts.entries()].map(([date, price]) => ({ date, price, label: date.slice(5) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function portfolioTimeline(pms, prices) {
  const dates = new Set();
  pms.forEach((p) => {
    dates.add(p.opened);
    p.trades.forEach((t) => { dates.add(t.date); if (t.expiry) dates.add(t.expiry); });
    if (p.isClosed && p.closedDate) dates.add(p.closedDate);
  });
  prices.forEach((x) => dates.add(x.date));
  dates.add(today());
  const sorted = [...dates].filter(Boolean).sort();
  const series = new Map(pms.map((p) => [p.id, priceSeries(p, p.trades, prices)]));

  return sorted.map((d) => {
    let prem = 0, stock = 0;
    pms.forEach((p) => {
      if (p.opened > d) return;
      p.trades.filter((t) => t.date <= d).forEach((t) => { prem += net(t); });
      const ser = series.get(p.id).filter((x) => x.date <= d);
      const mk = p.isClosed && p.closedDate <= d ? +p.exitPrice
        : (ser.length ? ser[ser.length - 1].price : p.costBasis);
      stock += (mk - p.costBasis) * p.shares;
    });
    return { date: d, label: d.slice(2, 7), premium: prem, stock, total: prem + stock };
  });
}

export function aggregate(pms, prices, gran) {
  const map = new Map();
  const touch = (k) => {
    if (!map.has(k)) map.set(k, {
      period: k, premium: 0, stock: 0, total: 0, count: 0, assigned: 0,
      expired: 0, bought_back: 0, rolled: 0, assignedNet: 0, open: 0,
    });
    return map.get(k);
  };
  pms.forEach((p) => p.trades.forEach((t) => {
    const b = touch(periodKey(t.date, gran));
    const n = net(t);
    b.premium += n; b.count++;
    if (t.outcome === "assigned") { b.assigned++; b.assignedNet += n; }
    else if (t.outcome === "expired") b.expired += n;
    else if (t.outcome === "bought_back") b.bought_back += n;
    else if (t.outcome === "rolled") b.rolled += n;
    else b.open += n;
  }));
  const tl = portfolioTimeline(pms, prices);
  let prev = null;
  tl.forEach((r) => {
    const b = touch(periodKey(r.date, gran));
    b.stock += prev ? r.stock - prev.stock : r.stock;
    prev = r;
  });
  const out = [...map.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
  out.forEach((b) => { b.total = b.premium + b.stock; });
  return out;
}

/* ---------------- sample book for first-time visitors ---------------- */
export function sampleData() {
  const d = (n) => addDays(today(), -n);
  const soun = newPosition({ ticker: "SOUN", shares: 500, costBasis: 6.17, price: 6.42, opened: d(84) });
  const pltr = newPosition({ ticker: "PLTR", shares: 100, costBasis: 24.8, price: 27, opened: d(70), status: "closed", exitPrice: 27, closedDate: d(35), exitReason: "assigned" });
  const aapl = newPosition({ ticker: "AAPL", shares: 100, costBasis: 182.5, price: 186.1, opened: d(28) });
  const call = (p, over) => ({ id: uid(), positionId: p.id, buyback: 0, fees: 0.65, priceAtExpiry: "", ...over });
  const trades = [
    call(soun, { date: d(84), expiry: d(80), contracts: 5, strike: 6.5, credit: 52.5, fees: 3.25, priceAtSale: 6.2, priceAtExpiry: 6.05, outcome: "expired" }),
    call(soun, { date: d(77), expiry: d(73), contracts: 5, strike: 6.5, credit: 48, fees: 3.25, priceAtSale: 6.1, priceAtExpiry: 6.3, outcome: "expired" }),
    call(soun, { date: d(70), expiry: d(66), contracts: 5, strike: 7, credit: 41, fees: 3.25, priceAtSale: 6.45, priceAtExpiry: 6.9, outcome: "expired" }),
    call(soun, { date: d(63), expiry: d(59), contracts: 5, strike: 7, credit: 62, buyback: 28, fees: 6.5, priceAtSale: 6.8, priceAtExpiry: 7.15, outcome: "bought_back" }),
    call(soun, { date: d(56), expiry: d(52), contracts: 5, strike: 7.5, credit: 55, fees: 3.25, priceAtSale: 7.05, priceAtExpiry: 6.6, outcome: "expired" }),
    call(soun, { date: d(3), expiry: d(-4), contracts: 5, strike: 7, credit: 47.5, fees: 3.25, priceAtSale: 6.4, outcome: "open" }),
    call(pltr, { date: d(70), expiry: d(60), contracts: 1, strike: 27, credit: 61, priceAtSale: 24.9, priceAtExpiry: 26.1, outcome: "expired" }),
    call(pltr, { date: d(49), expiry: d(35), contracts: 1, strike: 27, credit: 74, priceAtSale: 25.6, priceAtExpiry: 27.4, outcome: "assigned" }),
    call(aapl, { date: d(28), expiry: d(14), contracts: 1, strike: 190, credit: 210, priceAtSale: 182.9, priceAtExpiry: 184.2, outcome: "expired" }),
    call(aapl, { date: d(7), expiry: d(-7), contracts: 1, strike: 187.5, credit: 245, priceAtSale: 185.3, outcome: "open" }),
  ];
  const prices = [
    { id: uid(), ticker: "SPY", date: d(84), price: 541.2 },
    { id: uid(), ticker: "SPY", date: d(70), price: 552.8 },
    { id: uid(), ticker: "SPY", date: d(35), price: 561.4 },
    { id: uid(), ticker: "SPY", date: d(28), price: 558.9 },
    { id: uid(), ticker: "SPY", date: d(0), price: 574.6 },
  ];
  return { positions: [soun, pltr, aapl], trades, prices };
}

/* ---------------- benchmarks: savings account and SPY ---------------- */
export const BENCH = "SPY";

// Nearest SPY close on or before the date; falls back to the nearest after and
// says so, so a thin price list still produces a number the user can judge.
export function spyAt(date, prices) {
  const pts = prices.filter((x) => (x.ticker || "").toUpperCase() === BENCH && x.date && +x.price > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!pts.length) return null;
  const before = pts.filter((x) => x.date <= date);
  if (before.length) { const b = before[before.length - 1]; return { price: +b.price, date: b.date, exact: b.date === date, approx: b.date !== date }; }
  const a = pts[0];
  return { price: +a.price, date: a.date, exact: false, approx: true };
}

export function benchmark(pms, prices, apy) {
  const rate = (+apy || 0) / 100;
  const now = today();
  const rows = pms.map((p) => {
    const end = p.isClosed && p.closedDate ? p.closedDate : now;
    const days = Math.max(1, (parse(end) - parse(p.opened)) / DAY);
    const savingsValue = p.book * Math.pow(1 + rate, days / 365);
    const s0 = spyAt(p.opened, prices), s1 = spyAt(end, prices);
    const spyValue = s0 && s1 ? (p.book / s0.price) * s1.price : null;
    return {
      id: p.id, ticker: p.ticker, book: p.book, opened: p.opened, end, days, isClosed: p.isClosed,
      ledgerPL: p.totalPL, ledgerRoc: p.roc,
      savingsPL: savingsValue - p.book, savingsRoc: p.book ? (savingsValue - p.book) / p.book : 0,
      spyPL: spyValue == null ? null : spyValue - p.book,
      spyRoc: spyValue == null ? null : (spyValue - p.book) / p.book,
      spyStart: s0, spyEnd: s1, spyApprox: !!(s0?.approx || s1?.approx),
    };
  });
  const sum = (f) => rows.reduce((a, r) => a + (f(r) || 0), 0);
  const spyKnown = rows.every((r) => r.spyPL != null);

  // Same cash flow schedule as the book XIRR, with each benchmark's end values.
  const flowsFor = (endValue) => {
    const f = [];
    rows.forEach((r) => {
      f.push({ t: parse(r.opened).getTime(), amount: -r.book });
      f.push({ t: parse(r.end).getTime(), amount: r.book + endValue(r) });
    });
    return f.sort((a, b) => a.t - b.t);
  };
  const ledgerFlows = [];
  pms.forEach((p) => {
    ledgerFlows.push({ t: parse(p.opened).getTime(), amount: -p.book });
    p.trades.forEach((t) => ledgerFlows.push({ t: parse(t.date).getTime(), amount: net(t) }));
    const end = p.isClosed && p.closedDate ? p.closedDate : now;
    ledgerFlows.push({ t: parse(end).getTime(), amount: p.shares * p.mark });
  });
  ledgerFlows.sort((a, b) => a.t - b.t);

  const capital = sum((r) => r.book);
  return {
    rows, capital, spyKnown, rate,
    ledgerPL: sum((r) => r.ledgerPL), savingsPL: sum((r) => r.savingsPL), spyPL: spyKnown ? sum((r) => r.spyPL) : null,
    ledgerRoc: capital ? sum((r) => r.ledgerPL) / capital : 0,
    savingsRoc: capital ? sum((r) => r.savingsPL) / capital : 0,
    spyRoc: spyKnown && capital ? sum((r) => r.spyPL) / capital : null,
    ledgerXirr: xirr(ledgerFlows),
    savingsXirr: xirr(flowsFor((r) => r.savingsPL)),
    spyXirr: spyKnown ? xirr(flowsFor((r) => r.spyPL)) : null,
    spyPoints: prices.filter((x) => (x.ticker || "").toUpperCase() === BENCH).length,
    missing: rows.filter((r) => r.spyPL == null).map((r) => r.ticker),
  };
}

// Growth of every dollar deployed, three ways, on the same dates as the book timeline.
export function benchmarkTimeline(pms, prices, apy) {
  const rate = (+apy || 0) / 100;
  const tl = portfolioTimeline(pms, prices);
  const spyDates = prices.filter((x) => (x.ticker || "").toUpperCase() === BENCH).map((x) => x.date);
  const now = today();
  const dates = [...new Set([...tl.map((r) => r.date), ...spyDates])].filter((d) => d <= now).sort();
  return dates.map((d) => {
    let deployed = 0, ledger = 0, savings = 0, spy = 0, spyOk = true;
    pms.forEach((p) => {
      if (p.opened > d) return;
      const end = p.isClosed && p.closedDate && p.closedDate <= d ? p.closedDate : d;
      const days = Math.max(0, (parse(end) - parse(p.opened)) / DAY);
      deployed += p.book;
      savings += p.book * (Math.pow(1 + rate, days / 365) - 1);
      const s0 = spyAt(p.opened, prices), s1 = spyAt(end, prices);
      if (s0 && s1) spy += (p.book / s0.price) * s1.price - p.book; else spyOk = false;
    });
    const row = tl.find((r) => r.date === d);
    if (row) ledger = row.total;
    else {
      const prev = tl.filter((r) => r.date <= d).pop();
      ledger = prev ? prev.total : 0;
    }
    return { date: d, label: d.slice(2, 7), deployed, ledger, savings, spy: spyOk ? spy : null };
  });
}
