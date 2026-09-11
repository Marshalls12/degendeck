import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes every asset path relative, so the same build works at
// https://<user>.github.io/<repo>/ and at the root of a custom domain.
// No proxy: Finnhub sends CORS headers, so the browser talks to it directly.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173, open: true },
  preview: { port: 4173 },
});
