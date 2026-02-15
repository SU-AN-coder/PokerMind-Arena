/**
 * PokerMind Arena - 链交互服务
 * 
 * 与 Monad 测试网上的 GameVerifier 合约交互
 */

import { Contract, Wallet, JsonRpcProvider } from 'ethers';
import { GAME_VERIFIER_ABI, CONTRACT_ADDRESSES } from '../abi/GameVerifier.js';
import { hashService } from './hash-service.js';
import { ipfsService } from './ipfs-service.js';
import type { 
  GameLog, 
  OnChainGameRecord, 
  CommitGameResult,
  BlockchainConfig 
} from '../types.js';

/**
 * 链交互服务
 */
export class ChainService {
  private provider: JsonRpcProvider | null = null;
  private wallet: Wallet | null = null;
  private contract: Contract | null = null;
  private config: BlockchainConfig | null = null;
  
  /**
   * 初始化服务
   */
  initialize(config: Partial<BlockchainConfig>): boolean {
    const rpcUrl = config.rpcUrl || process.env.MONAD_RPC_URL;
    const contractAddress = config.contractAddress || CONTRACT_ADDRESSES.monad_testnet;
    const privateKey = config.privateKey || process.env.PRIVATE_KEY;
    
    if (!rpcUrl || !privateKey || contractAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️ Chain service not fully configured, running in mock mode');
      return false;
    }
    
    try {
      this.config = {
        rpcUrl,
        contractAddress,
        privateKey,
        web3StorageToken: config.web3StorageToken || process.env.WEB3_STORAGE_TOKEN || ''
      };
      
      this.provider = new JsonRpcProvider(rpcUrl);
      this.wallet = new Wallet(privateKey, this.provider);
      this.contract = new Contract(contractAddress, GAME_VERIFIER_ABI, this.wallet);
      
      console.log('✅ Chain service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize chain service:', error);
      return false;
    }
  }
  
  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.contract !== null;
  }
  
  /**
   * 提交游戏记录到链上
   * 
   * 完整流程：计算哈希 → 上传IPFS → 写入合约
   */
  async commitGame(gameLog: GameLog): Promise<CommitGameResult> {
    // 1. 计算决策哈希
    const decisionHash = hashService.computeDecisionHash(gameLog);
    const gameIdBytes32 = hashService.gameIdToBytes32(gameLog.gameId);
    
    // 2. 上传到 IPFS
    const ipfsCid = await ipfsService.uploadGameLog(gameLog);
    
    // 3. 写入合约（如果可用）
    if (this.isAvailable() && this.contract) {
      try {
        const tx = await this.contract.commitGame(gameIdBytes32, decisionHash, ipfsCid);
        const receipt = await tx.wait();
        
        return {
          txHash: receipt.hash,
          ipfsCid,
          decisionHash,
          explorerUrl: `https://explorer.monad.xyz/tx/${receipt.hash}`
        };
      } catch (error) {
        console.error('Contract interaction failed:', error);
        // 降级到 mock 模式
      }
    }
    
    // Mock 模式
    const mockTxHash = `0x${Buffer.from(gameLog.gameId).toString('hex').padEnd(64, '0')}`;
    return {
      txHash: mockTxHash,
      ipfsCid,
      decisionHash,
      explorerUrl: `https://explorer.monad.xyz/tx/${mockTxHash}`
    };
  }
  
  /**
   * 从链上获取游戏记录
   */
  async getGameRecord(gameId: string): Promise<OnChainGameRecord | null> {
    if (!this.isAvailable() || !this.contract) {
      return this.getMockGameRecord(gameId);
    }
    
    try {
      const gameIdBytes32 = hashService.gameIdToBytes32(gameId);
      const [decisionHash, ipfsCid, timestamp, submitter] = await this.contract.getGame(gameIdBytes32);
      
      if (timestamp === 0n) {
        return null; // 游戏不存在
      }
      
      return {
        gameId,
        decisionHash,
        ipfsCid,
        timestamp: Number(timestamp),
        submitter
      };
    } catch (error) {
      console.error('Failed to get game record:', error);
      return null;
    }
  }
  
  /**
   * 验证游戏数据
   * 
   * @param gameId 游戏ID
   * @param rawJson 原始JSON字符串
   */
  async verifyGame(gameId: string, rawJson: string): Promise<{
    matched: boolean;
    storedHash: string;
    computedHash: string;
  }> {
    const computedHash = hashService.computeHashFromRaw(rawJson);
    
    if (this.isAvailable() && this.contract) {
      try {
        const gameIdBytes32 = hashService.gameIdToBytes32(gameId);
        const [matched, storedHash] = await this.contract.verifyHashView(gameIdBytes32, rawJson);
        
        return {
          matched,
          storedHash,
          computedHash
        };
      } catch (error) {
        console.error('On-chain verification failed:', error);
      }
    }
    
    // 本地验证（mock 模式）
    const record = await this.getGameRecord(gameId);
    if (!record) {
      return {
        matched: false,
        storedHash: '0x0',
        computedHash
      };
    }
    
    return {
      matched: hashService.verifyHash(record.decisionHash, computedHash),
      storedHash: record.decisionHash,
      computedHash
    };
  }
  
  /**
   * 获取 IPFS 数据并验证
   */
  async fetchAndVerify(gameId: string, ipfsCid: string): Promise<{
    gameLog: GameLog;
    verification: {
      matched: boolean;
      storedHash: string;
      computedHash: string;
    };
  }> {
    // 从 IPFS 获取数据
    const gameLog = await ipfsService.fetchGameLog(ipfsCid);
    const rawJson = JSON.stringify(gameLog);
    
    // 验证
    const verification = await this.verifyGame(gameId, rawJson);
    
    return { gameLog, verification };
  }
  
  /**
   * Mock 游戏记录（用于测试）
   */
  private getMockGameRecord(gameId: string): OnChainGameRecord | null {
    // 从内存缓存获取（如果有）
    const cached = mockGameRecords.get(gameId);
    if (cached) return cached;
    
    return null;
  }
}

/** 内存中的 Mock 游戏记录缓存 */
const mockGameRecords = new Map<string, OnChainGameRecord>();

/**
 * 添加 Mock 记录（用于测试）
 */
export function addMockGameRecord(record: OnChainGameRecord): void {
  mockGameRecords.set(record.gameId, record);
}

/** 单例导出 */
export const chainService = new ChainService();
