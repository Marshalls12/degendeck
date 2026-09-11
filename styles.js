export const makeCss = (C) => `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
.root{--ink:${C.ink};--dim:${C.inkDim};--muted:${C.muted};--bd:${C.border};--bds:${C.borderSoft};--prem:${C.premium};
 --sh:0 1px 2px rgba(0,0,0,.5), 0 10px 28px -14px rgba(0,0,0,.9);
 --sh2:0 2px 4px rgba(0,0,0,.55), 0 18px 44px -18px rgba(0,0,0,1);
 background:${C.bg};color:var(--ink);font-family:'IBM Plex Sans',system-ui,sans-serif;
 min-height:100vh;padding:22px;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}
.root *{box-sizing:border-box;}
.wrap{max-width:1160px;margin:0 auto;}
.hdr{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;justify-content:space-between;padding-bottom:18px;}
.h-ttl{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(26px,4vw,38px);
 line-height:.95;letter-spacing:-.03em;margin:0;color:var(--ink);}
.h-sub{color:var(--muted);font-size:12.5px;margin-top:8px;max-width:58ch;}
.h-r{display:flex;flex-direction:column;align-items:flex-end;gap:7px;}
.h-save{font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;min-height:14px;text-align:right;max-width:34ch;}

.verdict{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;}
.v-cell{flex:1 1 172px;padding:15px 17px;background:${C.surface};border:1px solid var(--bd);border-radius:8px;
 box-shadow:var(--sh);transition:border-color .16s, transform .16s, box-shadow .16s;}
.v-cell:hover{border-color:${C.raised};transform:translateY(-1px);box-shadow:var(--sh2);}
.v-l{font-size:9.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);
 font-family:'IBM Plex Mono',monospace;margin-bottom:7px;}
.v-v{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:22px;letter-spacing:-.025em;font-variant-numeric:tabular-nums;}
.v-s{font-size:11.5px;color:var(--muted);margin-top:4px;}

.tabs{display:flex;gap:4px;margin-bottom:22px;flex-wrap:wrap;}
.tab{padding:8px 15px;border:1px solid var(--bd);background:${C.surface};cursor:pointer;font-size:12px;
 border-radius:6px;font-weight:500;letter-spacing:.03em;color:var(--muted);font-family:'IBM Plex Mono',monospace;
 transition:all .15s;}
.tab:hover{background:${C.surfaceAlt};color:var(--ink);border-color:${C.raised};}
.tab.on{background:${C.raised};color:var(--ink);border-color:${C.premium};box-shadow:0 0 0 1px ${C.premiumSoft};}
.tab:focus-visible{outline:2px solid ${C.premium};outline-offset:2px;}

.card{background:${C.surface};border:1px solid var(--bd);border-radius:10px;padding:20px 22px;margin-bottom:16px;
 box-shadow:var(--sh);}
.card-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px;}
.card-t{font-family:'Bricolage Grotesque',sans-serif;font-weight:600;font-size:16px;letter-spacing:-.015em;}
.card-d{font-size:12.5px;color:var(--muted);margin:0 0 18px;max-width:78ch;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
@media(max-width:880px){.grid2,.grid3,.grid4{grid-template-columns:1fr 1fr;}}
@media(max-width:560px){.grid2,.grid3,.grid4{grid-template-columns:1fr;}}

.row{display:flex;justify-content:space-between;gap:12px;padding:8px 6px;border-radius:4px;font-size:13px;
 color:var(--dim);transition:background .12s;}
.row:hover{background:${C.surfaceAlt};}
.row b{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-weight:500;color:var(--ink);}
.row.hi{border-top:1px solid var(--bd);margin-top:8px;padding-top:12px;border-radius:0 0 4px 4px;}
.row.hi span{font-weight:600;color:var(--ink);} .row.hi b{font-size:15px;font-weight:600;}

.stat{padding:2px 0;}
.stat-l{font-size:9.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);
 font-family:'IBM Plex Mono',monospace;margin-bottom:6px;}
.stat-v{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:21px;font-variant-numeric:tabular-nums;letter-spacing:-.025em;}
.stat-s{font-size:11px;color:var(--muted);margin-top:3px;}

.ladder{width:100%;height:auto;display:block;overflow:visible;}
.ax{font-family:'IBM Plex Mono',monospace;font-size:9.5px;fill:${C.muted};}
.gl{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;fill:${C.muted};}
.gv{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;fill:${C.ink};}
.gs{font-family:'IBM Plex Mono',monospace;font-size:9.5px;fill:${C.faint};}
.svgwrap{position:relative;}
.lane .lane-bar,.lane .lane-tik{transition:opacity .15s;}
.lane:hover .lane-bar{opacity:1;}
.lane .lane-hit{cursor:crosshair;}
.lane:hover .lane-hit{fill:rgba(255,255,255,.025);}
.strike{cursor:crosshair;}
.strike:hover .strike-bar{stroke-width:5;opacity:1;}
.pxdot{cursor:crosshair;}
.gauge svg{cursor:crosshair;}
.gauge-read{margin-top:10px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;
 font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--dim);
 background:${C.surfaceAlt};border:1px solid var(--bds);border-radius:6px;padding:9px 13px;min-height:38px;}
.gauge-read.idle{color:var(--faint);font-style:normal;opacity:.6;}
.gauge-read span{color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
.gauge-read b{font-size:14px;font-weight:600;color:var(--ink);}

.tipcard{position:absolute;z-index:40;pointer-events:none;background:${C.raised};border:1px solid ${C.border};
 border-radius:8px;padding:10px 12px;box-shadow:var(--sh2);min-width:180px;max-width:280px;}
.tipcard.static{position:static;transform:none;}
.tip-t{font-family:'IBM Plex Mono',monospace;font-size:11.5px;font-weight:600;color:var(--ink);
 margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid ${C.border};display:flex;align-items:center;gap:7px;}
.tip-t i,.tip-r i{display:inline-block;width:8px;height:8px;border-radius:2px;flex:none;margin-right:6px;}
.tip-r{display:flex;justify-content:space-between;gap:14px;font-size:11.5px;padding:2.5px 0;
 font-family:'IBM Plex Mono',monospace;}
.tip-r span{color:var(--muted);display:flex;align-items:center;}
.tip-r b{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;}

.lgd{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding-top:10px;}
.lgd-i{display:flex;align-items:center;gap:7px;background:transparent;border:1px solid transparent;
 border-radius:5px;padding:4px 9px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;
 color:var(--muted);transition:all .15s;}
.lgd-i i{width:9px;height:9px;border-radius:2px;display:inline-block;transition:transform .15s;}
.lgd-i:hover{color:var(--ink);background:${C.surfaceAlt};border-color:var(--bd);}
.lgd-i.on{color:var(--ink);background:${C.surfaceAlt};border-color:${C.premium};}
.lgd-i.on i{transform:scale(1.25);}
.lgd-i.off{opacity:.35;}
.lgd-i:focus-visible{outline:2px solid ${C.premium};outline-offset:2px;}

.fld{display:block;margin-bottom:15px;}
.fld-l{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);
 font-family:'IBM Plex Mono',monospace;margin-bottom:6px;}
.fld-w{display:flex;border:1px solid var(--bd);background:${C.bg};border-radius:6px;overflow:hidden;transition:all .15s;}
.fld-w:focus-within{border-color:${C.premium};box-shadow:0 0 0 3px ${C.premiumSoft};}
.fld-w input{flex:1;border:none;padding:9px 11px;font-family:'IBM Plex Mono',monospace;font-size:13.5px;
 background:transparent;color:var(--ink);min-width:0;}
.fld-w input:focus{outline:none;}
.fld-w em{display:flex;align-items:center;padding:0 11px;background:${C.surfaceAlt};font-style:normal;font-size:11px;
 color:var(--muted);font-family:'IBM Plex Mono',monospace;border-left:1px solid var(--bd);white-space:nowrap;}
.fld-h{display:block;font-size:11px;color:var(--muted);margin-top:5px;}

.btn{padding:9px 16px;border:1px solid ${C.border};background:${C.raised};color:var(--ink);font-size:12px;
 border-radius:6px;font-weight:500;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;
 transition:all .15s;box-shadow:var(--sh);}
.btn:hover{background:${C.border};border-color:${C.premium};}
.btn:disabled{opacity:.4;cursor:not-allowed;}
.btn:disabled:hover{background:${C.raised};border-color:${C.border};}
.btn.ghost{background:transparent;box-shadow:none;color:var(--dim);}
.btn.ghost:hover{background:${C.surfaceAlt};color:var(--ink);}
.btn.sm{padding:5px 10px;font-size:11px;}
.btn:focus-visible{outline:2px solid ${C.premium};outline-offset:2px;}

.tbl{width:100%;border-collapse:collapse;font-size:12.5px;}
.tbl th{text-align:left;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);
 font-family:'IBM Plex Mono',monospace;font-weight:500;padding:9px 9px;border-bottom:1px solid var(--bd);white-space:nowrap;}
.tbl td{padding:7px 9px;border-bottom:1px solid var(--bds);font-family:'IBM Plex Mono',monospace;
 font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dim);}
.tbl tbody tr{transition:background .12s;}
.tbl tbody tr:hover td{background:${C.surfaceAlt};color:var(--ink);}
.tbl .num{text-align:right;}
.tbl tfoot td{border-top:1px solid var(--bd);border-bottom:none;font-weight:600;color:var(--ink);}
.scroll{overflow-x:auto;}
.tbl input,.tbl select{border:1px solid transparent;background:transparent;padding:4px 5px;width:100%;border-radius:4px;
 font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);min-width:64px;transition:all .12s;}
.tbl input:hover,.tbl select:hover{border-color:var(--bd);background:${C.bg};}
.tbl input:focus,.tbl select:focus{outline:none;border-color:${C.premium};background:${C.bg};}
.tbl select option{background:${C.raised};color:var(--ink);}
.tbl input:disabled{opacity:.3;}
.tik{font-weight:600;letter-spacing:.05em;}

.seg{display:inline-flex;border:1px solid var(--bd);border-radius:6px;overflow:hidden;flex-wrap:wrap;}
.seg button{padding:6px 13px;border:none;background:${C.surface};cursor:pointer;font-size:11px;
 font-family:'IBM Plex Mono',monospace;color:var(--muted);border-right:1px solid var(--bd);transition:all .15s;}
.seg button:last-child{border-right:none;}
.seg button:hover{background:${C.surfaceAlt};color:var(--ink);}
.seg button.on{background:${C.raised};color:var(--ink);box-shadow:inset 0 -2px 0 ${C.premium};}

.note{border-left:2px solid ${C.assigned};background:${C.surfaceAlt};padding:13px 16px;font-size:12.5px;
 margin-top:18px;border-radius:0 6px 6px 0;color:var(--dim);}
.note b{font-weight:600;color:var(--ink);}
.note.err{border-left-color:${C.danger};}
.empty{padding:38px 20px;text-align:center;color:var(--muted);font-size:13px;}
.chip{display:inline-block;font-size:9.5px;font-family:'IBM Plex Mono',monospace;letter-spacing:.12em;
 text-transform:uppercase;padding:3px 9px;border:1px solid var(--bd);border-radius:20px;color:var(--muted);}
.qstat{font-size:11px;font-family:'IBM Plex Mono',monospace;color:var(--muted);text-align:right;max-width:36ch;}
.qstat.err{color:${C.danger};}
.clickrow{cursor:pointer;}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;}}
/* v3 additions */
.tabs{position:sticky;top:0;z-index:20;background:${C.bg};padding-top:6px;padding-bottom:6px;margin-bottom:16px;}
.risk-bar{position:relative;height:10px;border-radius:5px;background:${C.surfaceAlt};min-width:150px;overflow:hidden;}
.risk-bar i{position:absolute;top:0;bottom:0;}
.risk-bar b{position:absolute;top:-2px;width:3px;height:14px;background:${C.ink};border-radius:1px;}
.pill{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10.5px;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;}
.pill.itm{background:rgba(238,110,138,.16);color:${C.danger};}
.pill.near{background:rgba(216,166,74,.16);color:${C.assigned};}
.pill.safe{background:rgba(90,209,168,.14);color:${C.kept};}
.drop{border:1.5px dashed var(--bd);border-radius:10px;padding:26px 20px;text-align:center;color:var(--muted);
 font-size:13px;transition:all .15s;cursor:pointer;background:${C.bg};}
.drop:hover,.drop.over{border-color:${C.premium};color:var(--ink);background:${C.surfaceAlt};}
.drop input{display:none;}
.drop b{display:block;color:var(--ink);font-size:14px;margin-bottom:4px;}
.issues{margin-top:14px;max-height:260px;overflow:auto;border:1px solid var(--bd);border-radius:6px;}
.issue{display:flex;gap:12px;padding:7px 12px;font-size:12px;font-family:'IBM Plex Mono',monospace;border-bottom:1px solid var(--bds);}
.issue:last-child{border-bottom:none;}
.issue span{color:var(--muted);flex:none;width:64px;}
.issue.err{color:${C.danger};} .issue.warn{color:${C.assigned};}
.welcome{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;}
@media(max-width:880px){.welcome{grid-template-columns:1fr;}}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
.kv{display:grid;grid-template-columns:150px 1fr;gap:6px 14px;font-size:12px;color:var(--dim);}
.kv code{font-family:'IBM Plex Mono',monospace;color:var(--ink);font-size:11.5px;}
.banner{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:${C.surfaceAlt};border:1px solid var(--bds);
 border-radius:8px;padding:10px 14px;font-size:12px;color:var(--dim);margin-bottom:18px;}
.banner b{color:${C.assigned};font-weight:600;}
.banner .sp{flex:1;}
.pw{display:flex;gap:8px;align-items:center;}
`;
