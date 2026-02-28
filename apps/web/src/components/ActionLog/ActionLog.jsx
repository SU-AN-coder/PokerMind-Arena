/**
 * ActionLog：底部行动日志（可滚动、新日志从顶部插入、不同操作颜色区分）。
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ACTION_ZH = {
  fold: '弃牌',
  call: '跟注',
  raise: '加注',
  bet: '下注',
  check: '过牌',
  'all-in': '全下',
};

function actionColor(action) {
  if (action === 'fold') return 'text-[#888]';
  if (action === 'call' || action === 'check') return 'text-paper/90';
  if (action === 'raise' || action === 'bet') return 'text-gold';
  if (action === 'all-in') return 'text-danger';
  return 'text-paper/80';
}

export default function ActionLog({ logs }) {
  const items = (logs || []).slice().reverse();
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [items.length]);

  return (
    <div className="rounded-2xl border border-paper/10 bg-black/20 backdrop-blur-sm p-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="font-display text-gold text-sm tracking-widest">
          ACTION LOG
        </div>
        <div className="text-[11px] font-mono text-paper/60">最新在上</div>
      </div>

      <div
        ref={logRef}
        className="mt-3 h-[180px] overflow-y-auto overflow-x-hidden pr-2 log-content"
      >
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((l) => (
              <motion.li
                key={l.id}
                layout
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start justify-between gap-4 font-mono text-xs min-h-[32px]"
              >
                <div className="min-w-0">
                  <span className="text-paper/55">[{l.phase}]</span>{' '}
                  <span className="text-paper/90">{l.player}</span>{' '}
                  <span className={actionColor(l.action)}>
                    {ACTION_ZH[l.action] || l.action}
                  </span>
                  {l.amount ? (
                    <span className="text-paper/80">
                      {' '}
                      ${l.amount.toLocaleString()}
                    </span>
                  ) : null}
                  <span className="text-paper/55">
                    {' '}
                    → 底池 ${l.pot.toLocaleString()}
                  </span>
                </div>
                <div className="text-paper/45 whitespace-nowrap">{l.timestamp}</div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}
