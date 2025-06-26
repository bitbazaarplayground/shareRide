import React, { useState } from "react";
import "../Components/Styles/Avatar.css";

export default function Avatar({
  src,
  name = "",
  alt = "avatar",
  className = "",
}) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!src || imgError) {
    return (
      <div className={`initials-avatar ${className}`}>{initials || "?"}</div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImgError(true)}
    />
  );
}
