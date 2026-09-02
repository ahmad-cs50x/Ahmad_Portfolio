"use client";

import { useRef, useState } from "react";

export default function TiltCard({ children, className = "", max = 9 }) {
  const ref = useRef(null);
  const [t, setT] = useState({ rx: 0, ry: 0, px: 50, py: 50, hover: false });

  const onMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setT({
      rx: (0.5 - py) * max,
      ry: (px - 0.5) * max,
      px: px * 100,
      py: py * 100,
      hover: true,
    });
  };

  const reset = () => setT((s) => ({ ...s, rx: 0, ry: 0, hover: false }));

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`relative transition-transform duration-200 ease-out [transform-style:preserve-3d] ${className}`}
      style={{ transform: `perspective(1000px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)` }}
    >
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: t.hover ? 1 : 0,
          background: `radial-gradient(circle at ${t.px}% ${t.py}%, rgba(167,139,250,0.18), transparent 55%)`,
        }}
      />
    </div>
  );
}
