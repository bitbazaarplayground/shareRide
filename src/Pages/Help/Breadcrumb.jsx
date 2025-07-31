import React from "react";
import { Link } from "react-router-dom";
import "./StylesHelp/Breadcrumb.css";

export default function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <span className="breadcrumb-item">
            {item.to ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
          {index < items.length - 1 && <span className="separator">›</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
