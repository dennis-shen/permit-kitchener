"use client";
import { useEffect, useState } from "react";

/** High-contrast accessibility mode. The app is light-only; this raises contrast and thickens borders. */
export function ContrastToggle() {
  const [high, setHigh] = useState(false);
  useEffect(() => setHigh(document.documentElement.dataset.contrast === "high"), []);
  const toggle = () => {
    const next = !high;
    setHigh(next);
    if (next) document.documentElement.dataset.contrast = "high";
    else delete document.documentElement.dataset.contrast;
    try { localStorage.setItem("permitready-contrast", next ? "high" : "normal"); } catch { /* ignore */ }
  };
  return (
    <button className="contrast-toggle" aria-pressed={high} onClick={toggle}>
      High contrast {high ? "on" : "off"}
    </button>
  );
}
