import React, { useState, useRef } from "react";
import { money, pct, signed, parse, iso, today } from "./engine.js";
import { C, OUTCOME, hue } from "./theme.js";

export const Field = ({ label, value, onChange, type = "number", step = "0.01", suffix, hint }) => (
  <label className="fld">
    <span className="fld-l">{label}</span>
    <span className="fld-w">
      <input type={type} step={step} value={value}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value)} />
      {suffix && <em>{suffix}</em>}
    </span>
    {hint && <span className="fld-h">{hint}</span>}
  </label>
);
export const Stat = ({ label, value, sub, tone }) => (
  <div className="stat">
    <div className="stat-l">{label}</div>
    <div className="stat-v" style={{ color: tone }}>{value}</div>
    {sub && <div className="stat-s">{sub}</div>}
  </div>
);

/* ---- floating tooltip shared by the hand-built SVG charts ---- */
export function useTip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (e, payload) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, ...payload });
  };
  const hide = () => setTip(null);
  return { ref, tip, show, hide };
}
export const TipCard = ({ tip }) => {
  if (!tip) return null;
  const flipX = tip.x > 340;
  return (
    <div className="tipcard" style={{
      left: tip.x, top: tip.y,
      transform: `translate(${flipX ? "calc(-100% - 14px)" : "14px"}, -50%)`,
    }}>
      {tip.title && (
        <div className="tip-t">
          {tip.color && <i style={{ background: tip.color }} />}{tip.title}
        </div>
      )}
      {(tip.rows || []).map(([k, v, tone], i) => (
        <div className="tip-r" key={i}><span>{k}</span><b style={{ color: tone }}>{v}</b></div>
      ))}
    </div>
  );
};

/* ---- recharts tooltip and legend ---- */
export const ChartTip = ({ active, payload, label, prefix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tipcard static">
      <div className="tip-t">{prefix}{label}</div>
      {payload.map((p) => (
        <div className="tip-r" key={p.dataKey}>
          <span><i style={{ background: p.color }} />{p.name}</span>
          <b style={{ color: p.color }}>{signed(p.value)}</b>
        </div>
      ))}
    </div>
  );
};
export const FocusLegend = ({ payload = [], focus, setFocus }) => (
  <div className="lgd">
    {payload.map((e) => {
      const k = e.dataKey;
      const off = focus && focus !== k;
      return (
        <button key={k} type="button" className={"lgd-i" + (off ? " off" : "") + (focus === k ? " on" : "")}
          onMouseEnter={() => setFocus(k)} onMouseLeave={() => setFocus(null)}
          onClick={() => setFocus((f) => (f === k ? null : k))}>
          <i style={{ background: e.color }} />{e.value}
        </button>
      );
    })}
  </div>
);
export const axisTick = { fontSize: 10, fill: C.muted, fontFamily: "IBM Plex Mono" };
export const gridProps = { stroke: C.borderSoft, strokeDasharray: "0", vertical: false };

