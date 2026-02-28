/**
 * ChipStack：纯 CSS 模拟筹码堆（锯齿边缘 + 同心圆），用于下注/底池附近的小额展示。
 */
import { motion } from 'framer-motion';
import AmountRoller from '../AmountRoller/AmountRoller.jsx';
import styles from './ChipStack.module.css';

export function chipTheme(amount) {
  return { base: '#1d4ed8', ring: '#f0e6d3' }; // unified blue/white
}

export default function ChipStack({
  amount,
  displayAmount,
  showIcon = true,
  textClassName = 'text-sm',
}) {
  if (amount == null) return null;
  const theme = chipTheme(amount);
  const labelValue = displayAmount ?? amount;

  return (
    <motion.div className={styles.stack}>
      {showIcon ? (
        <motion.div className={styles.pile} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className={styles.chip}
              style={{
                top: `${(3 - i) * -7}px`,
                background:
                  `radial-gradient(circle at 50% 35%, rgba(255,255,255,0.22), transparent 55%),` +
                  `repeating-conic-gradient(${theme.ring} 0 8deg, rgba(0,0,0,0) 8deg 18deg),` +
                  `linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.20)),` +
                  `linear-gradient(180deg, ${theme.base}, ${theme.base})`,
              }}
            >
              <motion.div
                className={styles.chipInner}
                style={{
                  background: `radial-gradient(circle at 50% 35%, rgba(255,255,255,0.28), transparent 60%), linear-gradient(180deg, ${theme.base}, ${theme.base})`,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : null}
      <AmountRoller value={labelValue} className={textClassName} />
    </motion.div>
  );
}
