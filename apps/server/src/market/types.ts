/**
 * PokerMind Arena - 预测市场类型定义
 */

/** 预测市场状态 */
export type MarketStatus = 'open' | 'locked' | 'resolved';

/** 市场选项（AI 选手） */
export interface MarketOption {
  aiId: string;
  aiName: string;
  avatar: string;
  totalBets: number;      // 该选项总投注额
  betCount: number;       // 投注人数（含模拟）
}

/** 预测市场 */
export interface PredictionMarket {
  gameId: string;
  question: string;       // "谁会赢得这场比赛？"
  status: MarketStatus;
  options: MarketOption[];
  totalPool: number;      // 总池
  createdAt: number;
  lockedAt?: number;      // 锁定时间
  resolvedAt?: number;    // 结算时间
  winnerId?: string;      // 获胜 AI
}

/** 用户投注 */
export interface UserBet {
  odUserId: string;       // 用户 ID
  optionId: string;       // AI ID
  amount: number;
  placedAt: number;
  payout?: number;        // 结算后填入
}

/** 模拟投注 */
export interface SimulatedBet {
  viewerName: string;
  optionId: string;
  optionAvatar: string;
  amount: number;
  timestamp: number;
}

/** 模拟观众配置 */
export interface SimulatedBetConfig {
  minBettors: number;     // 最少模拟人数
  maxBettors: number;     // 最多模拟人数
  minBetAmount: number;   // 最小投注
  maxBetAmount: number;   // 最大投注
  favoredBias: number;    // 热门偏向 (0-1)
}

/** 结算结果 */
export interface SettlementResult {
  odUserId: string;
  odUserName?: string;
  optionId: string;
  betAmount: number;
  payout: number;
  profit: number;
  isWinner: boolean;
}

/** 赔率信息 */
export interface OddsInfo {
  aiId: string;
  aiName: string;
  avatar: string;
  odds: number;           // 赔率 (e.g., 3.17)
  percentage: number;     // 投注占比 (e.g., 31.5)
  totalBets: number;
  betCount: number;
}

/** 市场快照（用于前端展示） */
export interface MarketSnapshot {
  gameId: string;
  status: MarketStatus;
  totalPool: number;
  totalBettors: number;
  options: OddsInfo[];
  recentBets: SimulatedBet[];
}
