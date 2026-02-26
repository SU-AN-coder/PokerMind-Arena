/**
 * GamePhaseIndicator：顶部阶段指示器（当前阶段高亮金色、已过阶段填充）。
 */
const ORDER = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

function getCurrentMainPhase(phase) {
  if (!phase) return '';
  if (phase.endsWith('_BETTING')) {
    return phase.replace('_BETTING', '');
  }
  return phase;
}

export default function GamePhaseIndicator({ phase }) {
  const currentPhase = getCurrentMainPhase(phase);
  const rawIndex = ORDER.indexOf(currentPhase);
  const activeIdx = rawIndex < 0 ? -1 : rawIndex;

  return (
    <div className="flex items-center gap-3 select-none">
      {ORDER.slice(0, 4).map((p, idx) => {
        const isPast = activeIdx >= 0 && idx < activeIdx;
        const isActive = activeIdx >= 0 && idx === activeIdx;
        const dot =
          isActive ? (
            <span className="text-gold">●</span>
          ) : isPast ? (
            <span className="text-gold">◆</span>
          ) : (
            <span className="text-paper/35">◇</span>
          );

        return (
          <div key={p} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs">{dot}</span>
              <span
                className={`font-display text-xs tracking-widest ${
                  isActive ? 'text-gold' : isPast ? 'text-paper/70' : 'text-paper/35'
                }`}
              >
                {p}
              </span>
            </div>
            {idx < 3 ? (
              <div
                className="h-[2px] w-16 rounded-full"
                style={{
                  background: isPast
                    ? 'linear-gradient(90deg, rgba(201,168,76,0.9), rgba(201,168,76,0.25))'
                    : 'rgba(240,230,211,0.12)',
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

