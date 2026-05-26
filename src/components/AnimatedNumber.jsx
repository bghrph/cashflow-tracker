import React, { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../lib/format.js';

export default function AnimatedNumber({ value, symbol, className = '', style }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = display;
    const duration = 700;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = p * p * (3 - 2 * p);
      setDisplay(start + (target - start) * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => frame.current && cancelAnimationFrame(frame.current);
    // intentionally not depending on `display` so we always retarget from current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`tnum ${className}`} style={style}>
      {formatMoney(symbol, display)}
    </span>
  );
}
