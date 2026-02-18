import { useGameStore } from '@/stores/game';

export function Header() {
  const round = useGameStore((s) => s.round);
  const verification = useGameStore((s) => s.verification);

  return (
    <div className="w-full rounded-xl bg-gray-900/80 border border-gray-700 px-4 py-3 text-white flex items-center justify-between">
      <div className="font-bold">🃏 PokerMind Arena</div>
      <div className="text-sm text-gray-300">Round {round}</div>
      <div className={`text-sm ${verification ? 'text-green-400' : 'text-gray-500'}`}>
        {verification ? '🔗 Verified' : '⏳ Waiting Verify'}
      </div>
    </div>
  );
}
