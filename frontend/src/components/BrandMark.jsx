// AssetNova brand marks — reusable SVG components.
// Concept: 4-point nova starburst (sharp diamond rays) representing a "nova"
// combined with a subtle inner core. The two-tone palette uses the app's
// forest-green brand variables (--brand, --brand-3) so the mark reacts to
// theme changes automatically.
//
// Usage:
//   <BrandMark size={28} />                 // icon only
//   <BrandWordmark size={28} />             // icon + "AssetNova" wordmark

import React from "react";

export const BrandMark = ({ size = 28, className = "", ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="AssetNova"
    {...rest}
  >
    {/* Outer nova burst — 4 sharp rays radiating from center */}
    <path
      d="M16 2 L18.2 13.8 L30 16 L18.2 18.2 L16 30 L13.8 18.2 L2 16 L13.8 13.8 Z"
      fill="var(--brand-3, #059669)"
    />
    {/* Diagonal rays (softer, secondary tone) creating an 8-point star */}
    <path
      d="M16 6.5 L17.1 14.9 L25.5 16 L17.1 17.1 L16 25.5 L14.9 17.1 L6.5 16 L14.9 14.9 Z"
      fill="var(--brand, #10b981)"
      opacity="0.55"
    />
    {/* Bright core — represents a nova epicentre */}
    <circle cx="16" cy="16" r="2.4" fill="#ffffff" />
    <circle cx="16" cy="16" r="1.2" fill="var(--brand-3, #059669)" />
  </svg>
);

export const BrandWordmark = ({ size = 26, className = "", ...rest }) => (
  <div className={`flex items-center gap-2 ${className}`} {...rest}>
    <BrandMark size={size} />
    <div className="font-display font-semibold leading-none tracking-tight" style={{ fontSize: `${size * 0.62}px` }}>
      <span className="text-[color:var(--ink)]">Asset</span>
      <span className="text-[color:var(--brand-3)]">Nova</span>
    </div>
  </div>
);
