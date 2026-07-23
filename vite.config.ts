import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import replace from "@rollup/plugin-replace";

export default defineConfig({
  plugins: [
    // ponytail: react-router-dom is bundled (not externalized like React),
    // and its CJS source references `process.env.NODE_ENV` at runtime.
    // Vite's `define` is a no-op in lib mode for some reason, so we
    // patch with @rollup/plugin-replace. This is the same workaround
    // we use in late-micro-radio.
    replace({
      preventAssignment: true,
      values: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env": "({})",
      },
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/entry.ts"),
      name: "LateMicroChat",
      formats: ["es"],
      fileName: () => "entry.js",
    },
    rollupOptions: {
      // See late-micro-radio/vite.config.ts for rationale.
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
      output: {
        entryFileNames: "entry.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "style.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5182,
    strictPort: true,
  },
});
