// backend/helpers/cancelRide.js
import { supabase } from "../supabaseClient.js";
import { stripe } from "./stripe.js";

export async function cancelRide(rideId, options = {}) {
  const { isAdmin = false, userId = null, canceledBy = null } = options;

  // 1. Load ride
  const { data: ride, error: rErr } = await supabase
    .from("rides")
    .select("id, user_id, from, to, date, time")
    .eq("id", rideId)
    .maybeSingle();

  if (rErr || !ride) return { error: "Ride not found" };

  // 2. Host check (if not admin)
  if (!isAdmin && ride.user_id !== userId) {
    return { error: "Not your ride" };
  }

  // 3. Load pool
  const { data: pool } = await supabase
    .from("ride_pools")
    .select("id, status")
    .eq("ride_id", rideId)
    .maybeSingle();

  const refunded = [];

  if (pool) {
    const { data: contribs } = await supabase
      .from("ride_pool_contributions")
      .select("id, payment_intent_id, status, profiles(email)")
      .eq("ride_pool_id", pool.id);

    for (const c of contribs || []) {
      if (["authorized", "paid"].includes(c.status) && c.payment_intent_id) {
        try {
          if (c.status === "authorized") {
            await stripe.paymentIntents.cancel(c.payment_intent_id);
            await supabase
              .from("ride_pool_contributions")
              .update({ status: "canceled" })
              .eq("id", c.id);
          } else if (c.status === "paid") {
            await stripe.refunds.create({
              payment_intent: c.payment_intent_id,
            });
            await supabase
              .from("ride_pool_contributions")
              .update({ status: "refunded" })
              .eq("id", c.id);
          }
          refunded.push(c.id);
          console.log(
            `📧 [Notify Passenger] Canceled: email → ${c.profiles?.email}`
          );
        } catch (err) {
          console.error("Refund/cancel failed for contrib", c.id, err.message);
        }
      }
    }

    await supabase
      .from("ride_pools")
      .update({ status: "canceled" })
      .eq("id", pool.id);
  }

  // 4. Delete ride
  await supabase.from("rides").delete().eq("id", rideId);

  // 5. Notify host/admin
  console.log(
    `📧 [Notify] Ride canceled by ${
      isAdmin ? `Admin (${canceledBy})` : "Host"
    } from ${ride.from} → ${ride.to} on ${ride.date} ${ride.time}. ${
      refunded.length
    } refunds/cancels issued.`
  );

  return { ok: true, refundedCount: refunded.length, poolId: pool?.id || null };
}
