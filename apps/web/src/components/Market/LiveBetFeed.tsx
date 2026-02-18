import { useGameStore } from '@/stores/game';

export function LiveBetFeed() {
  const bets = useGameStore((s) => s.liveBets);

  return (
    <div className="panel h-[120px] overflow-y-auto">
      <div className="text-xs text-gray-400 mb-2">🔴 实时投注</div>
      <div className="space-y-1">
        {bets.slice(-10).map((b, i) => (
          <div key={`${b.viewerName}-${b.timestamp}-${i}`} className="text-sm text-gray-200">
            <span className="text-gray-400">{b.viewerName}</span> 押 <span>{b.optionAvatar}</span>{' '}
            <span className="text-yellow-400 font-semibold">${b.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