/* ====== downside cushion: rebuilt so labels can never collide ====== */
export function CushionGauge({ p }) {
  const [hx, setHx] = useState(null);
  const W = 820, H = 150, PX = 12, MAXD = 0.6;
  const inner = W - PX * 2;
  const xOf = (d) => PX + (Math.min(Math.max(d, 0), MAXD) / MAXD) * inner;
  const dOf = (x) => ((x - PX) / inner) * MAXD;

  const basis = +p.costBasis || 0;
  const cushion = p.cushion || 0;
  const drop = basis ? Math.max(0, (basis - p.mark) / basis) : 0;
  const xC = xOf(cushion), xD = xOf(drop);

  const anchorFor = (x) => (x < 84 ? "start" : x > W - 84 ? "end" : "middle");
  const clampX = (x) => Math.max(PX, Math.min(W - PX, x));

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHx(clampX(((e.clientX - r.left) / r.width) * W));
  };
  const hd = hx == null ? null : dOf(hx);
  const hPrice = hd == null ? null : basis * (1 - hd);
  const hNet = hd == null ? null : p.totalNet + (hPrice - basis) * p.shares;

  const TRACK_Y = 46, TRACK_H = 34;

  return (
    <div className="gauge">
      <svg viewBox={`0 0 ${W} ${H}`} className="ladder" onMouseMove={onMove} onMouseLeave={() => setHx(null)}
        role="img" aria-label="How far the stock can fall before collected premium is exhausted">
        <defs>
          <linearGradient id="cushGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.premium} stopOpacity="0.30" />
            <stop offset="100%" stopColor={C.premium} stopOpacity="0.10" />
          </linearGradient>
        </defs>

        {/* row 1: where the price sits now */}
        <text x={clampX(xD)} y={20} textAnchor={anchorFor(xD)} className="gl">price now</text>
        <text x={clampX(xD)} y={36} textAnchor={anchorFor(xD)} className="gv">
          {money(p.mark)}{drop > 0 ? `  (${pct(-drop, 0)})` : ""}
        </text>

        {/* row 2: the track */}
        <rect x={PX} y={TRACK_Y} width={inner} height={TRACK_H} fill={C.surfaceAlt} rx="2" />
        <rect x={PX} y={TRACK_Y} width={Math.max(0, xC - PX)} height={TRACK_H} fill="url(#cushGrad)" rx="2" />
        <line x1={xC} x2={xC} y1={TRACK_Y} y2={TRACK_Y + TRACK_H} stroke={C.premium} strokeWidth="2" />
        <line x1={xD} x2={xD} y1={TRACK_Y - 6} y2={TRACK_Y + TRACK_H + 6} stroke={C.ink} strokeWidth="2" />
        {hx != null && (
          <line x1={hx} x2={hx} y1={TRACK_Y - 6} y2={TRACK_Y + TRACK_H + 6}
            stroke={C.muted} strokeWidth="1" strokeDasharray="3 3" />
        )}

        {/* row 3: what the premium covers */}
        <text x={clampX(xC)} y={TRACK_Y + TRACK_H + 22} textAnchor={anchorFor(xC)} className="gl" fill={C.premium}>
          premium absorbs
        </text>
        <text x={clampX(xC)} y={TRACK_Y + TRACK_H + 38} textAnchor={anchorFor(xC)} className="gv" fill={C.premium}>
          {pct(cushion)} · break-even {money(p.effBasis)}
        </text>

        {/* row 4: scale */}
        {[0, 0.2, 0.4, 0.6].map((d) => (
          <text key={d} x={clampX(xOf(d))} y={H - 6} textAnchor={anchorFor(xOf(d))} className="gs">
            {d === 0 ? "no decline" : pct(-d, 0)}
          </text>
        ))}
      </svg>
      <div className={"gauge-read" + (hx == null ? " idle" : "")}>
        {hx == null
          ? "Hover the track to price a decline"
          : (
            <>
              <span>at {pct(-hd, 0)}</span>
              <b>{money(hPrice)}</b>
              <span>position nets</span>
              <b style={{ color: hNet >= 0 ? C.kept : C.danger }}>{signed(hNet)}</b>
            </>
          )}
      </div>
    </div>
  );
}


