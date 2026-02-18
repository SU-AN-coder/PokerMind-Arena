import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/game';
import { SpeechBubble } from './SpeechBubble';

export function DialogueStream() {
  const messages = useGameStore((s) => s.dialogue);
  const typingAgent = useGameStore((s) => s.typingAgent);
  const typingText = useGameStore((s) => s.typingText);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typingText]);

  return (
    <div ref={ref} className="h-[220px] overflow-y-auto rounded-xl p-3 bg-gray-900/60 space-y-2">
      <h3 className="text-xs font-bold text-gray-400">💬 AI 对话</h3>
      <AnimatePresence>
        {messages.slice(-10).map((m, i) => (
          <SpeechBubble key={`${m.name}-${i}-${m.speech}`} avatar={m.avatar} name={m.name} text={m.speech} target={m.target} emotion={m.emotion} isTyping={false} />
        ))}
      </AnimatePresence>
      {typingAgent ? <SpeechBubble avatar={typingAgent.avatar} name={typingAgent.name} text={typingText} isTyping={true} /> : null}
    </div>
  );
}
