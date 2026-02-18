import { motion } from 'framer-motion';

const COLORS: Record<string, string> = {
  confident: 'border-l-yellow-500',
  angry: 'border-l-red-500',
  mocking: 'border-l-purple-500',
  nervous: 'border-l-gray-400',
  neutral: 'border-l-blue-500'
};

export function SpeechBubble({
  avatar,
  name,
  text,
  target,
  emotion = 'neutral',
  isTyping
}: {
  avatar: string;
  name: string;
  text: string;
  target?: string | null;
  emotion?: string;
  isTyping: boolean;
}) {
  const highlighted = text.replace(/@(\S+)/g, '<span class="text-blue-400 font-bold">@$1</span>');
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={`p-2 rounded-lg bg-gray-800/90 border-l-4 ${COLORS[emotion] ?? COLORS.neutral}`}>
      <div className="flex items-center gap-2 text-sm mb-1">
        <span className="text-xl">{avatar}</span>
        <span className="font-semibold text-white">{name}</span>
        {target ? <span className="text-blue-400 text-xs">→ @{target}</span> : null}
      </div>
      <p className="text-sm text-gray-200" dangerouslySetInnerHTML={{ __html: highlighted }} />
      {isTyping ? <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" /> : null}
    </motion.div>
  );
}
