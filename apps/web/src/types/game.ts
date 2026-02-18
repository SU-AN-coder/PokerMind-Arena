export interface Player {
  id: string;
  name: string;
  avatar: string;
  holeCards?: [string, string];
  stack: number;
  status: 'active' | 'allin' | 'folded' | 'eliminated';
}

export interface DialogueMessage {
  name: string;
  avatar: string;
  speech: string;
  emotion: 'confident' | 'angry' | 'mocking' | 'nervous' | 'neutral';
  target?: string | null;
}

export interface VerificationData {
  gameId: string;
  ipfsCid: string;
  onChainHash: string;
  explorerUrl: string;
  txHash: string;
}

export interface OddsInfo {
  aiId: string;
  aiName: string;
  avatar: string;
  odds: number;
  percentage: number;
  totalBets: number;
  betCount: number;
}

export interface SimulatedBet {
  viewerName: string;
  optionId: string;
  optionAvatar: string;
  amount: number;
  timestamp: number;
  comment?: string;
}

export interface MarketSnapshot {
  gameId: string;
  status: 'open' | 'locked' | 'resolved';
  totalPool: number;
  totalBettors: number;
  options: OddsInfo[];
  recentBets: SimulatedBet[];
}

export interface GameStatePayload {
  gameId?: string;
  phase?: 'waiting' | 'playing' | 'showdown' | 'ended';
  round?: number;
  players?: Player[];
  communityCards?: string[];
  pot?: number;
  activePlayerId?: string | null;
}
