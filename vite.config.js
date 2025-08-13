// vite.config.js
// @ts-check

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** @type {import('vite').UserConfig} */
const config = {
  base: "/",
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
};

export default defineConfig(config);
