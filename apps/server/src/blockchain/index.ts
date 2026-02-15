/**
 * PokerMind Arena - 区块链验证模块入口
 */

// 类型导出
export type {
  GameLog,
  DecisionRecord,
  OnChainGameRecord,
  VerificationResult,
  CommitGameResult,
  VerificationPanelData,
  BlockchainConfig
} from './types.js';

// 服务导出
export { HashService, hashService } from './services/hash-service.js';
export { IPFSService, ipfsService } from './services/ipfs-service.js';
export { ChainService, chainService, addMockGameRecord } from './services/chain-service.js';
export { VerificationService, verificationService } from './services/verification-service.js';

// ABI 导出
export { GAME_VERIFIER_ABI, CONTRACT_ADDRESSES } from './abi/GameVerifier.js';

// 路由导出
export { verifyRoutes } from './routes/verify-routes.js';

// Socket 处理导出
export { registerVerifySocketHandlers } from './socket/verify-socket-handlers.js';
