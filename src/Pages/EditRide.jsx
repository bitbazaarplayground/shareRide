import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPages/EditRide.css";

export default function EditRide() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [rideData, setRideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    seats: 1,
    notes: "",
  });

  useEffect(() => {
    const fetchRide = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (error) {
        console.error("Error fetching ride:", error);
      } else {
        setRideData(data);
        setFormState({
          from: data.from,
          to: data.to,
          date: data.date || "",
          time: data.time || "",
          seats: data.seats,
          notes: data.notes || "",
        });
      }
      setLoading(false);
    };

    fetchRide();
  }, [rideId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_STRIPE_BACKEND}/api/rides-new/${rideId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formState),
      }
    );

    const json = await res.json();

    if (!res.ok || !json.ok) {
      alert(json.error || "There was an issue updating your ride.");
      return;
    }

    navigate("/my-rides?tab=published", {
      state: { message: "Ride updated successfully!" },
    });

    if (error) {
      console.error("Error updating ride:", error);
      alert("There was an issue updating your ride.");
    } else {
      navigate("/all-rides", {
        state: { message: "Ride updated successfully!" },
      });
    }
  };

  if (loading) return <p>Loading ride data...</p>;

  return (
    <div className="edit-ride-container">
      <h2>Edit Your Ride</h2>
      <form onSubmit={handleSubmit} className="edit-ride-form">
        <label>From:</label>
        <input
          type="text"
          name="from"
          value={formState.from}
          onChange={handleChange}
          required
        />

        <label>To:</label>
        <input
          type="text"
          name="to"
          value={formState.to}
          onChange={handleChange}
          required
        />

        <label>Date:</label>
        <input
          type="date"
          name="date"
          value={formState.date}
          onChange={handleChange}
          required
        />

        <label>Time:</label>
        <input
          type="time"
          name="time"
          value={formState.time}
          onChange={handleChange}
          required
        />

        <label>Seats:</label>
        <input
          type="number"
          name="seats"
          min="1"
          value={formState.seats}
          disabled
        />

        <label>Notes (optional):</label>
        <textarea
          name="notes"
          value={formState.notes}
          onChange={handleChange}
        />

        <button type="submit">Update Ride</button>
      </form>
    </div>
  );
}
