import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 2010,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:2011", changeOrigin: false } },
  },
  build: {
    chunkSizeWarningLimit: 4000, // Excalidraw e Mermaid são carregados sob demanda
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
