// backend/admin/users.js
import express from "express";
import { supabase } from "../supabaseClient.js";
import { requireAdmin } from "./middleware.js";

const router = express.Router();

// GET all users
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, created_at, is_admin");

    if (error) throw error;
    res.json({ ok: true, users: data });
  } catch (err) {
    console.error("Admin users list error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
