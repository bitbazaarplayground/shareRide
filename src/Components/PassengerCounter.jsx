import { useState } from "react";
import "./Styles/SearchBar.css";

export default function PassengerCounter({ t }) {
  const [count, setCount] = useState(1);
  const [luggageSize, setLuggageSize] = useState("small");

  const increment = () => setCount((c) => Math.min(10, c + 1));
  const decrement = () => setCount((c) => Math.max(1, c - 1));

  return (
    <div className="passenger-counter">
      <div className="passenger-controls">
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

      <div className="luggage-select">
        <label htmlFor="luggageSize">
          {t("luggageSize") || "Luggage size"}:
        </label>
        <select
          id="luggageSize"
          value={luggageSize}
          onChange={(e) => setLuggageSize(e.target.value)}
        >
          <option value="small">
            {t("smallBag") || "Small bag / backpack"}
          </option>
          <option value="medium">{t("carryOn") || "Carry-on suitcase"}</option>
          <option value="large">
            {t("largeSuitcase") || "Large checked suitcase"}
          </option>
        </select>
      </div>
    </div>
  );
}

// import { useState } from "react";
// import "./Styles/SearchBar.css";

// export default function PassengerCounter({ t }) {
//   const [count, setCount] = useState(1);
//   const increment = () => setCount((c) => Math.min(10, c + 1));
//   const decrement = () => setCount((c) => Math.max(1, c - 1));

//   return (
//     <div className="passenger-counter">
//       <button onClick={decrement} aria-label="Decrease passengers">
//         −
//       </button>
//       <span>
//         {count} {count === 1 ? t("passenger") : t("passengers")}
//       </span>
//       <button onClick={increment} aria-label="Increase passengers">
//         +
//       </button>
//     </div>
//   );
// }
