// scripts/backfill-ride-coords.mjs
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") }); // <-- point to backend env

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GOOGLE_MAPS_KEY) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_MAPS_KEY in backend/.env"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function geocode(address) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", GOOGLE_MAPS_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK" || !json.results?.length) return null;
  const loc = json.results[0].geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

// simple rate-limiter
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function backfillBatch(limit = 50) {
  // fetch rides missing either origin or destination coords
  const { data: rides, error } = await supabase
    .from("rides")
    .select("id, from, to, from_lat, from_lng, to_lat, to_lng")
    .or("from_lat.is.null,from_lng.is.null,to_lat.is.null,to_lng.is.null")
    .limit(limit);

  if (error) throw error;
  if (!rides || rides.length === 0) {
    console.log("No rides need backfilling. ✅");
    return false;
  }

  console.log(`Found ${rides.length} rides to process...`);

  for (const r of rides) {
    let fromLat = r.from_lat,
      fromLng = r.from_lng;
    let toLat = r.to_lat,
      toLng = r.to_lng;

    try {
      if (r.from && (fromLat == null || fromLng == null)) {
        const g = await geocode(r.from);
        if (g) {
          fromLat = g.lat;
          fromLng = g.lng;
        }
        await sleep(150); // be nice to Google
      }
      if (r.to && (toLat == null || toLng == null)) {
        const g = await geocode(r.to);
        if (g) {
          toLat = g.lat;
          toLng = g.lng;
        }
        await sleep(150);
      }

      if (
        fromLat != null &&
        fromLng != null &&
        toLat != null &&
        toLng != null
      ) {
        const { error: upErr } = await supabase
          .from("rides")
          .update({
            from_lat: fromLat,
            from_lng: fromLng,
            to_lat: toLat,
            to_lng: toLng,
          })
          .eq("id", r.id);
        if (upErr) console.error(`Update failed for ride ${r.id}`, upErr);
        else console.log(`Updated ride ${r.id}`);
      } else {
        console.log(`Skipped ride ${r.id} (could not geocode)`);
      }
    } catch (e) {
      console.error(`Ride ${r.id} error:`, e.message);
    }
  }

  return true; // processed a batch
}

(async () => {
  try {
    // loop batches until none left
    while (await backfillBatch(50)) {
      await sleep(500); // small pause between batches
    }
    console.log("Backfill complete. 🎉");
  } catch (e) {
    console.error("Backfill crashed:", e);
    process.exit(1);
  }
})();
