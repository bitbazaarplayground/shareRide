// Updated PassengerCounter.jsx (dropdown inline with icon and sliders)

import { useState } from "react";
import { FaUser } from "react-icons/fa";
import "./Styles/PassengerCounter.css";

export default function PassengerCounter({
  passengerCount,
  setPassengerCount,
  backpacks,
  setBackpacks,
  smallSuitcases,
  setSmallSuitcases,
  largeSuitcases,
  setLargeSuitcases,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  return (
    <div className="passenger-container">
      <div className="passenger-toggle" onClick={toggleDropdown}>
        <FaUser className="icon" />
        <span>
          {passengerCount} Passenger{passengerCount > 1 ? "s" : ""}
        </span>
        <span className="dropdown-arrow">▾</span>
      </div>

      {dropdownOpen && (
        <div className="passenger-dropdown">
          <div className="dropdown-row">
            <label>Passengers:</label>
            <input
              type="range"
              min="1"
              max="4"
              value={passengerCount}
              onChange={(e) => setPassengerCount(Number(e.target.value))}
            />
            <span>{passengerCount}</span>
          </div>

          <div className="dropdown-row">
            <label>
              {/* <FaSuitcaseRolling className="icon" />*/} Backpacks:
            </label>
            <input
              type="range"
              min="0"
              max="3"
              value={backpacks}
              onChange={(e) => setBackpacks(Number(e.target.value))}
            />
            <span>{backpacks}</span>
          </div>

          <div className="dropdown-row">
            <label>
              {/* <FaSuitcase className="icon" />  */}Small suitcases:
            </label>
            <input
              type="range"
              min="0"
              max="2"
              value={smallSuitcases}
              onChange={(e) => setSmallSuitcases(Number(e.target.value))}
            />
            <span>{smallSuitcases}</span>
          </div>

          <div className="dropdown-row">
            <label>
              {/* <FaSuitcase className="icon" /> */}Large suitcases:
            </label>
            <input
              type="range"
              min="0"
              max="2"
              value={largeSuitcases}
              onChange={(e) => setLargeSuitcases(Number(e.target.value))}
            />
            <span>{largeSuitcases}</span>
          </div>
        </div>
      )}
    </div>
  );
}
