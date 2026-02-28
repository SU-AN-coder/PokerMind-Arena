/**
 * PlayingCard：单张扑克牌（支持正反面与翻转动画、花色映射与颜色规则）。
 */
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import styles from './PlayingCard.module.css';

const SUIT_MAP = {
  S: { symbol: '♠', color: '#111111' },
  C: { symbol: '♣', color: '#111111' },
  H: { symbol: '♥', color: '#e63946' },
  D: { symbol: '♦', color: '#e63946' },
};

const SIZE_MAP = {
  xs: 'w-[46px] h-[64px]',
  sm: 'w-[62px] h-[86px]',
  md: 'w-[78px] h-[110px]',
  lg: 'w-[92px] h-[130px]',
};

const PlayingCard = forwardRef(function PlayingCard(
  { card, faceDown = false, size = 'md', flipAnimation },
  ref
) {
  const raw = card || '??';
  const suitCode = raw.slice(-1);
  const rank = raw.slice(0, -1);
  const suit = SUIT_MAP[suitCode] || { symbol: '•', color: '#111111' };
  const {
    className: flipClassName,
    style: flipStyle,
    initial: flipInitial,
    animate: flipAnimate,
    transition: flipTransition,
    ...flipMotion
  } = flipAnimation || {};
  const baseRotation = faceDown ? 180 : 0;
  const resolvedInitial = flipInitial ?? { rotateY: baseRotation };
  const resolvedAnimate = flipAnimate ?? { rotateY: baseRotation };

  return (
    <motion.div
      ref={ref}
      className={`${styles.card} ${SIZE_MAP[size]} shadow-card`}
    >
      <motion.div
        className={`${styles.inner} ${flipClassName || ''}`}
        style={flipStyle}
        initial={resolvedInitial}
        animate={resolvedAnimate}
        transition={flipTransition}
        {...flipMotion}
      >
        <motion.div className={`${styles.cardFace} bg-white`}>
          <motion.div className="absolute left-2 top-2 leading-none">
            <motion.div
              className="font-display text-[13px] font-semibold"
              style={{ color: suit.color }}
            >
              {rank}
            </motion.div>
            <motion.div className="text-[14px]" style={{ color: suit.color }}>
              {suit.symbol}
            </motion.div>
          </motion.div>
          <motion.div
            className="h-full w-full grid place-items-center font-display text-[44px]"
            style={{ color: suit.color }}
          >
            {suit.symbol}
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }}
          />
        </motion.div>

        <motion.div className={styles.cardBack}>
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(201,168,76,0.22)' }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

export default PlayingCard;
