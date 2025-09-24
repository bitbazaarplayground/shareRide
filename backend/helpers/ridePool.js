// backend/helpers/ridePool.js
import { supabase } from "../supabaseClient.js";

export async function recalcAndMaybeMarkBookable(ridePoolId) {
  const { data: contribs, error: cErr } = await supabase
    .from("ride_pool_contributions")
    .select(
      "user_share_minor, platform_fee_minor, seats_reserved, backpacks_reserved, small_reserved, large_reserved, status"
    )
    .eq("ride_pool_id", ridePoolId);
  if (cErr) throw new Error(cErr.message);

  const paid = (contribs || []).filter((c) => c.status === "paid");

  const totalUserShareMinor = paid.reduce(
    (s, c) => s + (c.user_share_minor || 0),
    0
  );
  const totalFeesMinor = paid.reduce(
    (s, c) => s + (c.platform_fee_minor || 0),
    0
  );

  const paidSeats = paid.reduce((s, c) => s + (c.seats_reserved || 0), 0);
  const paidBackpacks = paid.reduce(
    (s, c) => s + (c.backpacks_reserved || 0),
    0
  );
  const paidSmall = paid.reduce((s, c) => s + (c.small_reserved || 0), 0);
  const paidLarge = paid.reduce((s, c) => s + (c.large_reserved || 0), 0);

  const { data: poolRow, error: pGetErr } = await supabase
    .from("ride_pools")
    .select("id, status, min_contributors")
    .eq("id", ridePoolId)
    .single();
  if (pGetErr) throw new Error(pGetErr.message);

  const minSeats = Math.max(2, poolRow?.min_contributors || 2);

  const advancedStates = new Set([
    "checking_in",
    "ready_to_book",
    "booking",
    "booked",
    "paid",
  ]);
  let nextStatus = poolRow.status;
  if (!advancedStates.has(poolRow.status)) {
    nextStatus = paidSeats >= minSeats ? "bookable" : "collecting";
  }

  const { error: pUpdErr } = await supabase
    .from("ride_pools")
    .update({
      total_reserved_seats: paidSeats,
      total_reserved_backpacks: paidBackpacks,
      total_reserved_small: paidSmall,
      total_reserved_large: paidLarge,
      total_collected_user_share_minor: totalUserShareMinor,
      total_collected_platform_fee_minor: totalFeesMinor,
      status: nextStatus,
    })
    .eq("id", ridePoolId);
  if (pUpdErr) throw new Error(pUpdErr.message);
}

export function buildUberDeepLink(ride) {
  const base = "https://m.uber.com/ul/?action=setPickup";
  const params = new URLSearchParams();
  if (ride?.from_lat && ride?.from_lng) {
    params.append("pickup[latitude]", String(ride.from_lat));
    params.append("pickup[longitude]", String(ride.from_lng));
  }
  if (ride?.from) params.append("pickup[nickname]", ride.from.slice(0, 60));
  if (ride?.to_lat && ride?.to_lng) {
    params.append("dropoff[latitude]", String(ride.to_lat));
    params.append("dropoff[longitude]", String(ride.to_lng));
  }
  if (ride?.to) params.append("dropoff[nickname]", ride.to.slice(0, 60));
  const q = params.toString();
  return q ? `${base}&${q}` : base;
}
