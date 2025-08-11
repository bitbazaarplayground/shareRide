import dotenv from "dotenv";
import path from "node:path";

// Load backend/.env relative to project root
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

console.log("SUPABASE_URL =", process.env.SUPABASE_URL || "(missing)");
console.log(
  "SUPABASE_SERVICE_ROLE_KEY present =",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);
console.log("GOOGLE_MAPS_KEY present =", !!process.env.GOOGLE_MAPS_KEY);
