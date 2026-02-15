/**
 * PokerMind Arena - 统一验证服务
 * 
 * 整合 Hash、IPFS、Chain 服务，提供完整的验证流程
 */

import { chainService } from './chain-service.js';
import { hashService } from './hash-service.js';
import { ipfsService } from './ipfs-service.js';
import type { 
  GameLog, 
  CommitGameResult, 
  VerificationResult,
  VerificationPanelData 
} from '../types.js';

/**
 * 验证服务
 */
export class VerificationService {
  /**
   * 完整的游戏提交流程
   * 
   * 1. 计算决策哈希
   * 2. 上传到 IPFS
   * 3. 写入智能合约
   * 4. 返回验证面板数据
   */
  async commitGame(gameLog: GameLog): Promise<{
    result: CommitGameResult;
    panelData: VerificationPanelData;
  }> {
    const result = await chainService.commitGame(gameLog);
    
    const panelData: VerificationPanelData = {
      gameId: gameLog.gameId,
      ipfsCid: result.ipfsCid,
      onChainHash: result.decisionHash,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl
    };
    
    return { result, panelData };
  }
  
  /**
   * 执行完整验证流程（用于演示）
   * 
   * 1. 从 IPFS 下载原始数据
   * 2. 本地计算哈希
   * 3. 与链上哈希比对
   */
  async performVerification(
    gameId: string, 
    ipfsCid: string,
    onProgress?: (step: 'fetching' | 'computing' | 'comparing' | 'done', data?: unknown) => void
  ): Promise<{
    rawData: string;
    computedHash: string;
    storedHash: string;
    matched: boolean;
  }> {
    // Step 1: 从 IPFS 获取
    onProgress?.('fetching');
    const gameLog = await ipfsService.fetchGameLog(ipfsCid);
    const rawData = JSON.stringify(gameLog, null, 2);
    
    // Step 2: 计算哈希
    onProgress?.('computing');
    const computedHash = hashService.computeHashFromRaw(JSON.stringify(gameLog));
    
    // Step 3: 获取链上哈希并比对
    onProgress?.('comparing');
    const record = await chainService.getGameRecord(gameId);
    const storedHash = record?.decisionHash || '0x0';
    const matched = hashService.verifyHash(storedHash, computedHash);
    
    onProgress?.('done', { matched });
    
    return {
      rawData,
      computedHash,
      storedHash,
      matched
    };
  }
  
  /**
   * 快速验证（不需要从 IPFS 下载）
   */
  async quickVerify(gameId: string, gameLog: GameLog): Promise<VerificationResult> {
    const rawJson = JSON.stringify(gameLog);
    return chainService.verifyGame(gameId, rawJson);
  }
  
  /**
   * 获取 IPFS 网关 URL
   */
  getIPFSUrl(cid: string): string {
    return ipfsService.getGatewayUrl(cid);
  }
}

/** 单例导出 */
export const verificationService = new VerificationService();
