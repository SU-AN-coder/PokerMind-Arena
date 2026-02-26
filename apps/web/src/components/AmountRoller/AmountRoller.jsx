import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const DIGIT_HEIGHT = 28;
const DIGIT_LIST = Array.from({ length: 60 }, (_, idx) => idx % 10);
const EASE_OUT_QUART = [0.25, 0.46, 0.45, 0.94];

function DigitRoller({ digit, delay = 0 }) {
  const [rollIndex, setRollIndex] = useState(digit);

  useEffect(() => {
    setRollIndex((prev) => {
      let next = prev;
      while (next % 10 !== digit) {
        next += 1;
      }
      return next;
    });
  }, [digit]);

  return (
    <div
      className="overflow-hidden text-right tabular-nums"
      style={{ height: `${DIGIT_HEIGHT}px`, width: '1ch' }}
    >
      <motion.div
        initial={{ y: -rollIndex * DIGIT_HEIGHT }}
        animate={{ y: -rollIndex * DIGIT_HEIGHT }}
        transition={{ duration: 0.6, ease: EASE_OUT_QUART, delay }}
        style={{ willChange: 'transform' }}
      >
        {DIGIT_LIST.map((value, idx) => (
          <div
            key={`${value}-${idx}`}
            className="tabular-nums"
            style={{ height: `${DIGIT_HEIGHT}px`, lineHeight: `${DIGIT_HEIGHT}px` }}
          >
            {value}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function AmountRoller({ value = 0, className }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const formatted = useMemo(() => safeValue.toLocaleString('en-US'), [safeValue]);
  const chars = useMemo(() => formatted.split(''), [formatted]);
  const digitPositions = useMemo(
    () => chars.map((char, idx) => (/\d/.test(char) ? idx : -1)).filter((v) => v >= 0),
    [chars]
  );
  const totalDigits = digitPositions.length;
  const delayMap = useMemo(() => {
    const map = new Map();
    digitPositions.forEach((idx, order) => {
      const orderFromRight = totalDigits - 1 - order;
      map.set(idx, orderFromRight * 0.06);
    });
    return map;
  }, [digitPositions, totalDigits]);

  const symbolStyle = {
    height: `${DIGIT_HEIGHT}px`,
    lineHeight: `${DIGIT_HEIGHT}px`,
  };

  return (
    <div
      className={`inline-flex items-center justify-end font-display text-gold leading-none ${className || ''}`}
    >
      <span className="mr-[2px]" style={symbolStyle}>
        $
      </span>
      {chars.map((char, idx) => {
        if (/\d/.test(char)) {
          return (
            <DigitRoller
              key={`digit-${idx}`}
              digit={Number(char)}
              delay={delayMap.get(idx) || 0}
            />
          );
        }
        return (
          <span key={`sep-${idx}`} className="px-[1px]" style={symbolStyle}>
            {char}
          </span>
        );
      })}
    </div>
  );
}
