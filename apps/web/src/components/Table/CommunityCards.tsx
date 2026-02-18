import { PlayingCard } from './PlayingCard';

export function CommunityCards({ cards }: { cards: string[] }) {
  return (
    <div className="flex gap-2 justify-center mb-2">
      {cards.map((card, i) => (
        <PlayingCard key={`${card}-${i}`} card={card} delay={i * 0.1} />
      ))}
      {[...Array(Math.max(0, 5 - cards.length))].map((_, i) => (
        <div key={`empty-${i}`} className="w-12 h-16 rounded-md border-2 border-dashed border-green-700/70" />
      ))}
    </div>
  );
}
