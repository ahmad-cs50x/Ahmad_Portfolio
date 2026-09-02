"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CursorGlow() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);

  const dotX = useSpring(x, { stiffness: 400, damping: 30, mass: 0.5 });
  const dotY = useSpring(y, { stiffness: 400, damping: 30, mass: 0.5 });
  const glowX = useSpring(x, { stiffness: 55, damping: 18, mass: 0.9 });
  const glowY = useSpring(y, { stiffness: 55, damping: 18, mass: 0.9 });

  useEffect(() => {
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed z-[90] hidden h-72 w-72 rounded-full md:block"
        style={{
          x: glowX,
          y: glowY,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.14) 0%, rgba(34,211,238,0.06) 40%, transparent 65%)",
        }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed z-[96] hidden h-2.5 w-2.5 rounded-full bg-white mix-blend-difference md:block"
        style={{ x: dotX, y: dotY, translateX: "-50%", translateY: "-50%" }}
      />
    </>
  );
}
