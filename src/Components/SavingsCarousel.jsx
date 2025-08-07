import React, { useEffect, useState } from "react";
import "./Styles/SavingsCarousel.css";

const scenarios = [
  {
    route: "✈️ Heathrow → Central London",
    tabfair: { cost: "£16.50 pp", time: "🕒 55 mins" },
    train: { label: "🛤 Heathrow Express", cost: "£22 pp", time: "🕒 22 mins" },
    taxi: {
      label: "🚖 Shared Taxi via Tabfair",
      cost: "£16.50 pp",
      time: "🕒 55 mins",
    },
  },
  {
    route: "✈️ Heathrow → Brentwood",
    tabfair: { cost: "£22 pp", time: "🕒 69 mins" },
    train: {
      label: "🛤 Train to Brentwood",
      cost: "£16.30",
      time: "🕒 101 mins",
    },
    taxi: {
      label: "🚐 Split Taxi Tabfair",
      cost: "£22 pp",
      time: "🕒 69 mins",
    },
  },
  {
    route: "✈️ Heathrow → Wimbledon",
    tabfair: { cost: "£11 pp", time: "🕒 50 mins" },
    train: {
      label: "🛤 Train + Tube",
      cost: "£33.90 pp",
      time: "🕒 88 mins (2 changes)",
    },
    taxi: {
      label: "🚕 Tabfair Shared Ride",
      cost: "£11 pp",
      time: "🕒 50 mins",
    },
  },
];

export default function SavingsCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % scenarios.length);
    }, 5000); // ⏱ every 8 seconds
    return () => clearInterval(interval);
  }, []);

  const current = scenarios[index];

  return (
    <section className="savings-comparison-carousel">
      <h2>See the Savings</h2>
      <div className="carousel-grid">
        <div className="savings-card">
          <h3>{current.route}</h3>
          <p className="cost">{current.tabfair.cost}</p>
          <p className="time">{current.tabfair.time}</p>
        </div>

        <div className="savings-card">
          <h3>{current.train.label}</h3>
          <p className="cost">{current.train.cost}</p>
          <p className="time">{current.train.time}</p>
        </div>

        <div className="savings-card highlight">
          <h3>{current.taxi.label}</h3>
          <p className="cost">{current.taxi.cost}</p>
          <p className="time">{current.taxi.time}</p>
        </div>
      </div>
      <p className="savings-footnote">
        * Estimated fares and travel times for 4 travelers — based on average
        data.
      </p>
    </section>
  );
}
