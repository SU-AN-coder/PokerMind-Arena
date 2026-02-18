import { create } from 'zustand';
import type {
  DialogueMessage,
  GameStatePayload,
  MarketSnapshot,
  Player,
  SimulatedBet,
  VerificationData
} from '@/types/game';

interface GameStore {
  gameId: string | null;
  phase: 'waiting' | 'playing' | 'showdown' | 'ended';
  round: number;
  players: Player[];
  communityCards: string[];
  pot: number;
  activePlayerId: string | null;
  dialogue: DialogueMessage[];
  typingAgent: { name: string; avatar: string } | null;
  typingText: string;
  market: MarketSnapshot | null;
  liveBets: SimulatedBet[];
  verification: VerificationData | null;
  setGameState: (state: GameStatePayload) => void;
  addDialogue: (msg: DialogueMessage) => void;
  setTyping: (agent: { name: string; avatar: string } | null, text?: string) => void;
  appendTypingText: (chunk: string) => void;
  setMarket: (market: MarketSnapshot | null) => void;
  addLiveBet: (bet: SimulatedBet) => void;
  setVerification: (data: VerificationData | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameId: null,
  phase: 'waiting',
  round: 1,
  players: [],
  communityCards: [],
  pot: 0,
  activePlayerId: null,
  dialogue: [],
  typingAgent: null,
  typingText: '',
  market: null,
  liveBets: [],
  verification: null,

  setGameState: (state) =>
    set((s) => ({
      ...s,
      ...state,
      gameId: state.gameId ?? s.gameId
    })),

  addDialogue: (msg) =>
    set((s) => ({
      dialogue: [...s.dialogue.slice(-20), msg]
    })),

  setTyping: (agent, text = '') => set({ typingAgent: agent, typingText: text }),

  appendTypingText: (chunk) =>
    set((s) => ({ typingText: s.typingText + chunk })),

  setMarket: (market) => set({ market }),

  addLiveBet: (bet) =>
    set((s) => ({
      liveBets: [...s.liveBets.slice(-20), bet]
    })),

  setVerification: (data) => set({ verification: data })
}));
