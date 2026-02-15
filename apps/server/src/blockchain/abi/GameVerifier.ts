/**
 * PokerMind Arena - GameVerifier 合约 ABI
 */

export const GAME_VERIFIER_ABI = [
  // 提交游戏
  "function commitGame(bytes32 gameId, bytes32 decisionHash, string ipfsCid) external",
  
  // 验证哈希（view函数，不消耗gas）
  "function verifyHashView(bytes32 gameId, string rawDecisionsJson) view returns (bool matched, bytes32 storedHash, bytes32 computedHash)",
  
  // 查询游戏
  "function getGame(bytes32 gameId) view returns (bytes32 decisionHash, string ipfsCid, uint256 timestamp, address submitter)",
  
  // 获取游戏数量
  "function getGameCount() view returns (uint256)",
  
  // 事件
  "event GameCommitted(bytes32 indexed gameId, bytes32 decisionHash, string ipfsCid, uint256 timestamp)",
  "event VerificationPerformed(bytes32 indexed gameId, bytes32 providedHash, bool matched)"
] as const;

/**
 * 合约地址（部署后填入）
 */
export const CONTRACT_ADDRESSES = {
  monad_testnet: process.env.GAME_VERIFIER_ADDRESS || '0x0000000000000000000000000000000000000000'
} as const;
