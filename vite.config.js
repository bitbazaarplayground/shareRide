import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/shareRide/",
  plugins: [react()],
  server: {
    host: true,
    port: process.env.PORT || 5173,
  },
});
