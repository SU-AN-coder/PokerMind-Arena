import { useMemo, useState } from 'react';
import { useGameStore } from '@/stores/game';
import { placeBet } from '@/lib/socket';

export function BettingPanel() {
  const market = useGameStore((s) => s.market);
  const gameId = useGameStore((s) => s.gameId);
  const [selectedAi, setSelectedAi] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);

  const canBet = useMemo(() => !!market && market.status === 'open' && !!gameId, [market, gameId]);

  if (!market) {
    return <div className="panel">🎲 预测市场加载中...</div>;
  }

  return (
    <div className="panel">
      <h3 className="text-white font-bold mb-3">🎲 谁会赢得这场比赛？</h3>
      <div className="space-y-2 mb-3">
        {market.options.map((o) => (
          <button
            key={o.aiId}
            onClick={() => setSelectedAi(o.aiId)}
            className={`w-full text-left p-2 rounded-lg ${selectedAi === o.aiId ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-white">{o.avatar} {o.aiName}</span>
              <span className="text-yellow-400 font-bold">{o.odds.toFixed(2)}x</span>
            </div>
            <div className="text-xs text-gray-400">{o.betCount}人 · ${o.totalBets}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        {[10, 25, 50, 100].map((v) => (
          <button key={v} onClick={() => setAmount(v)} className={`px-3 py-1 rounded ${amount === v ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white'}`}>${v}</button>
        ))}
      </div>
      <button
        disabled={!canBet || !selectedAi}
        onClick={() => selectedAi && gameId && placeBet(gameId, selectedAi, amount)}
        className="w-full py-2 rounded bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold disabled:opacity-50"
      >
        下注 {selectedAi ? `$${amount}` : ''}
      </button>
      <div className="text-xs text-gray-400 mt-2">总池: ${market.totalPool} · {market.totalBettors}人</div>
    </div>
  );
}
