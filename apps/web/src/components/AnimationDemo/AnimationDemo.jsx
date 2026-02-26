/**
 * AnimationDemo：游戏控制面板（右下角浮层）。
 * 连接后端时为观战模式：4 个 AI 对战，用户仅观战，无操作按钮。
 */
import { motion } from 'framer-motion';

export default function AnimationDemo({
  open = true,
  onClose,
  onStart,
  onConnectAndStart,
  onPauseToggle,
  onSpeedUp,
  onReset,
  phase,
  currentPlayerName,
  isPaused = false,
  speed = 1,
  isConnected = false,
}) {
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-[100] w-[200px] rounded-2xl border border-gold/40 bg-[#1a1f2e]/80 p-3 font-mono text-[12px] text-paper shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: open ? 1 : 0, y: open ? 0 : 10 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      <motion.button
        type="button"
        aria-label="关闭控制面板"
        onClick={onClose}
        className="absolute right-2 top-2 h-6 w-6 rounded-full bg-white/10 text-gold transition hover:bg-white/20"
      >
        ×
      </motion.button>
      <motion.div className="text-gold text-xs tracking-widest mb-2">
        GAME CONTROL
      </motion.div>
      <motion.div className="grid gap-2">
        <motion.button
          type="button"
          onClick={onStart}
          className="w-full rounded-lg border border-gold/40 px-3 py-2 text-left text-gold/90 transition hover:border-gold hover:text-gold hover:shadow-[0_0_16px_rgba(201,168,76,0.35)]"
        >
          ▶ 开始新一局（本地）
        </motion.button>
        {isConnected && onConnectAndStart && (
          <motion.button
            type="button"
            onClick={() => onConnectAndStart({ name: '观战者' })}
            className="w-full rounded-lg border border-emerald-500/50 px-3 py-2 text-left text-emerald-400 transition hover:border-emerald-400 hover:shadow-[0_0_16px_rgba(52,211,153,0.25)]"
          >
            🟢 创建房间并开始（4 AI 对战 / 观战）
          </motion.button>
        )}
        <motion.button
          type="button"
          onClick={onPauseToggle}
          className="w-full rounded-lg border border-gold/40 px-3 py-2 text-left text-gold/90 transition hover:border-gold hover:text-gold hover:shadow-[0_0_16px_rgba(201,168,76,0.35)]"
        >
          {isPaused ? '▶ 继续游戏' : '⏸ 暂停游戏'}
        </motion.button>
        <motion.button
          type="button"
          onClick={onSpeedUp}
          className="w-full rounded-lg border border-gold/40 px-3 py-2 text-left text-gold/90 transition hover:border-gold hover:text-gold hover:shadow-[0_0_16px_rgba(201,168,76,0.35)]"
        >
          ⏩ 当前 {speed}x（点击切换）
        </motion.button>
        <motion.button
          type="button"
          onClick={onReset}
          className="w-full rounded-lg border border-paper/20 px-3 py-2 text-left text-paper/80 transition hover:border-gold/60 hover:text-gold"
        >
          ↺ 重置
        </motion.button>
        <motion.div className="mt-1 rounded-lg border border-paper/15 bg-black/25 px-2.5 py-2 text-[11px]">
          <div className="text-paper/70">当前阶段: {phase}</div>
          <div className="mt-1 text-paper/70">
            当前行动: {currentPlayerName || '--'}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
