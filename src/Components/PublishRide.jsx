import React, { useState } from "react";
import AutocompleteInput from "../Components/AutocompleteInput";
import { supabase } from "../supabaseClient";

export default function PublishRide() {
  const { user } = useAuth();
  console.log("Logged in user:", user);
  const today = new Date().toISOString().split("T")[0];

  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting ride...");
    setMessage(""); // clear any old messages

    if (!fromPlace || !toPlace) {
      setMessage("Please select both from and to addresses.");
      return;
    }

    if (!user) {
      setMessage("You must be logged in to publish a ride.");
      return;
    }

    const { data, error } = await supabase.from("rides").insert([
      {
        from: fromPlace,
        to: toPlace,
        date,
        seats,
        notes,
        user_id: user.id, // assuming your table has this column
      },
    ]);

    if (error) {
      setMessage("Error publishing ride.");
      console.error("Supabase insert error:", error);
    } else {
      setMessage("Ride published successfully!");
      console.log("Inserted ride data:", data);
    }
  };

  return (
    <div className="publish-container">
      <h2>Publish Your Ride</h2>
      <form onSubmit={handleSubmit}>
        <AutocompleteInput
          placeholder="From"
          onPlaceSelected={(place) => setFromPlace(place.formatted_address)}
        />
        <AutocompleteInput
          placeholder="To"
          onPlaceSelected={(place) => setToPlace(place.formatted_address)}
        />
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Seats"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          min={1}
          required
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit">Publish</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