/* ====== the book: one lane per position, hoverable ====== */
export function BookTimeline({ pms }) {
  const { ref, tip, show, hide } = useTip();
  const rows = pms.slice().sort((a, b) => (a.opened < b.opened ? -1 : 1));
  if (!rows.length) return <div className="empty">Add a position to see the book.</div>;
  const LH = 46, PL = 76, PR = 108, PT = 12, W = 900;
  const H = PT + rows.length * LH + 28;
  const tMin = Math.min(...rows.map((p) => +parse(p.opened)));
  const tMax = Math.max(+parse(today()), ...rows.map((p) => +parse(p.isClosed && p.closedDate ? p.closedDate : today())));
  const X = (d) => PL + ((+parse(d) - tMin) / Math.max(1, tMax - tMin)) * (W - PL - PR);
  const months = [];
  for (let d = new Date(tMin); +d <= tMax; d.setMonth(d.getMonth() + 1)) months.push(new Date(d.getFullYear(), d.getMonth(), 1));

  return (
    <div className="svgwrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="ladder" role="img" aria-label="Each position's life span with premium earned">
        {months.map((m, i) => (
          <g key={i}>
            <line x1={X(iso(m))} x2={X(iso(m))} y1={PT} y2={H - 26} stroke={C.borderSoft} />
            <text x={X(iso(m))} y={H - 8} textAnchor="middle" className="ax">
              {m.toLocaleDateString("en-US", { month: "short" })}
            </text>
          </g>
        ))}
        {rows.map((p, i) => {
          const y = PT + i * LH + LH / 2;
          const x1 = X(p.opened), x2 = X(p.isClosed && p.closedDate ? p.closedDate : today());
          const c = hue(p.ticker);
          return (
            <g key={p.id} className="lane"
              onMouseMove={(e) => show(e, {
                title: p.ticker || "Untitled", color: c,
                rows: [
                  ["Shares", `${p.shares} at ${money(p.costBasis)}`],
                  ["Calls sold", p.count],
                  ["Premium", money(p.totalNet), C.premium],
                  ["Stock P&L", signed(p.stockPL), p.stockPL >= 0 ? C.kept : C.danger],
                  ["Total", signed(p.totalPL), p.totalPL >= 0 ? C.kept : C.danger],
                  ["Return on capital", pct(p.roc)],
                  ["Held", `${Math.round(p.days)} days`],
                  ["Status", p.isClosed ? `closed ${p.exitReason} at ${money(p.mark)}` : "open"],
                ],
              })}
              onMouseLeave={hide}>
              <rect x={0} y={y - LH / 2} width={W} height={LH} fill="transparent" className="lane-hit" />
              <text x={PL - 12} y={y + 4} textAnchor="end" className="ax lane-tik" style={{ fill: c }}>
                {p.ticker || "n/a"}
              </text>
              <rect x={x1} y={y - 10} width={Math.max(4, x2 - x1)} height={20} fill={c} rx="2"
                opacity={p.isClosed ? 0.3 : 0.7} className="lane-bar" />
              {p.trades.map((t) => (
                <line key={t.id} x1={X(t.date)} x2={X(t.date)} y1={y - 10} y2={y + 10}
                  stroke={C.bg} strokeWidth="1" opacity="0.5" />
              ))}
              {p.isClosed && <line x1={x2} x2={x2} y1={y - 15} y2={y + 15} stroke={C.ink} strokeWidth="2" />}
              <text x={x2 + 10} y={y + 4} className="ax" style={{ fill: C.inkDim }}>
                {money(p.totalNet, 0)} · {p.count}
              </text>
            </g>
          );
        })}
      </svg>
      <TipCard tip={tip} />
    </div>
  );
}

