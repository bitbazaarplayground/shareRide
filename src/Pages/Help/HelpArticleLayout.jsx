import React from "react";
import { Link } from "react-router-dom";
import "./StylesHelp/Help.css";

export default function HelpArticleLayout({
  title,
  description,
  breadcrumb,
  children,
}) {
  return (
    <div className="help-wrapper">
      {/* Breadcrumb Section */}
      {breadcrumb?.length > 0 && (
        <div className="breadcrumb">
          {breadcrumb.map((item, index) => (
            <span key={index}>
              {item.to ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span>{item.label}</span>
              )}
              {index < breadcrumb.length - 1 && <span> &nbsp;›&nbsp; </span>}
            </span>
          ))}
        </div>
      )}

      {/* Article Content */}
      <div className="help-article">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
    </div>
  );
}
