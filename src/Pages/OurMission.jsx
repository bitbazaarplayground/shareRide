import React from "react";
import "./StylesPages/OurMission.css";
const OurMission = () => {
  return (
    <section className="our-mission">
      <h2>Our Mission</h2>
      <p>
        At <strong style={{ color: "#e66000" }}>Go Dutch</strong>, we are
        committed to revolutionizing travel by promoting shared rides that
        reduce emissions, cut costs, and enhance convenience.
      </p>
      <p>
        Our platform connects travelers heading to airports, festivals, or
        different city zones, providing a safe, affordable, and eco-friendly
        alternative to traditional transportation.
      </p>
      <p>
        Together, we aim to create a sustainable future where everyone can
        travel smarter, greener, and with peace of mind.
      </p>
      <ul>
        <li>
          <strong>Reduce Emissions:</strong> Fewer cars on the road mean cleaner
          air and a healthier planet.
        </li>
        <li>
          <strong>Save Costs:</strong> Sharing rides lowers travel expenses for
          everyone involved.
        </li>
        <li>
          <strong>Safe Travel:</strong> Our trusted community and verified
          drivers ensure you get where you need to go securely.
        </li>
        <li>
          <strong>Flexible Routes:</strong> Whether it’s city-to-airport, across
          zones, or to your favorite events, we’ve got you covered.
        </li>
      </ul>
    </section>
  );
};

export default OurMission;
