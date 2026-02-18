import { io, type Socket } from 'socket.io-client';
import { useGameStore } from '@/stores/game';
import type { MarketSnapshot, Player, SimulatedBet } from '@/types/game';

let socket: Socket | null = null;

export function initSocket(serverUrl?: string) {
  if (socket) return socket;

  socket = io(serverUrl ?? import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001');

  socket.on('game_state', (state) => {
    const mapped = mapPublicState(state);
    useGameStore.getState().setGameState(mapped);
  });

  socket.on('round_started', (data) => {
    useGameStore.getState().setGameState({
      round: data.round,
      pot: data.pot,
      players: mapPlayers(data.players)
    });
  });

  socket.on('cards_dealt', (data) => {
    useGameStore.getState().setGameState({
      players: mapPlayers(data.players)
    });
  });

  socket.on('community_cards', (data) => {
    useGameStore.getState().setGameState({
      communityCards: data.cards
    });
  });

  socket.on('player_allin', (data) => {
    updatePlayer(data.player, data.pot);
  });

  socket.on('player_fold', (data) => {
    updatePlayer(data.player, data.pot);
  });

  socket.on('ai_thinking', (data) => {
    useGameStore.getState().setTyping({ name: data.agentName, avatar: data.avatar }, '');
  });

  socket.on('ai_speech_chunk', (data) => {
    useGameStore.getState().appendTypingText(data.chunk ?? '');
  });

  socket.on('ai_decision', (data) => {
    const store = useGameStore.getState();
    store.setTyping(null, '');
    store.addDialogue({
      name: data.agentName,
      avatar: data.avatar,
      speech: data.speech,
      emotion: data.emotion ?? 'neutral',
      target: data.target ?? null
    });
  });

  socket.on('market_snapshot', (snapshot: MarketSnapshot | null) => {
    useGameStore.getState().setMarket(snapshot);
  });

  socket.on('market_update', (snapshot: MarketSnapshot) => {
    useGameStore.getState().setMarket(snapshot);
  });

  socket.on('new_bet', (bet: SimulatedBet) => {
    useGameStore.getState().addLiveBet(bet);
  });

  socket.on('game_committed', (data) => {
    useGameStore.getState().setVerification({
      gameId: data.gameId,
      ipfsCid: data.ipfsCid,
      onChainHash: data.decisionHash ?? data.onChainHash,
      explorerUrl: data.explorerUrl,
      txHash: data.txHash
    });
  });

  return socket;
}

export function joinGame(gameId: string) {
  if (!socket) return;
  socket.emit('join_as_spectator', { roomId: gameId });
  socket.emit('join_market', gameId);
  socket.emit('get_market_snapshot', gameId);
}

export function placeBet(gameId: string, aiId: string, amount: number) {
  if (!socket) return;
  const odUserId = localStorage.getItem('odUserId') ?? `viewer_${Math.floor(Math.random() * 9999)}`;
  localStorage.setItem('odUserId', odUserId);

  socket.emit('place_bet', {
    gameId,
    odUserId,
    optionId: aiId,
    aiId,
    amount
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

function mapPlayers(players: any[] = []): Player[] {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar ?? '🎭',
    holeCards: p.holeCards,
    stack: typeof p.stack === 'number' ? p.stack : p.chips ?? 0,
    status: normalizeStatus(p.status)
  }));
}

function mapPublicState(state: any) {
  return {
    gameId: state.gameId,
    phase: state.phase,
    round: state.round,
    pot: state.pot,
    communityCards: state.communityCards ?? [],
    players: mapPlayers(state.players)
  };
}

function updatePlayer(player: any, pot?: number) {
  const store = useGameStore.getState();
  const nextPlayers = store.players.map((p) =>
    p.id === player.id
      ? {
          ...p,
          stack: typeof player.stack === 'number' ? player.stack : player.chips ?? p.stack,
          status: normalizeStatus(player.status),
          holeCards: player.holeCards ?? p.holeCards
        }
      : p
  );

  store.setGameState({
    players: nextPlayers,
    pot: typeof pot === 'number' ? pot : store.pot
  });
}

function normalizeStatus(status: string): Player['status'] {
  if (status === 'allin') return 'allin';
  if (status === 'folded') return 'folded';
  if (status === 'eliminated') return 'eliminated';
  return 'active';
}
