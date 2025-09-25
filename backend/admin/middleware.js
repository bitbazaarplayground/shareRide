// backend/admin/middleware.js
import { getUserFromToken } from "../helpers/auth.js";
import { supabase } from "../supabaseClient.js";

export async function requireAdmin(req, res, next) {
  try {
    const user = await getUserFromToken(req.headers.authorization);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Admin check DB error:", error.message);
      return res.status(500).json({ error: "DB error during admin check" });
    }

    if (!profile?.is_admin) {
      return res.status(403).json({ error: "Forbidden: admin only" });
    }

    // Attach for downstream routes
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    console.error("requireAdmin error:", err.message);
    res.status(500).json({ error: "Admin check failed" });
  }
}
