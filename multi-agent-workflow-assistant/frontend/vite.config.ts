import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Why: keep the dev server on a fixed port and proxy /api to the FastAPI
// backend so the browser talks to one origin in development (no CORS dance,
// and SSE streams through cleanly).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
