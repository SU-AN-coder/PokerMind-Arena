import { useEffect } from 'react';
import { Header } from '@/components/Layout/Header';
import { GameRoom } from '@/components/Layout/GameRoom';
import { disconnectSocket, initSocket, joinGame } from '@/lib/socket';

export function App() {
  useEffect(() => {
    initSocket();
    const gameId = new URLSearchParams(window.location.search).get('gameId') ?? 'demo-game-001';
    joinGame(gameId);

    return () => disconnectSocket();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <Header />
        <GameRoom />
      </div>
    </div>
  );
}
