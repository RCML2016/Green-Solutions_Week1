// Animated numeric counter — smoothly counts from 0 → target when the
// element scrolls into view. Uses framer-motion's useSpring for a natural
// easing curve and IntersectionObserver so it only fires once.
//
// Usage:
//   <AnimatedCounter to={380} suffix="+" />
//   <AnimatedCounter to={5473} format={(v) => Math.round(v).toLocaleString()} />

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

export default function AnimatedCounter({
  to,
  from = 0,
  duration = 1.8,
  suffix = "",
  prefix = "",
  format,
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  const [value, setValue] = useState(from);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;
          animate(from, to, {
            duration,
            ease: [0.16, 1, 0.3, 1], // smooth cubic-bezier
            onUpdate: (v) => setValue(v),
          });
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, from, duration]);

  const display = format
    ? format(value)
    : Math.round(value).toLocaleString();

  return (
    <span ref={ref} className={className} {...rest}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
