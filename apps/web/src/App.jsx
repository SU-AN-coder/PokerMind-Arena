/**
 * App：页面整体布局（顶部导航、牌桌主视图、底部行动日志与按钮区）。
 */
import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  useGameState,
  getInitialAnimState,
  getInitialGameState,
} from './hooks/useGameState';
import { useSocket } from './hooks/useSocket';
import { delay, runSequence } from './utils/animations';
import {
  startNewHand,
  enterPreflop,
  processPlayerAction,
  getAIDecision,
  isBettingRoundComplete,
  advanceToNextPhase,
} from './engine/gameEngine';
import PokerTable from './components/PokerTable/PokerTable.jsx';
import ActionLog from './components/ActionLog/ActionLog.jsx';
import GamePhaseIndicator from './components/GamePhaseIndicator/GamePhaseIndicator.jsx';
import AnimationDemo from './components/AnimationDemo/AnimationDemo.jsx';

function centerOf(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export default function App() {
  const { gameState, setGameState, animState, setAnimState } = useGameState();
  const { isConnected, createRoomAndStart } = useSocket(setGameState);
  const handNo = useMemo(
    () => `HAND #${String(gameState.handNumber || gameState.handId || 0).padStart(2, '0')}`,
    [gameState.handNumber, gameState.handId]
  );
  const [isDemoOpen, setIsDemoOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(1);
  const deckRef = useRef(null);
  const cardRefs = useRef({});
  const aiTimerRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const animationTimerRef = useRef(null);
  const dealForceTimerRef = useRef(null);
  const showdownWinnerTimerRef = useRef(null);
  const showdownSettleTimerRef = useRef(null);

  const registerCardRef = useCallback(
    (key) => (node) => {
      if (node) cardRefs.current[key] = node;
    },
    []
  );

  const clearAllTimers = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    if (dealForceTimerRef.current) clearTimeout(dealForceTimerRef.current);
    if (showdownWinnerTimerRef.current) clearTimeout(showdownWinnerTimerRef.current);
    if (showdownSettleTimerRef.current) clearTimeout(showdownSettleTimerRef.current);
    aiTimerRef.current = null;
    phaseTimerRef.current = null;
    animationTimerRef.current = null;
    dealForceTimerRef.current = null;
    showdownWinnerTimerRef.current = null;
    showdownSettleTimerRef.current = null;
  }, []);

  const resetAll = useCallback(
    (nextGameState) => {
      clearAllTimers();
      const baseState = nextGameState || getInitialGameState();
      setGameState(baseState);
      setAnimState(getInitialAnimState());
      setIsPaused(false);
      setGameSpeed(1);
      return baseState;
    },
    [clearAllTimers, setGameState, setAnimState]
  );

  const runDealAnimation = useCallback(async () => {
    const resolveLayout = () => {
      const fallbackCenter = {
        x: window.innerWidth / 2 + 240,
        y: window.innerHeight / 2,
      };
      const deckCenter = centerOf(deckRef.current) || fallbackCenter;

      const byPosition = gameState.players.reduce((acc, player) => {
        acc[player.position] = player;
        return acc;
      }, {});

      const order = [
        { position: 'bottom', index: 0 },
        { position: 'top', index: 0 },
        { position: 'left', index: 0 },
        { position: 'right', index: 0 },
        { position: 'bottom', index: 1 },
        { position: 'top', index: 1 },
        { position: 'left', index: 1 },
        { position: 'right', index: 1 },
      ];

      const dealOrder = {};
      const dealConfig = {};

      order.forEach((step, idx) => {
        const player = byPosition[step.position];
        if (!player) return;
        const key = `${player.id}-${step.index}`;
        const cardEl = cardRefs.current[key];
        if (!cardEl) return;
        const cardCenter = centerOf(cardEl);
        if (!cardCenter) return;
        dealOrder[key] = idx;
        dealConfig[key] = {
          x: deckCenter.x - cardCenter.x,
          y: deckCenter.y - cardCenter.y,
          rotate: Math.random() * 20 - 10,
        };
      });

      return { order, dealOrder, dealConfig };
    };

    let { order, dealOrder, dealConfig } = resolveLayout();
    if (Object.keys(dealOrder).length === 0) {
      await delay(90);
      ({ order, dealOrder, dealConfig } = resolveLayout());
    }
    if (Object.keys(dealOrder).length === 0) return;

    const runId = Date.now();
    setAnimState((prev) => ({
      ...prev,
      dealPhase: 'dealing',
      dealIndex: -1,
      dealOrder,
      dealConfig,
      dealRunId: runId,
    }));

    await delay(40);
    const waits = [150, 150, 150, 200, 150, 150, 150, 0];
    await runSequence(
      order.map((_, idx) => ({
        fn: () => setAnimState((prev) => ({ ...prev, dealIndex: idx })),
        waitMs: waits[idx] || 0,
      }))
    );
    setAnimState((prev) => ({ ...prev, dealPhase: 'done' }));
  }, [gameState.players, setAnimState]);

  const runCommunityFlip = useCallback(
    async (targets) => {
      await delay(60);
      const runId = Date.now();
      const normalizedTargets = targets?.length ? targets : [0, 1, 2];
      const revealDuration = normalizedTargets.length > 1 ? 1700 : 900;
      setAnimState((prev) => ({
        ...prev,
        flipPhase: 'flipping',
        flipTargets: normalizedTargets,
        flipRunId: runId,
      }));
      await delay(revealDuration / gameSpeed);
      setAnimState((prev) => ({ ...prev, flipPhase: 'done' }));
    },
    [gameSpeed, setAnimState]
  );

  const runShowdownAnimation = useCallback(
    (winnerId, reward) => {
      const runId = Date.now();
      setAnimState((prev) => ({
        ...prev,
        showdownPhase: 'revealing',
        showdownRunId: runId,
        showdownReward: reward,
        winnerId: null,
      }));

      showdownWinnerTimerRef.current = setTimeout(() => {
        setAnimState((prev) => ({
          ...prev,
          showdownPhase: 'winner',
          showdownRunId: runId,
          showdownReward: reward,
          winnerId,
        }));
      }, 900 / gameSpeed);
    },
    [gameSpeed, setAnimState]
  );

  const handleStartGame = useCallback(() => {
    clearAllTimers();
    setAnimState(getInitialAnimState());
    setGameState((prev) => startNewHand(prev));
    setIsPaused(false);
  }, [clearAllTimers, setAnimState, setGameState]);

  const enterBettingPhase = useCallback((currentState, bettingPhase) => {
    const players = currentState.players || [];
    const total = players.length;
    if (!total) {
      return {
        ...currentState,
        phase: bettingPhase,
        currentPlayerIndex: -1,
        animationTrigger: null,
      };
    }

    let firstIndex = ((currentState.dealerIndex ?? 0) + total) % total;
    let guard = 0;
    while (
      players[firstIndex].status === 'folded' ||
      players[firstIndex].status === 'all-in'
    ) {
      firstIndex = (firstIndex + 1) % total;
      guard += 1;
      if (guard >= total) {
        firstIndex = -1;
        break;
      }
    }

    return {
      ...currentState,
      phase: bettingPhase,
      currentPlayerIndex: firstIndex,
      animationTrigger: null,
      players: players.map((p, i) => ({
        ...p,
        isCurrent: i === firstIndex,
        status:
          p.status === 'folded' || p.status === 'all-in'
            ? p.status
            : i === firstIndex
              ? 'waiting'
              : 'waiting',
      })),
    };
  }, []);

  useEffect(() => {
    clearAllTimers();
    return () => clearAllTimers();
  }, [clearAllTimers]);

  useEffect(() => {
    const trigger = gameState.animationTrigger;
    if (!trigger) return;

    if (trigger === 'deal') {
      if (dealForceTimerRef.current) clearTimeout(dealForceTimerRef.current);
      const startedAt = Date.now();
      const forcePreflopMs = 2500 / gameSpeed;
      dealForceTimerRef.current = setTimeout(() => {
        dealForceTimerRef.current = null;
        setGameState((prev) => {
          if (prev.animationTrigger !== 'deal' || prev.phase !== 'DEALING') return prev;
          if (isConnected) return { ...prev, phase: 'PREFLOP', animationTrigger: null };
          return enterPreflop(prev);
        });
      }, forcePreflopMs);
      runDealAnimation().finally(() => {
        if (dealForceTimerRef.current) {
          clearTimeout(dealForceTimerRef.current);
          dealForceTimerRef.current = null;
        }
        const elapsed = Date.now() - startedAt;
        const minDelay = 1500 / gameSpeed;
        const waitMs = Math.max(0, minDelay - elapsed);
        animationTimerRef.current = setTimeout(() => {
          setGameState((prev) => {
            if (prev.animationTrigger !== 'deal') return prev;
            if (isConnected) return { ...prev, phase: 'PREFLOP', animationTrigger: null };
            return enterPreflop(prev);
          });
        }, waitMs);
      });
      return;
    }

    if (trigger === 'flop') {
      runCommunityFlip([0, 1, 2]);
      animationTimerRef.current = setTimeout(() => {
        setGameState((prev) => {
          if (prev.animationTrigger !== 'flop') return prev;
          if ((prev.communityCards?.length || 0) < 3) return { ...prev, animationTrigger: null };
          if (isConnected) return { ...prev, phase: 'FLOP_BETTING', animationTrigger: null };
          return enterBettingPhase(prev, 'FLOP_BETTING');
        });
      }, 1200 / gameSpeed);
      return;
    }

    if (trigger === 'turn') {
      runCommunityFlip([3]);
      animationTimerRef.current = setTimeout(() => {
        setGameState((prev) => {
          if (prev.animationTrigger !== 'turn') return prev;
          if ((prev.communityCards?.length || 0) < 4) return { ...prev, animationTrigger: null };
          if (isConnected) return { ...prev, phase: 'TURN_BETTING', animationTrigger: null };
          return enterBettingPhase(prev, 'TURN_BETTING');
        });
      }, 800 / gameSpeed);
      return;
    }

    if (trigger === 'river') {
      runCommunityFlip([4]);
      animationTimerRef.current = setTimeout(() => {
        setGameState((prev) => {
          if (prev.animationTrigger !== 'river') return prev;
          if ((prev.communityCards?.length || 0) < 5) return { ...prev, animationTrigger: null };
          if (isConnected) return { ...prev, phase: 'RIVER_BETTING', animationTrigger: null };
          return enterBettingPhase(prev, 'RIVER_BETTING');
        });
      }, 800 / gameSpeed);
      return;
    }

    if (trigger === 'showdown') {
      const winnerId =
        gameState.winnerId ??
        gameState.players.find((p) => p.status !== 'folded')?.id ??
        gameState.players[0]?.id ??
        null;
      const reward = gameState.pot;
      runShowdownAnimation(winnerId, reward);

      showdownSettleTimerRef.current = setTimeout(() => {
        setGameState((prev) => {
          const winner = prev.players.find((p) => p.id === winnerId);
          if (!winner) {
            return { ...prev, phase: 'ENDED', animationTrigger: null, pot: 0 };
          }
          const settleLog = {
            id: Date.now(),
            phase: 'SHOWDOWN',
            player: winner.name,
            action: 'bet',
            amount: reward,
            pot: reward,
            timestamp: '刚刚',
          };
          return {
            ...prev,
            phase: 'ENDED',
            animationTrigger: null,
            pot: 0,
            players: prev.players.map((p) => ({
              ...p,
              chips: p.id === winnerId ? p.chips + reward : p.chips,
              status: p.id === winnerId ? 'winner' : p.status,
              isCurrent: false,
            })),
            actionLog: [...(prev.actionLog || []), settleLog],
          };
        });
      }, 3000 / gameSpeed);
    }
  }, [
    gameState.animationTrigger,
    gameState.players,
    gameState.pot,
    gameState.winnerId,
    gameSpeed,
    runCommunityFlip,
    runDealAnimation,
    runShowdownAnimation,
    enterBettingPhase,
    enterPreflop,
    setGameState,
    isConnected,
  ]);

  const BETTING_PHASES = ['PREFLOP', 'FLOP_BETTING', 'TURN_BETTING', 'RIVER_BETTING'];

  useEffect(() => {
    if (isConnected) return;
    if (isPaused) return;
    if (!BETTING_PHASES.includes(gameState.phase)) return;
    if (gameState.animationTrigger) return;
    if (!isBettingRoundComplete(gameState)) return;

    const minDelay = 500;

    phaseTimerRef.current = setTimeout(() => {
      setGameState((latest) => {
        if (latest.animationTrigger) return latest;
        if (!BETTING_PHASES.includes(latest.phase)) return latest;
        if (!isBettingRoundComplete(latest)) return latest;

        return advanceToNextPhase(latest);
      });
    }, (1000 + minDelay) / gameSpeed);

    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    };
  }, [
    gameState.phase,
    gameState.animationTrigger,
    gameState.currentPlayerIndex,
    gameSpeed,
    isPaused,
    isConnected,
  ]);

  useEffect(() => {
    if (isConnected) return;
    if (isPaused) return;
    if (!BETTING_PHASES.includes(gameState.phase)) return;
    if (gameState.animationTrigger) return;
    if (gameState.currentPlayerIndex < 0) return;
    if (isBettingRoundComplete(gameState)) return;

    const actingPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!actingPlayer || actingPlayer.status !== 'waiting') return;

    setGameState((prev) => {
      if (prev.currentPlayerIndex < 0) return prev;
      if (prev.animationTrigger) return prev;

      const player = prev.players[prev.currentPlayerIndex];
      if (!player || player.status !== 'waiting') return prev;

      return {
        ...prev,
        players: prev.players.map((p, i) => {
          if (p.status === 'folded') return { ...p, isCurrent: false };
          if (i === prev.currentPlayerIndex) {
            return { ...p, status: 'thinking', isCurrent: true };
          }
          return {
            ...p,
            status: p.status === 'thinking' ? 'waiting' : p.status,
            isCurrent: false,
          };
        }),
      };
    });

    aiTimerRef.current = setTimeout(() => {
      setGameState((prev) => {
        if (prev.animationTrigger) return prev;
        if (!BETTING_PHASES.includes(prev.phase)) return prev;
        if (prev.currentPlayerIndex < 0) return prev;
        if (isBettingRoundComplete(prev)) return prev;

        const player = prev.players[prev.currentPlayerIndex];
        if (!player) return prev;
        if (player.status !== 'thinking') return prev;

        const decision = getAIDecision(player, prev);
        return processPlayerAction(prev, player.id, decision.action, decision.amount);
      });
    }, 2000 / gameSpeed);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    };
  }, [
    gameState.phase,
    gameState.animationTrigger,
    gameState.currentPlayerIndex,
    gameSpeed,
    isPaused,
    isConnected,
  ]);

  useEffect(() => {
    console.log(
      '%c[GameFlow]',
      'color:#e7c86c;font-weight:bold',
      `phase=${gameState.phase}`,
      `trigger=${gameState.animationTrigger}`,
      `communityCards=${gameState.communityCards?.length ?? 0}`,
      `currentPlayer=${gameState.currentPlayerIndex}`,
      `deckSize=${gameState.deck?.length ?? 0}`
    );
  }, [gameState.phase, gameState.animationTrigger, gameState.communityCards?.length, gameState.currentPlayerIndex]);

  return (
    <motion.div className="h-screen bg-bg text-paper relative overflow-hidden flex flex-col">
      <motion.div className="bg-noise" aria-hidden="true" />

      <motion.header className="relative z-10 px-8 h-14 flex items-center flex-shrink-0">
        <motion.div className="flex items-center justify-between w-full">
          <motion.div className="flex items-baseline gap-3">
            <motion.div className="font-display text-gold text-xl tracking-wide">
              PokerMind Arena
            </motion.div>
            <motion.div className="text-xs text-paper/70 font-mono">{handNo}</motion.div>
          </motion.div>

          <motion.div className="flex items-center gap-8">
            {isConnected && (
              <motion.span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                观战中
              </motion.span>
            )}
            <GamePhaseIndicator phase={gameState.phase} />
            <motion.div className="text-right">
              <motion.div className="text-[11px] uppercase tracking-widest text-paper/60">
                Total Pot
              </motion.div>
              <motion.div className="font-display text-gold text-lg">
                ${gameState.pot.toLocaleString()}
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.header>

      <motion.main className="relative z-10 px-8 flex-1 min-h-0 flex items-center justify-center">
        <motion.div className="relative w-full max-w-[1200px] h-full">
          <PokerTable
            gameState={gameState}
            animState={animState}
            animationRefs={{ deckRef, registerCardRef }}
          />
        </motion.div>
      </motion.main>

      <motion.footer className="relative z-10 px-8 h-[200px] flex-shrink-0 overflow-hidden">
        <motion.div className="mx-auto w-[1200px] max-w-[calc(100vw-4rem)] h-full flex items-stretch">
          <div className="w-[780px]">
            <ActionLog logs={gameState.actionLog} />
          </div>
        </motion.div>
      </motion.footer>

      <AnimationDemo
        open={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        onStart={handleStartGame}
        onConnectAndStart={createRoomAndStart}
        onPauseToggle={() => setIsPaused((prev) => !prev)}
        onSpeedUp={() => setGameSpeed((prev) => (prev >= 2 ? 1 : 2))}
        onReset={() => resetAll()}
        phase={gameState.phase}
        currentPlayerName={gameState.players[gameState.currentPlayerIndex]?.name}
        isPaused={isPaused}
        speed={gameSpeed}
        isConnected={isConnected}
      />

      {!isDemoOpen ? (
        <motion.button
          type="button"
          aria-label="显示控制面板"
          onClick={() => setIsDemoOpen(true)}
          className="fixed bottom-6 right-6 z-[99] h-12 w-12 rounded-full bg-gradient-to-br from-[#e7c86c] via-[#c9a84c] to-[#a8741c] text-bg text-lg shadow-[0_16px_40px_rgba(0,0,0,0.45)] transition hover:brightness-110"
        >
          ⚙
        </motion.button>
      ) : null}
    </motion.div>
  );
}
