// @ts-check
import react from "@vitejs/plugin-react";
import fs from "fs";
import { defineConfig } from "vite";

/**
 * Plugin to copy _redirects from public/ to dist/
 * @returns {import('vite').Plugin}
 */
function copyRedirects() {
  return {
    name: "copy-redirects",
    closeBundle() {
      fs.copyFileSync("public/_redirects", "dist/_redirects");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), copyRedirects()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173, // ✅ ensure number type
  },
});

// import react from "@vitejs/plugin-react";
// import { defineConfig } from "vite";

// export default defineConfig({
//   base: "/",
//   plugins: [react()],
//   server: {
//     host: true,
//     port: process.env.PORT || 5173,
//   },
// });
