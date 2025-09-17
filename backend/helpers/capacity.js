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
