import { motion } from 'framer-motion';

export function PlayingCard({ card, faded = false, delay = 0 }: { card: string; faded?: boolean; delay?: number }) {
  if (card === '??') {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: faded ? 0.5 : 1 }}
        transition={{ duration: 0.35, delay }}
        className="w-12 h-16 rounded-md bg-gray-700/80 shadow flex items-center justify-center text-gray-300"
      >
        ?
      </motion.div>
    );
  }

  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const red = suit === '♥' || suit === '♦';

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: faded ? 0.5 : 1 }}
      transition={{ duration: 0.35, delay }}
      className="w-12 h-16 rounded-md bg-white shadow flex flex-col items-center justify-center"
    >
      <span className={`text-sm font-bold ${red ? 'text-red-600' : 'text-gray-900'}`}>{rank}</span>
      <span className={`${red ? 'text-red-600' : 'text-gray-900'}`}>{suit}</span>
    </motion.div>
  );
}
