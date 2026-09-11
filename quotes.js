/* ============================================================
   Finnhub is the only price source. It sends CORS headers, so the
   browser calls it directly and the built copy on GitHub Pages works
   with no proxy and no server. The key lives in React state only.
   ============================================================ */
import { today } from "./engine.js";

export async function fetchQuote(ticker, key) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(key)}`;
  let r;
  try { r = await fetch(url); }
  catch (e) { return { ok: false, why: "network error, check your connection" }; }
  if (r.status === 401 || r.status === 403) return { ok: false, why: "Finnhub rejected the API key" };
  if (r.status === 429) return { ok: false, why: "rate limit hit (60 calls a minute), wait a moment" };
  if (!r.ok) return { ok: false, why: `Finnhub HTTP ${r.status}` };
  const j = await r.json();
  // Unknown symbols come back as a body of zeros rather than an error.
  if (!j || !(+j.c > 0)) return { ok: false, why: `no quote for ${ticker}` };
  return {
    ok: true, price: +j.c, prevClose: +j.pc || null, change: +j.dp || null,
    asOf: j.t ? new Date(j.t * 1000).toISOString().slice(0, 10) : today(),
  };
}

export async function fetchQuotes(tickers, key) {
  if (!key) throw new Error("Add your Finnhub API key on the Data tab first");
  const out = [];
  for (const t of tickers) {
    const res = await fetchQuote(t, key);
    out.push({ ticker: t, ...res });
    if (!res.ok && /rejected the API key/.test(res.why)) throw new Error(res.why);
  }
  return out;
}
