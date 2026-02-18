import { useState } from 'react';
import { useGameStore } from '@/stores/game';
import { VerificationPanel } from './VerificationPanel';

export function VerificationBar() {
  const verification = useGameStore((s) => s.verification);
  const [expanded, setExpanded] = useState(false);

  if (!verification) {
    return <div className="panel text-gray-400 text-sm">🔗 等待游戏结束后链上存证...</div>;
  }

  return (
    <div className="panel">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="text-sm text-green-400">✅ Game #{verification.gameId.slice(0, 8)}... 已存证</div>
        <div className="text-xs text-blue-400">展开验证</div>
      </div>
      {expanded ? <div className="mt-3"><VerificationPanel verification={verification} /></div> : null}
    </div>
  );
}
