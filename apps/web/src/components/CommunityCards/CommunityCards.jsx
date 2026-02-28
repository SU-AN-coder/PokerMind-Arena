import { useEffect, useState, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import PlayingCard from '../PlayingCard/PlayingCard.jsx';
import { delay } from '../../utils/animations';
import ChipStack from '../ChipStack/ChipStack.jsx';

const CARD_SLOTS = [0, 1, 2, 3, 4];

const PHASE_LABEL = {
  FLOP: { icon: '●', label: 'FLOP' },
  FLOP_BETTING: { icon: '●', label: 'FLOP' },
  TURN: { icon: '◇', label: 'TURN' },
  TURN_BETTING: { icon: '◇', label: 'TURN' },
  RIVER: { icon: '◇', label: 'RIVER' },
  RIVER_BETTING: { icon: '◇', label: 'RIVER' },
  SHOWDOWN: { icon: '◆', label: 'SHOWDOWN' },
};

export default function CommunityCards({ communityCards, pot, phase, animState }) {
  const cards = CARD_SLOTS.map((i) => communityCards?.[i] ?? null);
  const [faceDown, setFaceDown] = useState([true, true, true, true, true]);
  const [glow, setGlow] = useState([false, false, false, false, false]);
  const prevLengthRef = useRef(0);
  
  const flipControls = [
    useAnimationControls(),
    useAnimationControls(),
    useAnimationControls(),
    useAnimationControls(),
    useAnimationControls(),
  ];

  useEffect(() => {
    const currentLength = communityCards?.length || 0;

    if (currentLength === 0 && prevLengthRef.current > 0) {
      prevLengthRef.current = 0;
      setFaceDown([true, true, true, true, true]);
      flipControls.forEach((c) => c.set({ rotateY: 180, scale: 1 }));
      return;
    }

    if (currentLength > prevLengthRef.current) {
      const prevLen = prevLengthRef.current;
      setFaceDown((prev) =>
        prev.map((val, idx) =>
          idx >= prevLen && idx < currentLength ? true : val
        )
      );
      for (let i = prevLen; i < currentLength; i++) {
        flipControls[i]?.set({ rotateY: 180, scale: 1 });
      }
      prevLengthRef.current = currentLength;
    }
  }, [communityCards?.length]);

  useEffect(() => {
    if (animState?.flipPhase !== 'flipping') return;
    const targets = animState?.flipTargets?.length ? animState.flipTargets : [0, 1, 2];
    let cancelled = false;

    const run = async () => {
      setFaceDown((prev) =>
        prev.map((value, idx) => (targets.includes(idx) ? true : value))
      );
      flipControls.forEach((controls, idx) => {
        if (targets.includes(idx)) {
          controls.set({ rotateY: 180, scale: 1 });
        }
      });

      for (const i of targets) {
        if (cancelled) return;
        await flipControls[i].start({
          rotateY: 90,
          scale: 1.15,
          transition: { duration: 0.15 },
        });
        if (cancelled) return;
        setFaceDown((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
        await delay(150);
        setGlow((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        await flipControls[i].start({
          rotateY: 0,
          scale: 1,
          transition: { duration: 0.15 },
        });
        setTimeout(() => {
          setGlow((prev) => {
            const next = [...prev];
            next[i] = false;
            return next;
          });
        }, 600);
        await delay(200);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [animState?.flipPhase, animState?.flipRunId, animState?.flipTargets]);

  useEffect(() => {
    if (animState?.flipPhase === 'flipping') return;
    setGlow([false, false, false, false, false]);
    const len = communityCards?.length || 0;
    flipControls.forEach((controls, idx) => {
      controls.set({ rotateY: idx < len ? 0 : 180, scale: 1 });
    });
  }, [animState?.flipPhase, communityCards?.length]);

  const phaseConfig = PHASE_LABEL[phase];

  return (
    <motion.div className="text-center relative z-[5]">
      <motion.div className="font-display text-gold text-[12px] tracking-[0.18em] uppercase mb-3">
        COMMUNITY CARDS
      </motion.div>
      {animState?.flipPhase === 'flipping' ? (
        <motion.div
          key={`table-glow-${animState?.flipRunId}`}
          className="absolute -inset-6 rounded-[40px] bg-emerald-300/20 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ) : null}

      <motion.div className="flex items-center justify-center gap-3 relative z-10">
        {CARD_SLOTS.map((idx) => {
          const c = cards[idx];
          return c ? (
            <motion.div
              key={`${c}-${idx}`}
              className="relative"
              animate={
                glow[idx]
                  ? {
                      boxShadow: [
                        '0 0 0 rgba(201,168,76,0)',
                        '0 0 24px rgba(201,168,76,0.65)',
                        '0 0 0 rgba(201,168,76,0)',
                      ],
                    }
                  : { boxShadow: '0 0 0 rgba(201,168,76,0)' }
              }
              transition={{ duration: 0.6 }}
            >
              <PlayingCard
                card={c}
                faceDown={faceDown[idx]}
                size="md"
                flipAnimation={{
                  animate: flipControls[idx],
                  style: { transformStyle: 'preserve-3d' },
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`placeholder-${idx}`}
              className="w-[78px] h-[110px] rounded-lg border-2 border-dashed border-gold/30 bg-[#0d3320]/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]"
            />
          );
        })}
      </motion.div>

      {phaseConfig ? (
        <motion.div className="mt-3 flex items-center justify-center gap-2 font-display text-[13px] tracking-[0.22em] text-gold">
          <span className="text-[16px]">{phaseConfig.icon}</span>
          <span>{phaseConfig.label}</span>
        </motion.div>
      ) : null}

      <motion.div className="mt-4 flex flex-col items-center gap-1">
        <motion.div className="text-[11px] font-mono uppercase tracking-widest text-paper/60">
          Pot
        </motion.div>
        <motion.div className="rounded-full border border-gold/40 bg-black/30 px-4 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <ChipStack amount={pot} showIcon textClassName="text-lg" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
