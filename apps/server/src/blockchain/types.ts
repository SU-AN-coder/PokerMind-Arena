/**
 * PokerMind Arena - 链上验证类型定义
 */

/** 游戏日志（用于链上验证） */
export interface GameLog {
  gameId: string;
  startTime: number;
  endTime: number;
  players: {
    id: string;
    name: string;
    avatar: string;
  }[];
  decisions: DecisionRecord[];
  communityCards: string[];
  winner: {
    id: string;
    name: string;
  };
  pot: number;
}

/** 单条决策记录 */
export interface DecisionRecord {
  timestamp: number;
  playerId: string;
  playerName: string;
  action: 'allin' | 'fold';
  speech: string;
  emotion: string;
  target: string | null;
  holeCards: string;
  communityCards: string;
  potSize: number;
}

/** 链上游戏记录 */
export interface OnChainGameRecord {
  gameId: string;
  decisionHash: string;
  ipfsCid: string;
  timestamp: number;
  submitter: string;
}

/** 验证结果 */
export interface VerificationResult {
  matched: boolean;
  storedHash: string;
  computedHash: string;
}

/** 提交游戏结果 */
export interface CommitGameResult {
  txHash: string;
  ipfsCid: string;
  decisionHash: string;
  explorerUrl: string;
}

/** 验证面板数据 */
export interface VerificationPanelData {
  gameId: string;
  ipfsCid: string;
  onChainHash: string;
  txHash: string;
  explorerUrl: string;
}

/** 区块链配置 */
export interface BlockchainConfig {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
  web3StorageToken: string;
}