/* ====== strike ladder for one position, hoverable ====== */
export function StrikeLadder({ series, trades, p }) {
  const { ref, tip, show, hide } = useTip();
  const W = 900, H = 330, PL = 56, PR = 18, PT = 18, PB = 34;
  if (series.length < 2) return <div className="empty">Log a couple of trades to draw the ladder.</div>;
  const tMin = Math.min(...series.map((x) => +parse(x.date)), ...trades.map((t) => +parse(t.date)));
  const tMax = Math.max(...series.map((x) => +parse(x.date)), ...trades.map((t) => +parse(t.expiry || t.date)));
  const allP = [...series.map((x) => x.price), ...trades.map((t) => +t.strike || 0).filter(Boolean), +p.costBasis];
  const pMin = Math.min(...allP) * 0.94, pMax = Math.max(...allP) * 1.06;
  const X = (d) => PL + ((+parse(d) - tMin) / Math.max(1, tMax - tMin)) * (W - PL - PR);
  const Y = (v) => PT + (1 - (v - pMin) / Math.max(0.01, pMax - pMin)) * (H - PT - PB);
  const ticks = Array.from({ length: 4 }, (_, i) => pMin + ((pMax - pMin) * i) / 3);
  const path = series.map((x, i) => `${i ? "L" : "M"}${X(x.date).toFixed(1)},${Y(x.price).toFixed(1)}`).join(" ");
  const area = `${path} L${X(series[series.length - 1].date).toFixed(1)},${H - PB} L${X(series[0].date).toFixed(1)},${H - PB} Z`;
  const months = [];
  for (let d = new Date(tMin); +d <= tMax; d.setMonth(d.getMonth() + 1)) months.push(new Date(d.getFullYear(), d.getMonth(), 1));

  return (
    <div className="svgwrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="ladder" role="img"
        aria-label={`${p.ticker} price with each strike drawn across its life`}>
        <defs>
          <linearGradient id="pxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.price} stopOpacity="0.13" />
            <stop offset="100%" stopColor={C.price} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} stroke={C.borderSoft} />
            <text x={PL - 10} y={Y(t) + 4} textAnchor="end" className="ax">${t.toFixed(2)}</text>
          </g>
        ))}
        {months.map((m, i) => (
          <text key={i} x={X(iso(m))} y={H - 12} textAnchor="middle" className="ax">
            {m.toLocaleDateString("en-US", { month: "short" })}
          </text>
        ))}
        <path d={area} fill="url(#pxGrad)" />
        <line x1={PL} x2={W - PR} y1={Y(+p.costBasis)} y2={Y(+p.costBasis)} stroke={C.premium}
          strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
        <text x={W - PR} y={Y(+p.costBasis) - 6} textAnchor="end" className="ax" fill={C.premium}>
          basis {money(p.costBasis)}
        </text>

        {trades.map((t) => {
          if (!t.strike) return null;
          const c = OUTCOME[t.outcome]?.color || C.open;
          const x1 = X(t.date), x2 = Math.max(X(t.expiry || t.date), X(t.date) + 4), y = Y(+t.strike);
          return (
            <g key={t.id} className="strike"
              onMouseMove={(e) => show(e, {
                title: `${money(t.strike)} strike`, color: c,
                rows: [
                  ["Sold", t.date],
                  ["Expiry", t.expiry || "n/a"],
                  ["Contracts", t.contracts],
                  ["Credit", money(t.credit), C.premium],
                  ...(t.buyback ? [["Bought back", money(t.buyback), C.danger]] : []),
                  ["Net", money(t.net), t.net >= 0 ? C.premium : C.danger],
                  ["Annualized", pct(t.annualized, 0)],
                  ...(t.moneyness != null ? [["Room above spot", pct(t.moneyness)]] : []),
                  ["Outcome", OUTCOME[t.outcome]?.label || t.outcome, c],
                ],
              })}
              onMouseLeave={hide}>
              <line x1={x1} x2={x2} y1={y} y2={y} stroke="transparent" strokeWidth="16" />
              <line x1={x1} x2={x2} y1={y} y2={y} stroke={c} strokeWidth="3" strokeLinecap="round"
                className="strike-bar" opacity={t.outcome === "open" ? 0.5 : 0.92} />
              <circle cx={x1} cy={y} r="2.5" fill={c} />
              {t.outcome === "assigned" && <path d={`M${x2},${y} l-4,-8 l8,0 z`} fill={C.assigned} />}
            </g>
          );
        })}

        <path d={path} fill="none" stroke={C.price} strokeWidth="1.75" />
        {series.map((x, i) => (
          <circle key={i} cx={X(x.date)} cy={Y(x.price)} r="9" fill="transparent" className="pxdot"
            onMouseMove={(e) => show(e, {
              title: x.date, color: C.price,
              rows: [
                ["Price", money(x.price)],
                ["vs basis", pct((x.price - p.costBasis) / (p.costBasis || 1)), x.price >= p.costBasis ? C.kept : C.danger],
              ],
            })}
            onMouseLeave={hide} />
        ))}
        {series.slice(-1).map((x) => (
          <circle key="n" cx={X(x.date)} cy={Y(x.price)} r="4" fill={C.price} stroke={C.bg} strokeWidth="2" />
        ))}
      </svg>
      <TipCard tip={tip} />
    </div>
  );
}
