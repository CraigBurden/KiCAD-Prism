import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  root: __dirname,
  base: "/remote-provider/assets/",
  build: {
    outDir: path.resolve(__dirname, "dist/remote_provider"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "panel.html"),
      output: {
        entryFileNames: "panel.js",
        assetFileNames: "panel[extname]",
        chunkFileNames: "panel-[name].js",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/oauth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
