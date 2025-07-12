import { useState } from "react";
import "./Styles/PassengerCounter.css";

export default function PassengerCounter({ t }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [luggageCounts, setLuggageCounts] = useState({
    small: 0,
    medium: 0,
    large: 0,
  });

  const incrementPassengers = () => setPassengers((p) => Math.min(4, p + 1));
  const decrementPassengers = () => setPassengers((p) => Math.max(1, p - 1));

  const updateLuggage = (size, value) => {
    const limits = {
      small: 3,
      medium: 2,
      large: 2,
    };

    setLuggageCounts((prev) => ({
      ...prev,
      [size]: Math.max(0, Math.min(value, limits[size])),
    }));
  };

  return (
    <div className="passenger-dropdown-wrapper">
      <label
        className="dropdown-toggle"
        onClick={() => setDropdownOpen((open) => !open)}
      >
        🎒 How many passengers?
      </label>

      {dropdownOpen && (
        <div className="passenger-counter">
          <div className="passenger-controls">
            <button onClick={decrementPassengers}>−</button>
            <span>
              {passengers} {passengers === 1 ? "Passenger" : "Passengers"}
            </span>
            <button onClick={incrementPassengers}>+</button>
          </div>

          <div className="luggage-section">
            <label>
              Backpacks:
              <input
                type="number"
                min="0"
                max="3"
                value={luggageCounts.small}
                onChange={(e) =>
                  updateLuggage("small", parseInt(e.target.value) || 0)
                }
              />
            </label>

            <label>
              Cabbin bag:
              <input
                type="number"
                min="0"
                max="2"
                value={luggageCounts.medium}
                onChange={(e) =>
                  updateLuggage("medium", parseInt(e.target.value) || 0)
                }
              />
            </label>

            <label>
              Large Suitcases:
              <input
                type="number"
                min="0"
                max="2"
                value={luggageCounts.large}
                onChange={(e) =>
                  updateLuggage("large", parseInt(e.target.value) || 0)
                }
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
