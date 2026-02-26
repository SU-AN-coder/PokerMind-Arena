/**
 * PlayerSeat：玩家座位（头像/信息卡、手牌、本轮下注、状态指示、庄家按钮与思考气泡）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import PlayingCard from '../PlayingCard/PlayingCard.jsx';
import AIThinkingBubble from '../AIThinkingBubble/AIThinkingBubble.jsx';
import WinnerOverlay from '../WinnerOverlay/WinnerOverlay.jsx';
import ChipStack from '../ChipStack/ChipStack.jsx';

const ACTIVE_PULSE = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(201, 168, 76, 0)',
      '0 0 20px rgba(201, 168, 76, 0.8)',
      '0 0 0px rgba(201, 168, 76, 0)',
    ],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const CURRENT_PULSE = {
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(201,168,76,0.0)',
      '0 0 0 3px rgba(201,168,76,0.22)',
      '0 0 26px rgba(201,168,76,0.18)',
      '0 0 0 3px rgba(201,168,76,0.22)',
    ],
  },
  transition: {
    duration: 1.3,
    repeat: Infinity,
    repeatType: 'mirror',
  },
};

function getStatusVisual({ isFolded, isThinking, isCurrent }) {
  if (isFolded) {
    return {
      className: 'opacity-40 grayscale',
      borderColor: 'rgba(240,230,211,0.10)',
      animate: {},
      transition: undefined,
    };
  }

  if (isThinking) {
    return {
      className: '',
      borderColor: 'rgba(201,168,76,0.55)',
      animate: ACTIVE_PULSE.animate,
      transition: ACTIVE_PULSE.transition,
    };
  }

  if (isCurrent) {
    return {
      className: '',
      borderColor: 'rgba(201,168,76,0.55)',
      animate: CURRENT_PULSE.animate,
      transition: CURRENT_PULSE.transition,
    };
  }

  return {
    className: '',
    borderColor: 'rgba(240,230,211,0.14)',
    animate: {},
    transition: undefined,
  };
}

function bubblePlacement(position) {
  if (position === 'top') {
    return { className: 'right-full mr-4 top-1/2 -translate-y-1/2', arrow: 'right' };
  }
  if (position === 'bottom') {
    return { className: 'left-full ml-4 top-1/2 -translate-y-1/2', arrow: 'left' };
  }
  if (position === 'left') {
    return { className: 'top-full mt-3 left-1/2 -translate-x-1/2', arrow: 'top' };
  }
  return { className: 'bottom-full mb-3 left-1/2 -translate-x-1/2', arrow: 'bottom' };
}

function foldOffset(position) {
  if (position === 'right') return { x: -60, y: 40 };
  if (position === 'left') return { x: 60, y: 40 };
  if (position === 'top') return { x: 0, y: 60 };
  return { x: 0, y: -60 };
}

export default function PlayerSeat({
  player,
  position,
  animState,
  registerCardRef,
}) {
  const isBottom = position === 'bottom';
  const isThinking = player.status === 'thinking';
  const isFolded = player.status === 'folded';
  const isFoldAnimating = animState?.foldTarget === player.id;
  const isWinner =
    animState?.showdownPhase === 'winner' && animState?.winnerId === player.id;
  const { className, borderColor, animate: pulseAnimate, transition: pulseTransition } =
    getStatusVisual({
      isFolded: isFolded || isFoldAnimating,
      isThinking,
      isCurrent: !!player.isCurrent,
    });
  const bubble = bubblePlacement(position);
  const cardKeys = useMemo(() => [`${player.id}-0`, `${player.id}-1`], [player.id]);
  const seatControls = useAnimationControls();
  const dealControls = [useAnimationControls(), useAnimationControls()];
  const flipControls = [useAnimationControls(), useAnimationControls()];
  const dealtRef = useRef([false, false]);
  const [faceDownState, setFaceDownState] = useState([!isBottom, !isBottom]);

  useEffect(() => {
    if (isFoldAnimating || isFolded) {
      seatControls.start({
        opacity: 0.45,
        filter: 'grayscale(1) brightness(0.7)',
        transition: { duration: 0.8, ease: 'easeOut' },
      });
    } else {
      seatControls.start({
        opacity: 1,
        filter: 'grayscale(0) brightness(1)',
        transition: { duration: 0.4, ease: 'easeOut' },
      });
    }
  }, [isFoldAnimating, isFolded, seatControls]);

  useEffect(() => {
    if (!animState) return;
    if (animState.dealPhase === 'idle') {
      dealtRef.current = [false, false];
      dealControls.forEach((controls) => {
        controls.set({ opacity: 0, scale: 1, x: 0, y: 0, rotate: 0 });
      });
    }
  }, [animState?.dealPhase, animState?.dealRunId]);

  useEffect(() => {
    if (!animState || animState.dealPhase === 'idle') return;
    cardKeys.forEach((key, idx) => {
      const orderIndex = animState.dealOrder?.[key];
      if (orderIndex == null) return;
      const shouldDeal =
        animState.dealPhase === 'done' || animState.dealIndex >= orderIndex;
      if (!shouldDeal || dealtRef.current[idx]) return;
      const config = animState.dealConfig?.[key];
      if (!config) return;
      dealControls[idx].set({
        x: config.x,
        y: config.y,
        rotate: config.rotate,
        opacity: 0,
        scale: 0.8,
      });
      dealControls[idx].start({
        x: [config.x, config.x * 0.35, 0],
        y: [config.y, config.y - 20, 0],
        rotate: [config.rotate, 0],
        opacity: 1,
        scale: 1,
        transition: {
          duration: 0.4,
          ease: [0.25, 0.46, 0.45, 0.94],
          x: { type: 'spring', stiffness: 300, damping: 20 },
          y: { type: 'spring', stiffness: 300, damping: 20 },
        },
      });
      dealtRef.current[idx] = true;
    });
  }, [animState, cardKeys]);

  useEffect(() => {
    if (!animState) return;
    if (animState.dealPhase === 'idle') {
      setFaceDownState([true, true]);
      return;
    }
    if (animState.dealPhase === 'dealing' || animState.dealPhase === 'done') {
      setFaceDownState([false, false]);
      return;
    }
    if (animState.showdownPhase === 'idle') {
      setFaceDownState([!isBottom, !isBottom]);
    }
  }, [animState?.dealPhase, animState?.showdownPhase, isBottom]);

  useEffect(() => {
    if (animState?.showdownPhase === 'revealing') return;
    flipControls.forEach((controls, idx) => {
      controls.set({ rotateY: faceDownState[idx] ? 180 : 0, scale: 1 });
    });
  }, [faceDownState, animState?.showdownPhase]);

  useEffect(() => {
    if (!animState) return;
    if (animState.showdownPhase === 'revealing' && !isFolded) {
      setFaceDownState([true, true]);
      flipControls.forEach((controls) => {
        controls.set({ rotateY: 180, scale: 1 });
      });
      flipControls.forEach((controls, idx) => {
        controls
          .start({ rotateY: 90, scale: 1.15, transition: { duration: 0.15 } })
          .then(() => {
            setFaceDownState((prev) => {
              const next = [...prev];
              next[idx] = false;
              return next;
            });
            return controls.start({
              rotateY: 0,
              scale: 1,
              transition: { duration: 0.15 },
            });
          });
      });
    }
  }, [animState?.showdownPhase, isFolded]);

  useEffect(() => {
    if (!isFoldAnimating) return;
    const offset = foldOffset(position);
    dealControls.forEach((controls) => {
      controls.start({
        x: offset.x,
        y: offset.y,
        opacity: 0,
        scale: 0.7,
        rotate: Math.random() * 30 - 15,
        transition: { duration: 0.5, ease: 'easeIn' },
      });
    });
  }, [isFoldAnimating, position]);

  const cardRefA = registerCardRef ? registerCardRef(cardKeys[0]) : undefined;
  const cardRefB = registerCardRef ? registerCardRef(cardKeys[1]) : undefined;
  return (
    <motion.div className={`relative ${className}`} animate={seatControls}>
      <motion.div className={`absolute ${bubble.className}`}>
        <AIThinkingBubble
          player={player}
          arrowDirection={bubble.arrow}
          isCurrent={player.isCurrent}
          lastAction={player.lastAction}
        />
      </motion.div>

      {isWinner ? <WinnerOverlay runId={animState?.showdownRunId} /> : null}

      <motion.div
        className="rounded-2xl border bg-black/30 backdrop-blur-sm px-3 py-2 relative z-20"
        style={{ borderColor }}
        animate={pulseAnimate}
        transition={pulseTransition}
      >
        <motion.div className="flex items-center gap-2">
          <motion.div
            className="h-8 w-8 rounded-full grid place-items-center font-display text-bg shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            style={{ background: player.personalityColor }}
          >
            {player.avatar}
          </motion.div>

          <motion.div className="min-w-0">
            <motion.div className="flex items-center gap-2">
              <motion.div className="font-display text-paper text-xs tracking-wide truncate">
                {player.name}
              </motion.div>
              {player.isDealer ? (
                <motion.div className="h-4 w-4 rounded-full bg-paper text-bg text-[10px] grid place-items-center font-display">
                  D
                </motion.div>
              ) : null}
            </motion.div>
            <motion.div className="mt-0 flex items-center gap-2">
              <motion.span
                className="text-[10px] rounded-full px-2 py-0.5 font-mono text-paper/90 border"
                style={{ borderColor: `${player.personalityColor}55` }}
              >
                {player.personality}
              </motion.span>
              <motion.div className="text-[11px]">
                <ChipStack
                  amount={player.chips}
                  showIcon={false}
                  textClassName="text-[11px]"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div className="mt-2 flex items-center justify-center gap-1.5">
          <motion.div ref={cardRefA} animate={dealControls[0]}>
            <PlayingCard
              card={player.cards?.[0]}
              faceDown={faceDownState[0]}
              size="xs"
              flipAnimation={{
                animate: flipControls[0],
                style: { transformStyle: 'preserve-3d' },
              }}
            />
          </motion.div>
          <motion.div ref={cardRefB} animate={dealControls[1]}>
            <PlayingCard
              card={player.cards?.[1]}
              faceDown={faceDownState[1]}
              size="xs"
              flipAnimation={{
                animate: flipControls[1],
                style: { transformStyle: 'preserve-3d' },
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
