// backend/admin/rides.js
import express from "express";
import { cancelRide } from "../helpers/cancelRide.js";
import { supabase } from "../supabaseClient.js";
import { requireAdmin } from "./middleware.js";

const router = express.Router();

// GET all rides with pool info
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rides")
      .select(
        "id, from, to, date, time, user_id, ride_pools(id, status, min_contributors)"
      )
      .order("date", { ascending: true });

    if (error) throw error;
    res.json({ ok: true, rides: data });
  } catch (err) {
    console.error("Admin list rides error:", err.message);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// Force-cancel (admin)
router.post("/:rideId/cancel", requireAdmin, async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const result = await cancelRide(rideId, {
      isAdmin: true,
      canceledBy: req.user.email,
    });
    res.json(result);
  } catch (err) {
    console.error("Admin cancel ride error:", err.message);
    res.status(500).json({ error: "Admin cancel failed" });
  }
});

export default router;
