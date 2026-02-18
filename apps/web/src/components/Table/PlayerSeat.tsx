import { motion } from 'framer-motion';
import { PlayingCard } from './PlayingCard';
import type { Player } from '@/types/game';

export function PlayerSeat({
  player,
  position,
  isActive
}: {
  player: Player;
  position: { x: string; y: string };
  isActive: boolean;
}) {
  const isFolded = player.status === 'folded';
  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: position.x, top: position.y }}
      animate={{ scale: isActive ? 1.05 : 1, opacity: player.status === 'eliminated' ? 0.5 : 1 }}
    >
      <div className={`px-3 py-2 rounded-xl ${isActive ? 'bg-yellow-500/30 ring-2 ring-yellow-400' : 'bg-black/45'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{player.avatar}</span>
          <span className="text-white font-semibold">{player.name}</span>
        </div>
        <div className="flex gap-1 mb-1">
          <PlayingCard card={player.holeCards?.[0] ?? '??'} faded={isFolded} />
          <PlayingCard card={player.holeCards?.[1] ?? '??'} faded={isFolded} />
        </div>
        <div className="text-yellow-400 font-bold">${player.stack}</div>
      </div>
    </motion.div>
  );
}
