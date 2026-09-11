import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, Cell,
} from "recharts";
import {
  DEFAULTS, newPosition, uid, today, addDays, money, pct, signed,
  positionMetrics, portfolioMetrics, priceSeries, portfolioTimeline, aggregate, riskBoard, sampleData,
  benchmark, benchmarkTimeline, spyAt, BENCH,
} from "./engine.js";
import { C, OUTCOME, hue } from "./theme.js";
import { makeCss } from "./styles.js";
import { importLedger, exportLedger, download, COLUMNS, COLUMN_HELP } from "./csv.js";
import { fetchQuotes } from "./quotes.js";
import {
  Field, Stat, ChartTip, FocusLegend, axisTick, gridProps,
  CushionGauge, BookTimeline, StrikeLadder,
} from "./charts.jsx";

/* ============================================================
   Premium Ledger v3. Static, in-memory, hosted on GitHub Pages.
   Nothing is stored: upload the template to load, export to keep.
   ============================================================ */

const TEMPLATE_URL = `${import.meta.env.BASE_URL}premium-ledger-template.csv`;
const CSS = makeCss(C);

const dollarTick = (v) => (Math.abs(v) >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + v.toFixed(0));
const pctTick = (v) => (v * 100).toFixed(0) + "%";

const YieldTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tipcard static">
      <div className="tip-t">{label}</div>
      <div className="tip-r"><span>Net premium</span><b style={{ color: C.premium }}>{money(d.premium)}</b></div>
      <div className="tip-r"><span>Yield, annualized</span><b>{pct(d.yieldAnn, 0)}</b></div>
      <div className="tip-r"><span>Calls</span><b>{d.calls}</b></div>
      <div className="tip-r"><span>Assigned</span><b>{d.assigned}</b></div>
      <div className="tip-r"><span>Stock P&L</span><b style={{ color: d.stock >= 0 ? C.kept : C.danger }}>{signed(d.stock)}</b></div>
    </div>
  );
};

/* ---- room to strike, one bar per open call ---- */
function RoomBar({ room }) {
  // scale: -15% (deep ITM) on the left to +15% OTM on the right, strike at center
  if (room == null) return <div className="risk-bar" title="Set a price to see this" />;
  const clamp = Math.max(-0.15, Math.min(0.15, room));
  const center = 50, w = (Math.abs(clamp) / 0.15) * 50;
  const left = clamp < 0 ? center - w : center;
  const color = room < 0 ? C.danger : room < 0.03 ? C.assigned : C.kept;
  return (
    <div className="risk-bar" title={`${pct(room)} to strike`}>
      <i style={{ left: `${left}%`, width: `${w}%`, background: color, opacity: 0.55 }} />
      <b style={{ left: "calc(50% - 1.5px)" }} />
    </div>
  );
}

