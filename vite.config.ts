import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  envPrefix: ["VITE_", "LLM_ADVISORY_TIMEOUT_MS", "OPENCLAW_ADVISORY_URL", "OPENCLAW_ADVISORY_TIMEOUT_MS"],
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    proxy: {
      "/gotrader-research-mcp": {
        target: "http://127.0.0.1:7332",
        changeOrigin: false,
        rewrite: (requestPath) => requestPath.replace(/^\/gotrader-research-mcp/, ""),
        headers: process.env.GOTRADER_RESEARCH_MCP_TOKEN
          ? { Authorization: `Bearer ${process.env.GOTRADER_RESEARCH_MCP_TOKEN}` }
          : undefined
      }
    }
  }
});
