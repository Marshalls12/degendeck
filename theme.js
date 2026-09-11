/* Cool dark palette: cyan carries premium, periwinkle the shares,
   mint the combined result. Warm tones are reserved for warnings. */
export const C = {
  bg: "#0E121A", surface: "#151B26", surfaceAlt: "#1B2331", raised: "#202A3A",
  border: "#2A3546", borderSoft: "#212B3A",
  ink: "#E6ECF5", inkDim: "#B7C3D4", muted: "#7C8AA0", faint: "#55627A",
  premium: "#4FC3E8", premiumSoft: "rgba(79,195,232,0.16)",
  stock: "#8A97F5", total: "#5AD1A8", kept: "#5AD1A8",
  assigned: "#D8A64A", rolled: "#8A97F5", open: "#7C8AA0",
  danger: "#EE6E8A", price: "#E6ECF5",
};
export const TICKER_HUES = ["#4FC3E8", "#8A97F5", "#5AD1A8", "#D8A64A", "#B98CF0", "#59B8C4", "#EE6E8A"];
export const hue = (t = "") => TICKER_HUES[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % TICKER_HUES.length];

export const OUTCOME = {
  open: { label: "Open", color: C.open },
  expired: { label: "Expired worthless", color: C.kept },
  assigned: { label: "Assigned", color: C.assigned },
  rolled: { label: "Rolled", color: C.rolled },
  bought_back: { label: "Bought back", color: C.stock },
};
