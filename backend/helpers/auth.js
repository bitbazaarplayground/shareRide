// helpers/auth.js
import { supabase } from "../supabaseClient.js";

export async function getUserFromToken(authHeader) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user; // ✅ return Supabase user, not profile
}