export default function PremiumLedger() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [finnhubKey, setFinnhubKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [prices, setPrices] = useState([]);
  const [tab, setTab] = useState("book");
  const [gran, setGran] = useState("month");
  const [sel, setSel] = useState(null);
  const [logFilter, setLogFilter] = useState("all");
  const [quoteState, setQuoteState] = useState({ busy: false, msg: "", err: false });
  const [focusA, setFocusA] = useState(null);
  const [focusB, setFocusB] = useState(null);
  const [focusC, setFocusC] = useState(null);
  const [upload, setUpload] = useState({ name: "", errors: [], warnings: [], loaded: 0 });
  const [over, setOver] = useState(false);
  const [exported, setExported] = useState(false);
  const [apy, setApy] = useState(4);
  const [spyEntry, setSpyEntry] = useState({ date: today(), price: "" });
  const [focusD, setFocusD] = useState(null);
  const fileRef = useRef(null);

  const hasData = positions.length > 0;

  // Nothing is persisted, so warn before the tab closes with unexported work.
  useEffect(() => {
    if (!hasData) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasData]);

  const pms = useMemo(() => positions.map((p) => positionMetrics(p, trades, settings)), [positions, trades, settings]);
  const P = useMemo(() => portfolioMetrics(pms, settings), [pms, settings]);
  const timeline = useMemo(() => portfolioTimeline(pms, prices), [pms, prices]);
  const periods = useMemo(() => aggregate(pms, prices, gran), [pms, prices, gran]);
  const risk = useMemo(() => riskBoard(pms), [pms]);
  const bench = useMemo(() => benchmark(pms, prices, apy), [pms, prices, apy]);
  const benchTl = useMemo(() => benchmarkTimeline(pms, prices, apy), [pms, prices, apy]);
  const current = pms.find((p) => p.id === sel) || pms.find((p) => !p.isClosed) || pms[0];

  const setS = (k) => (v) => setSettings((o) => ({ ...o, [k]: v }));
  const updPos = (id, k, v) => setPositions((a) => a.map((p) => (p.id === id ? { ...p, [k]: v } : p)));
  const updTrade = (id, k, v) => setTrades((a) => a.map((t) => (t.id === id ? { ...t, [k]: v } : t)));
  const dimA = (k) => (!focusA || focusA === k ? 1 : 0.12);
  const dimB = (k) => (!focusB || focusB === k ? 1 : 0.12);
  const dimC = (k) => (!focusC || focusC === k ? 1 : 0.12);
  const dimD = (k) => (!focusD || focusD === k ? 1 : 0.12);
  const addSpyPoint = () => {
    if (!spyEntry.date || !(+spyEntry.price > 0)) return;
    setPrices((a) => [...a.filter((x) => !((x.ticker || "").toUpperCase() === BENCH && x.date === spyEntry.date)),
      { id: uid(), ticker: BENCH, date: spyEntry.date, price: +spyEntry.price }]);
    setSpyEntry({ date: today(), price: "" });
  };

  /* ---------------- load / save ---------------- */
  const loadFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const r = importLedger(text);
    if (r.errors.length) {
      setUpload({ name: file.name, errors: r.errors, warnings: r.warnings, loaded: 0 });
      setTab("data");
      return;
    }
    setPositions(r.positions); setTrades(r.trades); setPrices([]); setSel(null); setLogFilter("all");
    setUpload({ name: file.name, errors: [], warnings: r.warnings, loaded: r.trades.length });
    setExported(false);
    setTab(r.warnings.length ? "data" : "book");
  };
  const onDrop = (e) => { e.preventDefault(); setOver(false); loadFile(e.dataTransfer.files?.[0]); };
  const exportNow = () => {
    download(`premium-ledger-${today()}.csv`, exportLedger(positions, trades));
    setExported(true);
  };
  const loadSample = () => {
    const s = sampleData();
    setPositions(s.positions); setTrades(s.trades); setPrices(s.prices); setSel(null);
    setUpload({ name: "sample book", errors: [], warnings: [], loaded: s.trades.length });
    setExported(false);
    setTab("book");
  };
  const clearAll = () => {
    if (hasData && !exported && !window.confirm("Clear the ledger? Nothing is saved unless you exported it.")) return;
    setPositions([]); setTrades([]); setPrices([]); setSel(null);
    setUpload({ name: "", errors: [], warnings: [], loaded: 0 });
  };

  /* ---------------- prices ---------------- */
  const refreshQuotes = async () => {
    const own = [...new Set(positions.filter((p) => p.status === "open" && p.ticker).map((p) => p.ticker.toUpperCase()))];
    const tickers = [...new Set([...own, BENCH])];
    if (!finnhubKey.trim()) { setQuoteState({ busy: false, msg: "Add your Finnhub key on the Data tab first", err: true }); setTab("data"); return; }
    setQuoteState({ busy: true, msg: `Looking up ${tickers.join(", ")}`, err: false });
    try {
      const quotes = await fetchQuotes(tickers, finnhubKey.trim());
      let hits = 0;
      const stamp = today();
      setPositions((arr) => arr.map((p) => {
        const q = quotes.find((x) => x.ticker === (p.ticker || "").toUpperCase());
        if (p.status !== "open" || !q?.ok) return p;
        hits++;
        return { ...p, price: q.price, priceUpdated: q.asOf || stamp, priceSource: "finnhub", dayChange: q.change };
      }));
      setPrices((arr) => [...arr, ...quotes.filter((q) => q.ok).map((q) => ({
        id: uid(), ticker: q.ticker, date: q.asOf || stamp, price: q.price,
      }))]);
      const misses = quotes.filter((q) => !q.ok).map((q) => `${q.ticker}: ${q.why}`);
      hits = quotes.filter((q) => q.ok).length;
      setQuoteState({
        busy: false, err: hits === 0,
        msg: hits ? `Updated ${hits} of ${tickers.length}${misses.length ? ". " + misses.join("; ") : ""}` : misses.join("; ") || "No prices came back",
      });
    } catch (e) {
      setQuoteState({ busy: false, err: true, msg: e?.message || "Lookup failed" });
    }
    setTimeout(() => setQuoteState((q) => ({ ...q, msg: "" })), 10000);
  };

  /* ---------------- editing ---------------- */
  const addPosition = () => { const p = newPosition(); setPositions((a) => [...a, p]); setSel(p.id); setTab("positions"); };
  const addTrade = (posId) => {
    const p = positions.find((x) => x.id === posId);
    if (!p) return;
    setTrades((a) => [...a, {
      id: uid(), positionId: posId, date: today(), expiry: addDays(today(), settings.dte),
      contracts: Math.max(1, Math.floor(p.shares / 100)),
      strike: +(Math.round((p.price || p.costBasis) * (1 + settings.otmPct / 100) * 2) / 2).toFixed(2),
      credit: +((p.shares * p.costBasis * settings.premiumPct) / 100).toFixed(2),
      buyback: 0, fees: settings.contractFee, priceAtSale: p.price || p.costBasis,
      priceAtExpiry: "", outcome: "open",
    }]);
  };
  const closeAtStrike = (t) => {
    const p = positions.find((x) => x.id === t.positionId);
    if (!p) return;
    setPositions((a) => a.map((x) => x.id === p.id
      ? { ...x, status: "closed", exitPrice: +t.strike, closedDate: t.expiry || today(), exitReason: "assigned" } : x));
  };

  const shown = logFilter === "all" ? P.allTrades : P.allTrades.filter((t) => t.positionId === logFilter);
  const openWithPrice = pms.filter((p) => !p.isClosed);
  const missingPrices = openWithPrice.filter((p) => !p.price).length;

  const TABS = [["book", "The book"], ["risk", "Open calls"], ["position", "Position"], ["log", "Trade log"],
    ["periods", "By period"], ["bench", "Benchmarks"], ["positions", "Positions"], ["data", "Data"]];

  return (
    <div className="root">
      <style>{CSS}</style>
      <div className="wrap">
        <header className="hdr">
          <div>
            <h1 className="h-ttl">Premium Ledger</h1>
            <p className="h-sub">
              Every covered call you have sold, across every position you have held. Premium on one side,
              what the shares actually did on the other.
            </p>
          </div>
          <div className="h-r">
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={exportNow} disabled={!hasData}>Export CSV</button>
              <button className="btn" onClick={refreshQuotes} disabled={quoteState.busy || !hasData}>
                {quoteState.busy ? "Fetching" : "Refresh prices"}
              </button>
            </div>
            <div className={"qstat" + (quoteState.err ? " err" : "")}>{quoteState.msg}</div>
          </div>
        </header>

        {hasData && (
          <div className="banner">
            <b>Nothing is saved.</b>
            <span>This page keeps your ledger in memory only. Export before you close the tab, then upload that file next time.</span>
            <span className="sp" />
            {missingPrices > 0 && <span style={{ color: C.assigned }}>{missingPrices} open position{missingPrices > 1 ? "s" : ""} without a price</span>}
          </div>
        )}

        {/* ===================== WELCOME ===================== */}
        {!hasData && (
          <div className="welcome">
            <div className="card">
              <div className="card-t">Load your trades</div>
              <p className="card-d">
                Drop a CSV built on the template. One row per call sold; rows that share a position_id are the same lot of shares.
                Nothing leaves your browser and nothing is stored.
              </p>
              <div className={"drop" + (over ? " over" : "")}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)} onDrop={onDrop}>
                <b>Drop your ledger CSV here</b>
                or click to choose a file
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => loadFile(e.target.files?.[0])} />
              </div>
              {upload.errors.length > 0 && (
                <>
                  <div className="note err" style={{ marginTop: 14 }}>
                    <b>{upload.name} did not load.</b> Fix the rows below and upload again. Row numbers count the header as row 1.
                  </div>
                  <div className="issues">
                    {upload.errors.map((e, i) => <div className="issue err" key={i}><span>row {e.row}</span>{e.msg}</div>)}
                  </div>
                </>
              )}
              <div className="actions">
                <a className="btn" href={TEMPLATE_URL} download="premium-ledger-template.csv">Download the template</a>
                <button className="btn ghost" onClick={loadSample}>Load a sample book</button>
                <button className="btn ghost" onClick={addPosition}>Start blank</button>
              </div>
            </div>
            <div className="card">
              <div className="card-t">What goes in each column</div>
              <p className="card-d">Dates as YYYY-MM-DD or M/D/YYYY. Dollar signs and commas in numbers are fine.</p>
              <div className="kv">
                {COLUMN_HELP.map(([k, v]) => <React.Fragment key={k}><code>{k}</code><span>{v}</span></React.Fragment>)}
              </div>
            </div>
          </div>
        )}

        {hasData && (
          <>
            <div className="verdict">
              <div className="v-cell">
                <div className="v-l">Premium, all time</div>
                <div className="v-v" style={{ color: C.premium }}>{money(P.totalNet)}</div>
                <div className="v-s">{P.tradeCount} calls · {money(P.weeklyPace)}/week</div>
              </div>
              <div className="v-cell">
                <div className="v-l">Realized on exits</div>
                <div className="v-v" style={{ color: P.realized >= 0 ? C.kept : C.danger }}>{signed(P.realized)}</div>
                <div className="v-s">{pms.filter((p) => p.isClosed).length} positions closed</div>
              </div>
              <div className="v-cell">
                <div className="v-l">Unrealized</div>
                <div className="v-v" style={{ color: P.unrealized >= 0 ? C.kept : C.danger }}>{signed(P.unrealized)}</div>
                <div className="v-s">{P.openPositions} open · {money(P.marketValue)} at market</div>
              </div>
              <div className="v-cell">
                <div className="v-l">Total P&amp;L</div>
                <div className="v-v" style={{ color: P.totalPL >= 0 ? C.kept : C.danger }}>{signed(P.totalPL)}</div>
                <div className="v-s">{pct(P.roc)} on {money(P.deployed)} deployed</div>
              </div>
              <div className="v-cell">
                <div className="v-l">Book XIRR</div>
                <div className="v-v">{pct(P.xirr, 0)}</div>
                <div className="v-s">across every position</div>
              </div>
            </div>

            <nav className="tabs">
              {TABS.map(([k, l]) => (
                <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
                  {l}{k === "risk" && risk.length ? ` (${risk.length})` : ""}
                </button>
              ))}
            </nav>

            {/* ===================== THE BOOK ===================== */}
            {tab === "book" && (
              <>
                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Your book over time</div>
                    <span className="chip">{P.positions} positions · {P.openPositions} open</span>
                  </div>
                  <p className="card-d">
                    One lane per position, from the day you bought to the day you sold. Thin marks are calls sold,
                    the heavy tick is your exit. Hover a lane for its full record.
                  </p>
                  <BookTimeline pms={pms} />
                </div>

                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Where the return comes from</div>
                    <span className="chip">click a legend item to isolate</span>
                  </div>
                  <p className="card-d">
                    Premium only goes up, because it is the part you control. Stock is everything else.
                  </p>
                  {timeline.length > 1 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={timeline} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="label" tick={axisTick} stroke={C.border} tickLine={false} minTickGap={44} />
                        <YAxis tick={axisTick} stroke={C.border} tickLine={false} axisLine={false} width={64} tickFormatter={dollarTick} />
                        <Tooltip content={<ChartTip />} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                        <ReferenceLine y={0} stroke={C.border} />
                        <Legend content={(pr) => <FocusLegend {...pr} focus={focusA} setFocus={setFocusA} />} />
                        <Line type="stepAfter" dataKey="premium" name="Premium" stroke={C.premium} strokeWidth={2}
                          dot={false} strokeOpacity={dimA("premium")} activeDot={{ r: 5, strokeWidth: 2, stroke: C.bg }} />
                        <Line type="monotone" dataKey="stock" name="Stock P&L" stroke={C.stock} strokeWidth={1.75}
                          dot={false} strokeOpacity={dimA("stock")} activeDot={{ r: 5, strokeWidth: 2, stroke: C.bg }} />
                        <Line type="monotone" dataKey="total" name="Total" stroke={C.total} strokeWidth={2.5}
                          dot={false} strokeOpacity={dimA("total")} activeDot={{ r: 5, strokeWidth: 2, stroke: C.bg }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="empty">Log a few trades to draw this.</div>}
                </div>

                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Which tickers actually pay</div>
                    <span className="chip">yield weights each call by collateral and days out</span>
                  </div>
                  <p className="card-d">
                    Bars are net premium per ticker. The annualized yield next to each name is comparable across tickers,
                    so a small position with a high number is earning its keep.
                  </p>
                  {P.byTicker.length ? (
                    <div className="grid2">
                      <ResponsiveContainer width="100%" height={Math.max(180, 44 * P.byTicker.length + 40)}>
                        <BarChart data={P.byTicker} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                          <CartesianGrid stroke={C.borderSoft} horizontal={false} />
                          <XAxis type="number" tick={axisTick} stroke={C.border} tickLine={false} tickFormatter={dollarTick} />
                          <YAxis type="category" dataKey="ticker" tick={{ ...axisTick, fontSize: 11 }} stroke={C.border} tickLine={false} axisLine={false} width={56} />
                          <Tooltip content={<YieldTip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
                          <Bar dataKey="premium" name="Net premium" radius={[0, 3, 3, 0]}>
                            {P.byTicker.map((b) => <Cell key={b.ticker} fill={hue(b.ticker)} fillOpacity={0.85} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="scroll">
                        <table className="tbl">
                          <thead><tr><th>Ticker</th><th className="num">Premium</th><th className="num">Yield, ann.</th>
                            <th className="num">Calls</th><th className="num">Assigned</th><th className="num">Stock</th></tr></thead>
                          <tbody>
                            {P.byTicker.map((b) => (
                              <tr key={b.ticker}>
                                <td className="tik" style={{ color: hue(b.ticker) }}>{b.ticker}</td>
                                <td className="num" style={{ color: C.premium }}>{money(b.premium)}</td>
                                <td className="num" style={{ fontWeight: 600, color: C.ink }}>{pct(b.yieldAnn, 0)}</td>
                                <td className="num">{b.calls}</td>
                                <td className="num">{b.assigned || ""}</td>
                                <td className="num" style={{ color: b.stock >= 0 ? C.kept : C.danger }}>{signed(b.stock)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : <div className="empty">Nothing to compare yet.</div>}
                </div>

                <div className="card">
                  <div className="card-t">Every position, side by side</div>
                  <p className="card-d">Premium is what the calls paid. Stock is what the shares did. They often disagree.</p>
                  <div className="scroll">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Ticker</th><th className="num">Shares</th><th className="num">Basis</th>
                          <th className="num">Mark</th><th className="num">Calls</th><th className="num">Premium</th>
                          <th className="num">Stock P&amp;L</th><th className="num">Total</th>
                          <th className="num">ROC</th><th className="num">Ann.</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pms.map((p) => (
                          <tr key={p.id} className="clickrow" onClick={() => { setSel(p.id); setTab("position"); }}>
                            <td className="tik" style={{ color: hue(p.ticker) }}>{p.ticker || "n/a"}</td>
                            <td className="num">{p.shares}</td>
                            <td className="num">{money(p.costBasis)}</td>
                            <td className="num">{money(p.mark)}</td>
                            <td className="num">{p.count}</td>
                            <td className="num" style={{ color: C.premium }}>{money(p.totalNet)}</td>
                            <td className="num" style={{ color: p.stockPL >= 0 ? C.kept : C.danger }}>{signed(p.stockPL)}</td>
                            <td className="num" style={{ fontWeight: 600, color: C.ink }}>{signed(p.totalPL)}</td>
                            <td className="num">{pct(p.roc)}</td>
                            <td className="num">{pct(p.annualizedROC, 0)}</td>
                            <td style={{ color: p.isClosed ? C.muted : C.kept }}>{p.isClosed ? `Closed ${p.exitReason}` : "Open"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td><td /><td /><td /><td className="num">{P.tradeCount}</td>
                          <td className="num" style={{ color: C.premium }}>{money(P.totalNet)}</td>
                          <td className="num">{signed(P.realized + P.unrealized)}</td>
                          <td className="num">{signed(P.totalPL)}</td>
                          <td className="num">{pct(P.roc)}</td><td /><td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="grid4">
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="Win rate" value={P.winRate == null ? "n/a" : pct(P.winRate, 0)} tone={C.kept} sub="calls that expired worthless" />
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="Income yield, ann." value={pct(P.incomeYieldAnn, 0)} tone={C.premium} sub="premium against capital deployed" />
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="Avg return per call" value={pct(P.avgAnn, 0)} sub="annualized, per contract" />
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="Upside given away" value={money(P.upsideCapped)} tone={C.assigned}
                      sub={`${P.assignedCount} assignment${P.assignedCount === 1 ? "" : "s"}, stock above strike at expiry`} />
                  </div>
                </div>

                <div className="card">
                  <div className="card-t">Premium ledger, all positions</div>
                  <div className="row"><span>Gross credits received</span><b>{money(P.grossCredit)}</b></div>
                  <div className="row"><span>Paid to buy back</span><b>{P.buybacks ? "-" + money(P.buybacks).slice(1) : money(0)}</b></div>
                  <div className="row"><span>Commissions</span><b>{P.fees ? "-" + money(P.fees).slice(1) : money(0)}</b></div>
                  <div className="row hi"><span>Net premium</span><b style={{ color: C.premium }}>{money(P.totalNet)}</b></div>
                  <div className="row"><span>Upside given away on assignments</span><b style={{ color: C.assigned }}>{P.upsideCapped ? "-" + money(P.upsideCapped).slice(1) : money(0)}</b></div>
                  <div className="row"><span>Premium kept after that</span><b>{money(P.totalNet - P.upsideCapped)}</b></div>
                  <div className="row"><span>Best call</span><b>{P.best ? `${P.best.ticker} ${money(P.best.net)}` : "n/a"}</b></div>
                  <div className="row"><span>Worst call</span><b>{P.worst ? `${P.worst.ticker} ${money(P.worst.net)}` : "n/a"}</b></div>
                  <div className="row"><span>Premium after tax at {settings.taxRate}%</span><b>{money(P.afterTaxNet)}</b></div>
                  <div className="row"><span>Calls open right now</span><b>{P.openCalls}</b></div>
                  <div className="note">
                    <b>Premium is taxed the year you collect it.</b> Every credit here is a short-term gain at ordinary
                    income rates, whether or not you ever sell the shares. Rotating between tickers realizes the stock
                    side too, so an active book generates a tax bill a buy-and-hold position never does.
                  </div>
                </div>
              </>
            )}

            {/* ===================== OPEN CALLS ===================== */}
            {tab === "risk" && (
              <>
                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Open calls against the market</div>
                    <button className="btn sm" onClick={refreshQuotes} disabled={quoteState.busy}>
                      {quoteState.busy ? "Fetching" : "Refresh prices"}
                    </button>
                  </div>
                  <p className="card-d">
                    Sorted by how close the stock is to the strike. The bar puts the strike at center: green means room
                    left, amber means within 3%, red means the stock is already through it. "If assigned" is the full
                    position result if the call finishes in the money: strike minus basis on the covered shares, plus this
                    call's net premium.
                  </p>
                  {risk.length ? (
                    <div className="scroll">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Ticker</th><th className="num">Spot</th><th className="num">Strike</th>
                            <th>Room to strike</th><th className="num"></th><th className="num">Days left</th>
                            <th className="num">Net credit</th><th className="num">Ann.</th>
                            <th className="num">If assigned</th><th className="num">ROC</th><th>Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {risk.map((r) => {
                            const cls = r.room == null ? "" : r.room < 0 ? "itm" : r.room < 0.03 ? "near" : "safe";
                            const label = r.room == null ? "no price" : r.room < 0 ? "in the money" : r.room < 0.03 ? "near strike" : "out of the money";
                            const urgent = r.daysLeft != null && r.daysLeft <= 2;
                            return (
                              <tr key={r.id} className="clickrow" onClick={() => { setSel(r.positionId); setTab("position"); }}>
                                <td className="tik" style={{ color: hue(r.ticker) }}>{r.ticker}</td>
                                <td className="num">{r.spot ? money(r.spot) : "n/a"}</td>
                                <td className="num">{money(r.strike)}</td>
                                <td><RoomBar room={r.room} /></td>
                                <td className="num"><span className={"pill " + cls}>{r.room == null ? label : `${pct(r.room)} ${label}`}</span></td>
                                <td className="num" style={{ color: urgent ? C.assigned : undefined, fontWeight: urgent ? 600 : 400 }}>
                                  {r.daysLeft == null ? "n/a" : r.daysLeft < 0 ? `${-r.daysLeft}d past` : r.daysLeft}
                                </td>
                                <td className="num" style={{ color: C.premium }}>{money(r.net)}</td>
                                <td className="num">{pct(r.annualized, 0)}</td>
                                <td className="num" style={{ color: r.ifAssignedPL >= 0 ? C.kept : C.danger, fontWeight: 600 }}>{signed(r.ifAssignedPL)}</td>
                                <td className="num">{pct(r.ifAssignedROC)}</td>
                                <td>{r.expiry}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="empty">No open calls. Everything on the book has expired, closed, or been assigned.</div>}
                  {risk.some((r) => r.daysLeft != null && r.daysLeft < 0) && (
                    <div className="note">
                      <b>Some open calls are past expiry.</b> Set their outcome on the Trade log (expired, assigned, rolled, or bought back)
                      and fill in the stock price at expiry so the ladder and the win rate stay honest.
                    </div>
                  )}
                </div>
                <div className="grid3">
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="Open credit at risk" value={money(risk.reduce((a, r) => a + r.net, 0))} tone={C.premium} sub="net premium on open calls" />
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="In the money now" value={risk.filter((r) => r.itm).length} tone={C.danger}
                      sub={`${money(risk.reduce((a, r) => a + r.capRisk, 0))} of upside sitting above strikes`} />
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <Stat label="Expiring this week" value={risk.filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 7).length}
                      tone={C.assigned} sub="decisions due" />
                  </div>
                </div>
              </>
            )}

            {/* ===================== POSITION ===================== */}
            {tab === "position" && (
              !current ? <div className="card"><div className="empty">No positions yet. Add one on the Positions tab.</div></div> : (
                <>
                  <div className="card">
                    <div className="card-h">
                      <div className="card-t">
                        <span style={{ color: hue(current.ticker) }}>{current.ticker || "Untitled"}</span>
                        {" "}· {current.shares} shares at {money(current.costBasis)}
                      </div>
                      <div className="seg">
                        {pms.map((p) => (
                          <button key={p.id} className={current.id === p.id ? "on" : ""} onClick={() => setSel(p.id)}>
                            {p.ticker || "n/a"}{p.isClosed ? " (closed)" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="card-d">
                      Each bar is one contract at its strike, from the day sold to expiry. Bars above the price line expired
                      worthless. Hover any bar for the full trade.
                    </p>
                    <StrikeLadder series={priceSeries(current, trades, prices)} trades={current.perTrade} p={current} />
                    <div className="lgd" style={{ justifyContent: "flex-start" }}>
                      {Object.entries(OUTCOME).map(([k, o]) => (
                        <span key={k} className="lgd-i" style={{ cursor: "default" }}><i style={{ background: o.color }} />{o.label}</span>
                      ))}
                      <span className="lgd-i" style={{ cursor: "default" }}><i style={{ background: C.price }} />Price</span>
                      <span className="lgd-i" style={{ cursor: "default" }}><i style={{ background: C.premium }} />Cost basis</span>
                    </div>
                  </div>

                  <div className="grid2">
                    <div className="card">
                      <div className="card-t">Premium on this position</div>
                      <div className="row"><span>Calls sold</span><b>{current.count}</b></div>
                      <div className="row"><span>Gross credits</span><b>{money(current.grossCredit)}</b></div>
                      <div className="row"><span>Buybacks and fees</span><b>{money(current.buybacks + current.fees)}</b></div>
                      <div className="row hi"><span>Net premium</span><b style={{ color: C.premium }}>{money(current.totalNet)}</b></div>
                      <div className="row"><span>Per share</span><b>{money(current.premPerShare, 3)}</b></div>
                      <div className="row"><span>Average per call</span><b>{money(current.avgNet)}</b></div>
                      <div className="row"><span>Win rate</span><b>{current.winRate == null ? "n/a" : pct(current.winRate, 0)}</b></div>
                      <div className="row"><span>Avg annualized per call</span><b>{pct(current.avgAnn, 0)}</b></div>
                      <div className="row"><span>Upside given away</span><b style={{ color: C.assigned }}>{money(current.upsideForgone)}</b></div>
                    </div>
                    <div className="card">
                      <div className="card-t">The shares</div>
                      <div className="row"><span>Capital committed</span><b>{money(current.book)}</b></div>
                      <div className="row"><span>{current.isClosed ? "Exit price" : "Current price"}</span><b>{money(current.mark)}</b></div>
                      <div className="row"><span>Stock P&amp;L</span>
                        <b style={{ color: current.stockPL >= 0 ? C.kept : C.danger }}>{signed(current.stockPL)}</b></div>
                      <div className="row"><span>Effective basis</span><b>{money(current.effBasis, 3)}</b></div>
                      <div className="row"><span>Held</span><b>{Math.round(current.days)} days</b></div>
                      <div className="row hi"><span>Total P&amp;L</span><b>{signed(current.totalPL)}</b></div>
                      <div className="row"><span>Return on capital</span><b>{pct(current.roc)}</b></div>
                      <div className="row"><span>Annualized</span><b>{pct(current.annualizedROC, 0)}</b></div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-h">
                      <div className="card-t">How far {current.ticker || "it"} can fall before the premium is gone</div>
                      <span className="chip">downside cushion</span>
                    </div>
                    <p className="card-d">
                      Every call lowers your break-even. This is the defensive case for selling them, and its limit.
                    </p>
                    <CushionGauge p={current} />
                    <div className="grid3" style={{ marginTop: 18 }}>
                      <Stat label="Calls banked" value={current.count} sub={`${money(current.avgNet)} average`} />
                      <Stat label="A 20% drop costs" value={money(current.book * 0.2)} tone={C.danger}
                        sub={`${Math.ceil((current.book * 0.2) / (current.weeklyPace || 1))} weeks of premium to earn back`} />
                      <Stat label="Avg room above spot"
                        value={(() => {
                          const m = current.perTrade.filter((t) => t.moneyness != null);
                          return m.length ? pct(m.reduce((a, t) => a + t.moneyness, 0) / m.length) : "n/a";
                        })()}
                        sub="how far out you sell" />
                    </div>
                    <div className="note">
                      <b>The yield is the risk, priced.</b> A high annualized premium yield is the options market quoting
                      that stock's implied volatility back to you, not a free lunch. Premium cushions a decline; it does
                      not stop one, and the calls cap your recoveries while every dollar of the fall stays yours.
                    </div>
                  </div>
                </>
              )
            )}

            {/* ===================== TRADE LOG ===================== */}
            {tab === "log" && (
              <div className="card">
                <div className="card-h">
                  <div className="card-t">Calls sold</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div className="seg">
                      <button className={logFilter === "all" ? "on" : ""} onClick={() => setLogFilter("all")}>All</button>
                      {pms.map((p) => (
                        <button key={p.id} className={logFilter === p.id ? "on" : ""} onClick={() => setLogFilter(p.id)}>{p.ticker || "n/a"}</button>
                      ))}
                    </div>
                    <button className="btn sm" disabled={!positions.some((p) => p.status === "open")}
                      onClick={() => addTrade(logFilter !== "all" ? logFilter : (positions.find((p) => p.status === "open") || {}).id)}>
                      Add call
                    </button>
                  </div>
                </div>
                <p className="card-d">
                  Stock at sale and stock at expiry are the share price on those dates, not the option price. Those two
                  build the price line on the ladder. Buyback is what you paid to close early. Edits here are included when you export.
                </p>
                <div className="scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Ticker</th><th>Sold</th><th>Expiry</th><th className="num">Qty</th><th className="num">Strike</th>
                        <th className="num">Credit</th><th className="num">Buyback</th><th className="num">Fees</th>
                        <th className="num">Stock at sale</th><th className="num">Stock at expiry</th>
                        <th>Outcome</th><th className="num">Net</th><th className="num">Ann.</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => (
                        <tr key={t.id}>
                          <td className="tik" style={{ color: hue(t.ticker) }}>{t.ticker}</td>
                          <td><input type="date" value={t.date} onChange={(e) => updTrade(t.id, "date", e.target.value)} /></td>
                          <td><input type="date" value={t.expiry || ""} onChange={(e) => updTrade(t.id, "expiry", e.target.value)} /></td>
                          <td><input type="number" step="1" value={t.contracts} onChange={(e) => updTrade(t.id, "contracts", +e.target.value)} /></td>
                          <td><input type="number" step="0.5" value={t.strike} onChange={(e) => updTrade(t.id, "strike", +e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={t.credit} onChange={(e) => updTrade(t.id, "credit", +e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={t.buyback} onChange={(e) => updTrade(t.id, "buyback", +e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={t.fees} onChange={(e) => updTrade(t.id, "fees", +e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={t.priceAtSale} onChange={(e) => updTrade(t.id, "priceAtSale", e.target.value === "" ? "" : +e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={t.priceAtExpiry} onChange={(e) => updTrade(t.id, "priceAtExpiry", e.target.value === "" ? "" : +e.target.value)} /></td>
                          <td>
                            <select value={t.outcome} onChange={(e) => updTrade(t.id, "outcome", e.target.value)} style={{ color: OUTCOME[t.outcome]?.color }}>
                              {Object.entries(OUTCOME).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="num" style={{ color: t.net >= 0 ? C.premium : C.danger, fontWeight: 600 }}>{money(t.net)}</td>
                          <td className="num">{pct(t.annualized, 0)}</td>
                          <td style={{ display: "flex", gap: 4 }}>
                            {t.outcome === "assigned" && (
                              <button className="btn ghost sm" title="Close the position at this strike" onClick={() => closeAtStrike(t)}>close</button>
                            )}
                            <button className="btn ghost sm" onClick={() => setTrades((a) => a.filter((x) => x.id !== t.id))}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!shown.length && <div className="empty">No calls logged here yet.</div>}
                {P.assignedCount > 0 && (
                  <div className="note">
                    <b>Assigned calls mean shares sold at the strike.</b> Use the close button on an assigned row to shut
                    that position at its strike, then add the position you rotated into. Each position tracks one lot.
                  </div>
                )}
              </div>
            )}

            {/* ===================== PERIODS ===================== */}
            {tab === "periods" && (
              <>
                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Period by period</div>
                    <div className="seg">
                      {[["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]].map(([k, l]) => (
                        <button key={k} className={gran === k ? "on" : ""} onClick={() => setGran(k)}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <p className="card-d">
                    Premium earned in each window against what the shares did. Premium is never negative; the total often is.
                    Hover a legend item to isolate a series.
                  </p>
                  {periods.length ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={periods} margin={{ top: 8, right: 14, left: 0, bottom: 4 }} barGap={2}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="period" tick={axisTick} stroke={C.border} tickLine={false} />
                        <YAxis tick={axisTick} stroke={C.border} tickLine={false} axisLine={false} width={64} tickFormatter={dollarTick} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
                        <ReferenceLine y={0} stroke={C.border} />
                        <Legend content={(pr) => <FocusLegend {...pr} focus={focusB} setFocus={setFocusB} />} />
                        <Bar dataKey="premium" name="Premium" fill={C.premium} fillOpacity={dimB("premium")} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="stock" name="Stock move" fill={C.stock} fillOpacity={dimB("stock")} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="total" name="Net" fill={C.total} fillOpacity={dimB("total")} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty">Nothing to aggregate yet.</div>}
                </div>

                <div className="card">
                  <div className="card-h">
                    <div className="card-t">How the premium was earned</div>
                    <span className="chip">net premium by outcome</span>
                  </div>
                  <p className="card-d">
                    The same premium, split by what happened to the call. A book that keeps its income from calls expiring
                    worthless is a different business from one that keeps getting assigned and rebuying.
                  </p>
                  {periods.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={periods} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="period" tick={axisTick} stroke={C.border} tickLine={false} />
                        <YAxis tick={axisTick} stroke={C.border} tickLine={false} axisLine={false} width={64} tickFormatter={dollarTick} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
                        <Legend content={(pr) => <FocusLegend {...pr} focus={focusC} setFocus={setFocusC} />} />
                        <Bar stackId="o" dataKey="expired" name="Expired worthless" fill={C.kept} fillOpacity={dimC("expired")} />
                        <Bar stackId="o" dataKey="bought_back" name="Bought back" fill={C.stock} fillOpacity={dimC("bought_back")} />
                        <Bar stackId="o" dataKey="rolled" name="Rolled" fill={C.rolled} fillOpacity={dimC("rolled") * 0.6} />
                        <Bar stackId="o" dataKey="assignedNet" name="Assigned" fill={C.assigned} fillOpacity={dimC("assignedNet")} />
                        <Bar stackId="o" dataKey="open" name="Still open" fill={C.open} fillOpacity={dimC("open")} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty">Nothing to split yet.</div>}
                </div>

                <div className="card">
                  <div className="card-t">The numbers behind the bars</div>
                  <div className="scroll">
                    <table className="tbl">
                      <thead><tr><th>Period</th><th className="num">Calls</th><th className="num">Premium</th>
                        <th className="num">Stock move</th><th className="num">Net</th><th className="num">Assigned</th></tr></thead>
                      <tbody>
                        {periods.map((p) => (
                          <tr key={p.period}>
                            <td>{p.period}</td>
                            <td className="num">{p.count}</td>
                            <td className="num" style={{ color: C.premium }}>{money(p.premium)}</td>
                            <td className="num" style={{ color: p.stock >= 0 ? C.kept : C.danger }}>{signed(p.stock)}</td>
                            <td className="num" style={{ fontWeight: 600, color: C.ink }}>{signed(p.total)}</td>
                            <td className="num">{p.assigned || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ===================== BENCHMARKS ===================== */}
            {tab === "bench" && (
              <>
                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Same dollars, three places</div>
                    <span className="chip">capital and dates match your positions exactly</span>
                  </div>
                  <p className="card-d">
                    Each position's capital is put to work on the day you opened it and taken out on the day you closed it
                    (or today), three ways: your covered calls, a savings account at the rate below, and {BENCH} bought on the
                    open date. XIRR uses the same cash flow schedule for all three, so the rates are comparable.
                  </p>
                  {!bench.spyKnown && (
                    <div className="note" style={{ marginTop: 0, marginBottom: 18 }}>
                      <b>{BENCH} needs a price on or before each position's open date.</b> Add closes below
                      {bench.missing.length ? ` (missing for ${[...new Set(bench.missing)].join(", ")})` : ""}. The savings line works without them.
                    </div>
                  )}
                  <div className="grid3">
                    <div>
                      <Stat label="Covered calls" value={signed(bench.ledgerPL)} tone={bench.ledgerPL >= 0 ? C.kept : C.danger}
                        sub={`${pct(bench.ledgerRoc)} on capital · XIRR ${pct(bench.ledgerXirr, 0)}`} />
                    </div>
                    <div>
                      <Stat label={`Savings at ${(+apy || 0).toFixed(2)}%`} value={signed(bench.savingsPL)} tone={C.stock}
                        sub={`${pct(bench.savingsRoc)} on capital · XIRR ${pct(bench.savingsXirr, 0)}`} />
                    </div>
                    <div>
                      <Stat label={BENCH} value={bench.spyPL == null ? "n/a" : signed(bench.spyPL)} tone={C.assigned}
                        sub={bench.spyPL == null ? "add SPY prices below" : `${pct(bench.spyRoc)} on capital · XIRR ${pct(bench.spyXirr, 0)}`} />
                    </div>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={[
                        { name: "Covered calls", pl: bench.ledgerPL, fill: C.kept },
                        { name: "Savings", pl: bench.savingsPL, fill: C.stock },
                        { name: BENCH, pl: bench.spyPL ?? 0, fill: C.assigned },
                      ]} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                        <CartesianGrid stroke={C.borderSoft} horizontal={false} />
                        <XAxis type="number" tick={axisTick} stroke={C.border} tickLine={false} tickFormatter={dollarTick} />
                        <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 11 }} stroke={C.border} tickLine={false} axisLine={false} width={96} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
                        <ReferenceLine x={0} stroke={C.border} />
                        <Bar dataKey="pl" name="P&L" radius={[0, 3, 3, 0]}>
                          {[C.kept, C.stock, C.assigned].map((c, i) => <Cell key={i} fill={c} fillOpacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid2" style={{ marginTop: 10 }}>
                    <Field label="Savings account APY" value={apy} onChange={setApy} suffix="%" step="0.05"
                      hint="High-yield savings or a money market fund. Compounded daily for the comparison." />
                    <div>
                      <span className="fld-l">{BENCH} close on a date</span>
                      <div className="pw">
                        <span className="fld-w" style={{ flex: 1 }}>
                          <input type="date" value={spyEntry.date} onChange={(e) => setSpyEntry((s) => ({ ...s, date: e.target.value }))} />
                        </span>
                        <span className="fld-w" style={{ flex: 1 }}>
                          <input type="number" step="0.01" placeholder="price" value={spyEntry.price}
                            onChange={(e) => setSpyEntry((s) => ({ ...s, price: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") addSpyPoint(); }} />
                        </span>
                        <button className="btn sm" onClick={addSpyPoint} disabled={!(+spyEntry.price > 0)}>Add</button>
                      </div>
                      <span className="fld-h">
                        {bench.spyPoints} point{bench.spyPoints === 1 ? "" : "s"} on file. Refresh prices logs today's {BENCH} close automatically;
                        historical closes need to be typed in (Finnhub's free tier does not serve candles).
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Growth of the capital over time</div>
                    <span className="chip">profit above the dollars deployed</span>
                  </div>
                  <p className="card-d">
                    Cumulative profit on the same capital. Savings compounds quietly, {BENCH} moves with the market on the days you
                    have a close for, and the ledger steps up with each credit and swings with the shares.
                  </p>
                  {benchTl.length > 1 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={benchTl} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="label" tick={axisTick} stroke={C.border} tickLine={false} minTickGap={44} />
                        <YAxis tick={axisTick} stroke={C.border} tickLine={false} axisLine={false} width={64} tickFormatter={dollarTick} />
                        <Tooltip content={<ChartTip />} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                        <ReferenceLine y={0} stroke={C.border} />
                        <Legend content={(pr) => <FocusLegend {...pr} focus={focusD} setFocus={setFocusD} />} />
                        <Line type="monotone" dataKey="ledger" name="Covered calls" stroke={C.kept} strokeWidth={2.5}
                          dot={false} strokeOpacity={dimD("ledger")} activeDot={{ r: 5, strokeWidth: 2, stroke: C.bg }} />
                        <Line type="monotone" dataKey="savings" name="Savings" stroke={C.stock} strokeWidth={1.75}
                          dot={false} strokeOpacity={dimD("savings")} activeDot={{ r: 5, strokeWidth: 2, stroke: C.bg }} />
                        <Line type="stepAfter" dataKey="spy" name={BENCH} stroke={C.assigned} strokeWidth={1.75} connectNulls={false}
                          dot={false} strokeOpacity={dimD("spy")} activeDot={{ r: 5, strokeWidth: 2, stroke: C.bg }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="empty">Log a few trades to draw this.</div>}
                </div>

                <div className="card">
                  <div className="card-t">Position by position</div>
                  <p className="card-d">
                    Where the calls beat the alternatives and where they did not. A tilde on the {BENCH} figure means the nearest
                    close on file was used rather than one on the exact date.
                  </p>
                  <div className="scroll">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Ticker</th><th className="num">Capital</th><th>Window</th><th className="num">Days</th>
                          <th className="num">Calls P&amp;L</th><th className="num">ROC</th>
                          <th className="num">Savings</th><th className="num">ROC</th>
                          <th className="num">{BENCH}</th><th className="num">ROC</th><th className="num">Edge vs {BENCH}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bench.rows.map((r) => (
                          <tr key={r.id} className="clickrow" onClick={() => { setSel(r.id); setTab("position"); }}>
                            <td className="tik" style={{ color: hue(r.ticker) }}>{r.ticker || "n/a"}</td>
                            <td className="num">{money(r.book)}</td>
                            <td>{r.opened} to {r.isClosed ? r.end : "now"}</td>
                            <td className="num">{Math.round(r.days)}</td>
                            <td className="num" style={{ color: r.ledgerPL >= 0 ? C.kept : C.danger, fontWeight: 600 }}>{signed(r.ledgerPL)}</td>
                            <td className="num">{pct(r.ledgerRoc)}</td>
                            <td className="num" style={{ color: C.stock }}>{signed(r.savingsPL)}</td>
                            <td className="num">{pct(r.savingsRoc)}</td>
                            <td className="num" style={{ color: C.assigned }}>{r.spyPL == null ? "n/a" : (r.spyApprox ? "~" : "") + signed(r.spyPL)}</td>
                            <td className="num">{pct(r.spyRoc)}</td>
                            <td className="num" style={{ fontWeight: 600, color: r.spyPL == null ? C.muted : r.ledgerPL - r.spyPL >= 0 ? C.kept : C.danger }}>
                              {r.spyPL == null ? "n/a" : signed(r.ledgerPL - r.spyPL)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td><td className="num">{money(bench.capital)}</td><td /><td />
                          <td className="num">{signed(bench.ledgerPL)}</td><td className="num">{pct(bench.ledgerRoc)}</td>
                          <td className="num">{signed(bench.savingsPL)}</td><td className="num">{pct(bench.savingsRoc)}</td>
                          <td className="num">{bench.spyPL == null ? "n/a" : signed(bench.spyPL)}</td><td className="num">{pct(bench.spyRoc)}</td>
                          <td className="num">{bench.spyPL == null ? "n/a" : signed(bench.ledgerPL - bench.spyPL)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="note">
                    <b>What this does and does not say.</b> The {BENCH} line ignores dividends and the savings line ignores taxes on
                    interest, while your premium is taxed as ordinary income. Over short windows a single earnings move in one
                    ticker will swamp everything. Treat the edge as a question to ask each quarter, not a verdict.
                  </div>
                </div>
              </>
            )}

            {/* ===================== POSITIONS ===================== */}
            {tab === "positions" && (
              <>
                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Positions</div>
                    <button className="btn sm" onClick={addPosition}>Add position</button>
                  </div>
                  <p className="card-d">
                    When you sell out of a stock, set its status to closed and fill in the exit price and date. The ledger
                    moves that P&amp;L from unrealized to realized and keeps every call you sold against it.
                  </p>
                  <div className="scroll">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Ticker</th><th className="num">Shares</th><th className="num">Cost basis</th>
                          <th className="num">Current px</th><th>Opened</th><th>Status</th>
                          <th className="num">Exit px</th><th>Closed</th><th>Reason</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((p) => (
                          <tr key={p.id}>
                            <td><input value={p.ticker} placeholder="SOUN" className="tik"
                              onChange={(e) => updPos(p.id, "ticker", e.target.value.toUpperCase())} style={{ color: hue(p.ticker) }} /></td>
                            <td><input type="number" step="1" value={p.shares} onChange={(e) => updPos(p.id, "shares", +e.target.value)} /></td>
                            <td><input type="number" step="0.01" value={p.costBasis} onChange={(e) => updPos(p.id, "costBasis", +e.target.value)} /></td>
                            <td><input type="number" step="0.01" value={p.price} disabled={p.status === "closed"} onChange={(e) => updPos(p.id, "price", +e.target.value)} /></td>
                            <td><input type="date" value={p.opened} onChange={(e) => updPos(p.id, "opened", e.target.value)} /></td>
                            <td>
                              <select value={p.status} onChange={(e) => updPos(p.id, "status", e.target.value)} style={{ color: p.status === "open" ? C.kept : C.muted }}>
                                <option value="open">Open</option><option value="closed">Closed</option>
                              </select>
                            </td>
                            <td><input type="number" step="0.01" value={p.exitPrice} disabled={p.status === "open"}
                              onChange={(e) => updPos(p.id, "exitPrice", e.target.value === "" ? "" : +e.target.value)} /></td>
                            <td><input type="date" value={p.closedDate} disabled={p.status === "open"} onChange={(e) => updPos(p.id, "closedDate", e.target.value)} /></td>
                            <td>
                              <select value={p.exitReason} disabled={p.status === "open"} onChange={(e) => updPos(p.id, "exitReason", e.target.value)}>
                                <option value="sold">Sold</option><option value="assigned">Assigned</option>
                              </select>
                            </td>
                            <td><button className="btn ghost sm" title="Delete position and its calls"
                              onClick={() => { setPositions((a) => a.filter((x) => x.id !== p.id)); setTrades((a) => a.filter((t) => t.positionId !== p.id)); }}>×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-t">Defaults for new calls</div>
                  <p className="card-d">Used to prefill the row when you add a call. Every value stays editable. These reset when the page reloads.</p>
                  <div className="grid3">
                    <Field label="Premium target" value={settings.premiumPct} onChange={setS("premiumPct")} suffix="% of book" />
                    <Field label="Strike distance" value={settings.otmPct} onChange={setS("otmPct")} suffix="% OTM" step="0.5" />
                    <Field label="Days to expiry" value={settings.dte} onChange={setS("dte")} suffix="days" step="1" />
                    <Field label="Commission per contract" value={settings.contractFee} onChange={setS("contractFee")} suffix="USD" />
                    <Field label="Tax rate on premium" value={settings.taxRate} onChange={setS("taxRate")} suffix="%" step="1" hint="Short-term gain, ordinary income rates." />
                  </div>
                </div>

                <div className="card">
                  <div className="card-t">How each number is built</div>
                  <div className="row"><span>Net premium</span><b>credit - buyback - fees</b></div>
                  <div className="row"><span>Effective basis</span><b>cost basis - net premium per share</b></div>
                  <div className="row"><span>Stock P&amp;L</span><b>(mark - basis) × shares</b></div>
                  <div className="row"><span>Mark</span><b>exit price if closed, else current price</b></div>
                  <div className="row"><span>Return per call, annualized</span><b>(net ÷ collateral) × 365 ÷ days held</b></div>
                  <div className="row"><span>Ticker yield, annualized</span><b>sum of net ÷ sum of (collateral × days) × 365</b></div>
                  <div className="row"><span>If assigned</span><b>(strike - basis) × shares covered + net premium</b></div>
                  <div className="row"><span>Upside given away</span><b>(stock at expiry - strike) × shares, on assigned calls</b></div>
                  <div className="row"><span>Position ROC</span><b>total P&amp;L ÷ capital committed</b></div>
                  <div className="row"><span>Savings benchmark</span><b>capital × (1 + APY) ^ (days ÷ 365) - capital</b></div>
                  <div className="row"><span>{BENCH} benchmark</span><b>capital ÷ {BENCH} at open × {BENCH} at close - capital</b></div>
                  <div className="row"><span>Book XIRR</span><b>rate where every cash flow discounts to zero</b></div>
                  <div className="row"><span>Downside cushion</span><b>net premium per share ÷ cost basis</b></div>
                  <p className="card-d" style={{ marginTop: 16, marginBottom: 0 }}>
                    Collateral is valued at cost basis so per-call returns stay comparable as prices move. Each position
                    tracks a single lot and will not split shares for partial assignment. This is a tracking tool, not tax
                    or investment advice.
                  </p>
                </div>
              </>
            )}

            {/* ===================== DATA ===================== */}
            {tab === "data" && (
              <>
                <div className="grid2">
                  <div className="card">
                    <div className="card-t">Market data</div>
                    <p className="card-d">
                      Quotes come straight from Finnhub over a normal browser request. Your key is held in memory for this
                      page only; it is never stored and never sent anywhere but Finnhub.
                    </p>
                    <label className="fld">
                      <span className="fld-l">Finnhub API key</span>
                      <span className="fld-w">
                        <input type={showKey ? "text" : "password"} value={finnhubKey} onChange={(e) => setFinnhubKey(e.target.value)}
                          placeholder="paste your key" autoComplete="off" spellCheck={false} />
                        <em style={{ cursor: "pointer" }} onClick={() => setShowKey((s) => !s)}>{showKey ? "hide" : "show"}</em>
                      </span>
                      <span className="fld-h">Free at finnhub.io/register. Roughly 60 calls a minute, personal use.</span>
                    </label>
                    <div className="actions" style={{ marginTop: 4 }}>
                      <button className="btn" onClick={refreshQuotes} disabled={quoteState.busy || !finnhubKey.trim()}>
                        {quoteState.busy ? "Fetching" : "Refresh prices"}
                      </button>
                    </div>
                    <div className="scroll" style={{ marginTop: 18 }}>
                      <table className="tbl">
                        <thead><tr><th>Ticker</th><th className="num">Price in use</th><th className="num">Day</th><th>As of</th><th>Source</th></tr></thead>
                        <tbody>
                          {openWithPrice.map((p) => (
                            <tr key={p.id}>
                              <td className="tik" style={{ color: hue(p.ticker) }}>{p.ticker || "n/a"}</td>
                              <td className="num" style={{ color: p.price ? undefined : C.danger }}>{p.price ? money(p.price) : "missing"}</td>
                              <td className="num" style={{ color: p.dayChange == null ? C.muted : p.dayChange >= 0 ? C.kept : C.danger }}>
                                {p.dayChange == null ? "" : (p.dayChange >= 0 ? "+" : "") + p.dayChange.toFixed(2) + "%"}
                              </td>
                              <td>{p.priceUpdated || "n/a"}</td>
                              <td style={{ color: p.priceSource ? C.premium : C.muted }}>{p.priceSource || "by hand"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!openWithPrice.length && <div className="empty">No open positions to price.</div>}
                  </div>

                  <div className="card">
                    <div className="card-t">Your file</div>
                    <p className="card-d">
                      {upload.name ? `Loaded ${upload.name}: ${positions.length} positions, ${trades.length} calls.` : "Nothing uploaded yet."}
                      {" "}Export writes the current ledger, including any edits, back into the template.
                    </p>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="btn" onClick={exportNow}>Export CSV</button>
                      <a className="btn ghost" href={TEMPLATE_URL} download="premium-ledger-template.csv">Blank template</a>
                      <button className="btn ghost" onClick={clearAll}>Clear everything</button>
                    </div>
                    <div className={"drop" + (over ? " over" : "")} style={{ marginTop: 18 }}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                      onDragLeave={() => setOver(false)} onDrop={onDrop}>
                      <b>Replace with another CSV</b>
                      drop it here or click to choose
                      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => loadFile(e.target.files?.[0])} />
                    </div>
                    {(upload.errors.length > 0 || upload.warnings.length > 0) && (
                      <div className="issues">
                        {upload.errors.map((e, i) => <div className="issue err" key={"e" + i}><span>row {e.row}</span>{e.msg}</div>)}
                        {upload.warnings.map((e, i) => <div className="issue warn" key={"w" + i}><span>row {e.row}</span>{e.msg}</div>)}
                      </div>
                    )}
                    {upload.errors.length > 0 && (
                      <div className="note err"><b>The last upload did not load.</b> The ledger on screen is unchanged.</div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-h">
                    <div className="card-t">Price history</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {openWithPrice.filter((p) => p.ticker).map((p) => (
                        <button key={p.id} className="btn sm ghost"
                          onClick={() => setPrices((a) => [...a, { id: uid(), ticker: p.ticker, date: today(), price: p.price }])}>
                          Log {p.ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="card-d">
                    Prices from your trades build the price line automatically. Refreshes land here too. Add points to fill gaps.
                    This list is not part of the export.
                  </p>
                  <div className="scroll">
                    <table className="tbl">
                      <thead><tr><th>Ticker</th><th>Date</th><th className="num">Price</th><th></th></tr></thead>
                      <tbody>
                        {prices.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 150).map((x) => (
                          <tr key={x.id}>
                            <td><input value={x.ticker || ""} onChange={(e) => setPrices((a) => a.map((y) => y.id === x.id ? { ...y, ticker: e.target.value.toUpperCase() } : y))} /></td>
                            <td><input type="date" value={x.date} onChange={(e) => setPrices((a) => a.map((y) => y.id === x.id ? { ...y, date: e.target.value } : y))} /></td>
                            <td><input type="number" step="0.01" value={x.price} onChange={(e) => setPrices((a) => a.map((y) => y.id === x.id ? { ...y, price: +e.target.value } : y))} /></td>
                            <td><button className="btn ghost sm" onClick={() => setPrices((a) => a.filter((y) => y.id !== x.id))}>×</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!prices.length && <div className="empty">No manual price points yet.</div>}
                </div>

                <div className="card">
                  <div className="card-t">Template columns</div>
                  <p className="card-d">Header row must be exactly: <code style={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}>{COLUMNS.join(",")}</code></p>
                  <div className="kv">
                    {COLUMN_HELP.map(([k, v]) => <React.Fragment key={k}><code>{k}</code><span>{v}</span></React.Fragment>)}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
