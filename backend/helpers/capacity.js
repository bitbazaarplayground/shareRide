export function getVehicleCapacity(vehicleType) {
  switch (vehicleType) {
    case "van":
      return { seat: 6, backpack: 6, small: 4, large: 4 };
    case "minibus":
      return { seat: 8, backpack: 8, small: 6, large: 6 };
    default: // regular
      return { seat: 4, backpack: 4, small: 2, large: 2 };
  }
}

// /**
//  * Check if the ride can accommodate the given number of passengers and luggage.
//  * @param {Object} vehicleCapacity - The vehicle capacity object from getVehicleCapacity.
//  * @param {number} numPassengers - Number of passengers to check.
//  * @param {number} numBackpacks - Number of backpacks to check.
//  * @param {number} numSmallSuitcases - Number of small suitcases to check.
//  * @param {number} numLargeSuitcases - Number of large suitcases to check.
//  * @returns {boolean} True if the ride can accommodate, false otherwise.
//  */
