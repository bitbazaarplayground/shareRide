// backend/helpers/bookingStatus.js
import { supabase } from "../supabaseClient.js";

import { getVehicleCapacity } from "./capacity.js";
import { toMinor } from "./pricing.js";

export async function computeBookingStatus(rideId, userId = null) {
  // Load pool
  let { data: pool } = await supabase
    .from("ride_pools")
    .select(
      "id, status, currency, min_contributors, " +
        "total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large, " +
        "total_collected_user_share_minor, total_collected_platform_fee_minor, " +
        "booker_user_id, booking_code, code_expires_at, code_issued_at"
    )
    .eq("ride_id", rideId)
    .maybeSingle();

  if (!pool) {
    // Auto-create pool if missing
    const { data: rideData } = await supabase
      .from("rides")
      .select(
        "user_id, seats, backpack_count, small_suitcase_count, large_suitcase_count"
      )
      .eq("id", rideId)
      .single();
    if (!rideData?.user_id) throw new Error("Ride not found");

    const { data: newPool } = await supabase
      .from("ride_pools")
      .insert({
        ride_id: rideId,
        currency: "gbp",
        booker_user_id: rideData.user_id,
        status: "collecting",
      })
      .select("*")
      .single();
    pool = newPool;

    if (!pool?.id) {
      throw new Error(
        `No ride_pools row could be created for rideId=${rideId}`
      );
    }

    // Insert host contribution baseline
    await supabase.from("ride_pool_contributions").insert({
      ride_pool_id: pool.id,
      user_id: rideData.user_id,
      currency: "gbp",
      user_share_minor: 0,
      platform_fee_minor: 0,
      seats_reserved: Number(rideData.seats ?? 1),
      backpacks_reserved: Number(rideData.backpack_count ?? 0),
      small_reserved: Number(rideData.small_suitcase_count ?? 0),
      large_reserved: Number(rideData.large_suitcase_count ?? 0),
      status: "pending",
      is_host: true,
    });
  }

  // Ride + vehicle capacity
  const { data: ride } = await supabase
    .from("rides")
    .select(
      "vehicle_type, seat_limit, seats, backpack_count, small_suitcase_count, large_suitcase_count, luggage_limit, estimated_fare"
    )
    .eq("id", rideId)
    .single();

  if (!ride) throw new Error("Ride not found");

  const {
    seat: seatCap,
    backpack: bCap,
    small: sCap,
    large: lCap,
  } = getVehicleCapacity(ride.vehicle_type);

  // Already paid contributions
  const { data: paidRows } = await supabase
    .from("ride_pool_contributions")
    .select(
      "user_id, seats_reserved, checked_in_at, is_host, backpacks_reserved, small_reserved, large_reserved"
    )
    .eq("ride_pool_id", pool.id)
    .eq("status", "paid");

  const paidSeats = (paidRows || []).reduce(
    (sum, r) => sum + (Number(r.seats_reserved) || 0),
    0
  );
  const paidB = (paidRows || []).reduce(
    (sum, r) => sum + (Number(r.backpacks_reserved) || 0),
    0
  );
  const paidS = (paidRows || []).reduce(
    (sum, r) => sum + (Number(r.small_reserved) || 0),
    0
  );
  const paidL = (paidRows || []).reduce(
    (sum, r) => sum + (Number(r.large_reserved) || 0),
    0
  );

  // Host baseline (always reserved)
  const hostSeats = Number(ride?.seats ?? 1);
  const hostB = Number(ride?.backpack_count ?? 0);
  const hostS = Number(ride?.small_suitcase_count ?? 0);
  const hostL = Number(ride?.large_suitcase_count ?? 0);

  // Remaining after host + paid
  const remainingSeats = Math.max(seatCap - (hostSeats + paidSeats), 0);
  const rB = Math.max(0, bCap - (hostB + paidB));
  const rS = Math.max(0, sCap - (hostS + paidS));
  const rL = Math.max(0, lCap - (hostL + paidL));

  // total luggage mode fallback
  const totalCap = Number(ride?.luggage_limit ?? 0);
  const rTotal =
    totalCap > 0
      ? Math.max(0, totalCap - (hostB + hostS + hostL + paidB + paidS + paidL))
      : 0;

  const luggageObj =
    bCap > 0 || sCap > 0 || lCap > 0
      ? {
          mode: "byKind",
          byKind: {
            backpacks: { limit: bCap, remaining: rB },
            small: { limit: sCap, remaining: rS },
            large: { limit: lCap, remaining: rL },
          },
          total: { limit: 0, remaining: 0 },
        }
      : totalCap > 0
        ? {
            mode: "total",
            byKind: {},
            total: { limit: totalCap, remaining: rTotal },
          }
        : { mode: "none", byKind: {}, total: { limit: 0, remaining: 0 } };

  const estimateMinor = toMinor(Number(ride?.estimated_fare ?? 35));
  const groupSize = Math.max(hostSeats + paidSeats, 1);
  const perSeatMinor = Math.max(1, Math.round(estimateMinor / groupSize));
  const checkedInCount = (paidRows || []).filter(
    (r) => !!r.checked_in_at
  ).length;

  const required = pool.min_contributors || 2;
  const quorumMet = checkedInCount >= required;

  // ✅ NEW: hostPaid derived from contributions
  const hostContribution = (paidRows || []).find((r) => r.is_host);
  const hostPaid = !!hostContribution;

  let bookingStatus;
  if (pool.status === "canceled") {
    bookingStatus = "canceled";
  } else if (hostPaid && paidSeats >= 2) {
    bookingStatus = "confirmed";
  } else if (paidSeats >= 1) {
    bookingStatus = "pending";
  } else {
    bookingStatus = "unpaid"; // internal only
  }

  return {
    exists: true,
    capacity: {
      seats: { limit: seatCap },
      luggage: luggageObj,
    },
    paidSeats,
    remainingSeats,
    estimateMinor,
    perSeatMinor,
    codeActive: !!(
      pool.booking_code &&
      pool.code_expires_at &&
      new Date(pool.code_expires_at) > new Date()
    ),
    codeIssuedAt: pool.code_issued_at,
    codeExpiresAt: pool.code_expires_at,
    checkedInCount,
    required,
    quorumMet,
    status: bookingStatus,
    isBooker: userId && pool.booker_user_id === userId,
  };
}
