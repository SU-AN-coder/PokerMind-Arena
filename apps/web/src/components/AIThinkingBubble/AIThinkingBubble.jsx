/**
 * AIThinkingBubble：AI 思考气泡（霓虹蓝边框、打字机效果、胜率条与倾向提示）。
 */
import { useEffect, useState } from 'react';
import {
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'framer-motion';
import styles from './AIThinkingBubble.module.css';

const ACTION_ZH = {
  fold: '弃牌',
  call: '跟注',
  raise: '加注',
  bet: '下注',
  check: '过牌',
  'all-in': '全下',
};

function arrowStyle(direction, color) {
  const transparent = '10px solid transparent';
  const transparentInner = '9px solid transparent';

  if (direction === 'right') {
    return [
      {
        className: 'absolute right-[-10px] top-1/2 -translate-y-1/2',
        style: {
          borderTop: transparent,
          borderBottom: transparent,
          borderLeft: `10px solid ${color}`,
        },
      },
      {
        className: 'absolute right-[-9px] top-1/2 -translate-y-1/2',
        style: {
          borderTop: transparentInner,
          borderBottom: transparentInner,
          borderLeft: '9px solid rgba(10,14,26,0.95)',
        },
      },
    ];
  }

  if (direction === 'left') {
    return [
      {
        className: 'absolute left-[-10px] top-1/2 -translate-y-1/2',
        style: {
          borderTop: transparent,
          borderBottom: transparent,
          borderRight: `10px solid ${color}`,
        },
      },
      {
        className: 'absolute left-[-9px] top-1/2 -translate-y-1/2',
        style: {
          borderTop: transparentInner,
          borderBottom: transparentInner,
          borderRight: '9px solid rgba(10,14,26,0.95)',
        },
      },
    ];
  }

  if (direction === 'top') {
    return [
      {
        className: 'absolute top-[-10px] left-1/2 -translate-x-1/2',
        style: {
          borderLeft: transparent,
          borderRight: transparent,
          borderBottom: `10px solid ${color}`,
        },
      },
      {
        className: 'absolute top-[-9px] left-1/2 -translate-x-1/2',
        style: {
          borderLeft: transparentInner,
          borderRight: transparentInner,
          borderBottom: '9px solid rgba(10,14,26,0.95)',
        },
      },
    ];
  }

  return [
    {
      className: 'absolute bottom-[-10px] left-1/2 -translate-x-1/2',
      style: {
        borderLeft: transparent,
        borderRight: transparent,
        borderTop: `10px solid ${color}`,
      },
    },
    {
      className: 'absolute bottom-[-9px] left-1/2 -translate-x-1/2',
      style: {
        borderLeft: transparentInner,
        borderRight: transparentInner,
        borderTop: '9px solid rgba(10,14,26,0.95)',
      },
    },
  ];
}

function formatLastAction(lastAction) {
  if (!lastAction) return '暂无记录';
  const action = ACTION_ZH[lastAction.action] || lastAction.action;
  const amount = lastAction.amount ? ` $${lastAction.amount}` : '';
  const phase = lastAction.phase ? `[${lastAction.phase}] ` : '';
  return `${phase}${action}${amount}`;
}

export default function AIThinkingBubble({
  player,
  arrowDirection = 'bottom',
  isCurrent = false,
  lastAction,
}) {
  const win = Math.max(0, Math.min(100, player.winProbability ?? 0));
  const isFolded = player.status === 'folded';
  const isThinking = player.status === 'thinking';
  const [thinkingText, setThinkingText] = useState('分析中');
  const opacity = isFolded ? 0.45 : isCurrent ? 1 : 0.5;
  const borderClass = isCurrent ? 'border-neon/70' : 'border-paper/25';
  const arrowColor = isCurrent ? 'rgba(76,201,240,0.75)' : 'rgba(240,230,211,0.25)';
  const [outerArrow, innerArrow] = arrowStyle(arrowDirection, arrowColor);
  const lastActionText = formatLastAction(lastAction);
  const progressControls = useAnimationControls();
  const winMotion = useMotionValue(0);
  const winRounded = useTransform(winMotion, (value) => Math.round(value));
  const [winText, setWinText] = useState(win);

  useMotionValueEvent(winRounded, 'change', (latest) => {
    setWinText(latest);
  });

  useEffect(() => {
    if (!isThinking) {
      setThinkingText('分析中');
      progressControls.set({ width: '0%' });
      winMotion.set(win);
      setWinText(win);
      return;
    }

    let index = 0;
    const sequence = ['分析中', '分析中.', '分析中..', '分析中...'];
    const interval = setInterval(() => {
      index = (index + 1) % sequence.length;
      setThinkingText(sequence[index]);
    }, 400);

    winMotion.set(0);
    animate(winMotion, win, { duration: 1.2, ease: 'easeOut' });
    progressControls.set({ width: '0%' });
    progressControls.start({
      width: `${win}%`,
      transition: { duration: 1.5, ease: 'easeOut', delay: 0.3 },
    });

    return () => clearInterval(interval);
  }, [isThinking, win, progressControls, winMotion]);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 6 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`relative z-50 w-[180px] rounded-2xl border ${borderClass} bg-[rgba(10,14,26,0.95)] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.55)]`}
      style={{ opacity }}
    >
      <motion.div className={outerArrow.className} style={outerArrow.style} />
      <motion.div className={innerArrow.className} style={innerArrow.style} />

      {isFolded ? (
        <motion.div className="font-mono text-xs text-paper/55">已弃牌</motion.div>
      ) : isThinking ? (
        <>
          <motion.div className="font-mono text-xs text-neon">
            <span className={styles.type}>{thinkingText}</span>
          </motion.div>
          <motion.div className="mt-2 text-[11px] font-mono text-paper/80">
            胜率: <span className="text-paper/90">{winText}%</span>
          </motion.div>
          <motion.div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-neon/80"
              initial={{ width: '0%' }}
              animate={progressControls}
            />
          </motion.div>
          <motion.div className="mt-1 text-[11px] font-mono text-paper/80">
            倾向: <span className="text-danger font-semibold">加注</span>
          </motion.div>
        </>
      ) : (
        <>
          <motion.div className="font-mono text-xs text-paper/80">等待中</motion.div>
          <motion.div className="mt-2 text-[11px] font-mono text-paper/60">
            上次操作: {lastActionText}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
