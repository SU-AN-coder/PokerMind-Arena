/**
 * WinnerOverlay：胜者光圈 + WINNER 文字。
 */
import { motion } from 'framer-motion';

export default function WinnerOverlay({ runId = 0 }) {
  return (
    <motion.div
      key={`winner-overlay-${runId}`}
      className="absolute inset-0 pointer-events-none"
    >
      <motion.div
        className="absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/60"
        initial={{ scale: 0.8, opacity: 0.8 }}
        animate={{ scale: [0.8, 2.5], opacity: [0.8, 0] }}
        transition={{ duration: 1.2, repeat: 2, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute left-1/2 -top-10 -translate-x-1/2 font-display text-gold text-[32px] tracking-widest"
        style={{
          textShadow:
            '0 0 12px rgba(201,168,76,0.85), 0 0 30px rgba(201,168,76,0.45)',
        }}
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.8 }}
      >
        WINNER
      </motion.div>
    </motion.div>
  );
}
