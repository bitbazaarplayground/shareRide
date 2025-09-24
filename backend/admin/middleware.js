// backend/admin/middleware.js
import { supabase } from "../supabaseClient.js";

export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Invalid token" });

    // Lookup profile for is_admin flag
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: "Not an admin" });
    }

    req.adminUser = user;
    next();
  } catch (e) {
    console.error("requireAdmin error:", e);
    res.status(500).json({ error: "Admin check failed" });
  }
}
