import { CommunityCards } from './CommunityCards';
import { PlayerSeat } from './PlayerSeat';
import { useGameStore } from '@/stores/game';

const POS = [
  { x: '16%', y: '16%' },
  { x: '84%', y: '16%' },
  { x: '16%', y: '76%' },
  { x: '84%', y: '76%' }
];

export function PokerTable() {
  const players = useGameStore((s) => s.players);
  const communityCards = useGameStore((s) => s.communityCards);
  const pot = useGameStore((s) => s.pot);
  const activePlayerId = useGameStore((s) => s.activePlayerId);

  return (
    <div className="relative h-[520px] rounded-3xl border-4 border-amber-700 bg-gradient-to-b from-green-800 to-green-900">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <CommunityCards cards={communityCards} />
        <div className="text-yellow-300 font-extrabold">POT ${pot}</div>
      </div>

      {players.map((p, i) => (
        <PlayerSeat key={p.id} player={p} position={POS[i] ?? POS[0]} isActive={p.id === activePlayerId} />
      ))}
    </div>
  );
}
