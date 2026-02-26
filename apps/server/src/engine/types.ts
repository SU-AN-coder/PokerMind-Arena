/**
 * PokerMind Arena - 游戏引擎类型定义
 */

// ============ 扑克牌类型 ============

/** 
 * 扑克牌字符串格式 (pokersolver 兼容)
 * 格式: "Ah" = A♥, "Kd" = K♦, "Qc" = Q♣, "Js" = J♠
 */
export type CardString = string;

/** 花色 */
export type Suit = 'h' | 'd' | 'c' | 's';

/** 点数 */
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

// ============ 玩家类型 ============

/** 玩家状态 */
export type PlayerStatus = 'active' | 'allin' | 'folded' | 'eliminated';

/** 玩家 */
export interface Player {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  holeCards: [CardString, CardString];
  status: PlayerStatus;
}

/** 创建玩家时的输入 */
export type PlayerInput = Omit<Player, 'chips' | 'status' | 'holeCards'>;

// ============ 游戏阶段 ============

/** 游戏阶段 */
export type GamePhase = 
  | 'waiting'      // 等待开始
  | 'preflop'      // 发手牌，第一轮决策
  | 'flop'         // 发3张公共牌
  | 'turn'         // 发第4张
  | 'river'        // 发第5张
  | 'showdown'     // 摊牌比较
  | 'ended';       // 游戏结束

// ============ 玩家动作 ============

/** 动作类型 (All-in or Fold 简化版) */
export type ActionType = 'allin' | 'fold';

/** 玩家动作 */
export interface PlayerAction {
  playerId: string;
  action: ActionType;
  speech?: string;       // AI说的话 (可选)
  emotion?: string;      // 情绪 (可选)
  target?: string;       // @某人
  decisionHash?: string; // 决策哈希 (用于链上验证)
  timestamp: number;
}

// ============ 游戏状态 ============

/** 游戏状态 */
export interface GameState {
  gameId: string;
  phase: GamePhase;
  round: number;
  players: Player[];
  communityCards: CardString[];
  pot: number;
  activePlayerIndex: number;
  /** 庄家/按钮位置（用于小盲、大盲） */
  dealerIndex: number;
  deck: CardString[];
  actionHistory: PlayerAction[];
  winner?: Player;
}

/** 游戏配置 */
export interface GameConfig {
  /** 初始筹码（每人） */
  initialChips: number;
  /** 总轮数 */
  roundCount: number;
  /** 小盲注 */
  smallBlind: number;
  /** 大盲注 */
  bigBlind: number;
}

/** 默认游戏配置 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  initialChips: 100,
  roundCount: 5,
  smallBlind: 10,
  bigBlind: 20,
};

// ============ 游戏事件 ============

/** 玩家加入事件 */
export interface PlayerJoinedEvent {
  id: string;
  name: string;
  avatar: string;
}

/** 轮次开始事件 */
export interface RoundStartedEvent {
  round: number;
  pot: number;
  players: Player[];
  activePlayerIndex?: number;
  dealerIndex?: number;
  smallBlind?: number;
  bigBlind?: number;
}

/** 发牌事件 */
export interface CardsDealtEvent {
  players: {
    id: string;
    name: string;
    holeCards: [CardString, CardString];
  }[];
}

/** 公共牌事件 */
export interface CommunityCardsEvent {
  phase: GamePhase;
  cards: CardString[];
}

/** All-in 事件 */
export interface PlayerAllinEvent {
  player: Player;
  pot: number;
  speech?: string;
}

/** Fold 事件 */
export interface PlayerFoldEvent {
  player: Player;
  speech?: string;
}

/** 阶段变更事件 */
export interface PhaseChangedEvent {
  phase: GamePhase;
}

/** 摊牌事件 */
export interface ShowdownEvent {
  players: {
    id: string;
    name: string;
    holeCards: [CardString, CardString];
    hand: string;  // 牌型描述
  }[];
  communityCards: CardString[];
}

/** 轮次结束事件 */
export interface RoundEndedEvent {
  winners: {
    id: string;
    name: string;
    avatar: string;
    winAmount: number;
  }[];
  pot: number;
}

/** 游戏结束事件 */
export interface GameEndedEvent {
  winner: Player;
  players: Player[];
  totalRounds: number;
}

// ============ 事件映射 ============

export interface GameEventMap {
  'player_joined': PlayerJoinedEvent;
  'round_started': RoundStartedEvent;
  'cards_dealt': CardsDealtEvent;
  'community_cards': CommunityCardsEvent;
  'player_allin': PlayerAllinEvent;
  'player_fold': PlayerFoldEvent;
  'phase_changed': PhaseChangedEvent;
  'showdown': ShowdownEvent;
  'round_ended': RoundEndedEvent;
  'game_ended': GameEndedEvent;
}

export type GameEventName = keyof GameEventMap;
