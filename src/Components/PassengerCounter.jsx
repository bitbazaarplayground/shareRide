import { useState } from "react";
import "./Styles/Navbar.css";

export default function PassengerCounter({ t }) {
  const [count, setCount] = useState(1);
  const increment = () => setCount((c) => Math.min(10, c + 1));
  const decrement = () => setCount((c) => Math.max(1, c - 1));

  return (
    <div className="passenger-counter">
      <button onClick={decrement} aria-label="Decrease passengers">
        −
      </button>
      <span>
        {count} {count === 1 ? t("passenger") : t("passengers")}
      </span>
      <button onClick={increment} aria-label="Increase passengers">
        +
      </button>
    </div>
  );
}
