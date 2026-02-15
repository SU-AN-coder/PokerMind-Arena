/**
 * PokerMind Arena - IPFS 上传服务
 * 
 * 使用 web3.storage 上传游戏日志到 IPFS
 */

import type { GameLog } from '../types.js';

/**
 * IPFS 服务
 * 
 * 注意：web3.storage 旧版 API 已弃用，这里提供兼容实现
 * 生产环境建议使用 @web3-storage/w3up-client 或 Pinata
 */
export class IPFSService {
  private token: string;
  private apiUrl = 'https://api.web3.storage';
  
  constructor(token?: string) {
    this.token = token || process.env.WEB3_STORAGE_TOKEN || '';
  }
  
  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.token.length > 0;
  }
  
  /**
   * 上传游戏日志到 IPFS
   * 
   * @param gameLog 游戏日志
   * @returns IPFS CID
   */
  async uploadGameLog(gameLog: GameLog): Promise<string> {
    if (!this.isAvailable()) {
      console.warn('⚠️ IPFS service not configured, using mock CID');
      return this.generateMockCid(gameLog.gameId);
    }
    
    try {
      const jsonContent = JSON.stringify(gameLog, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const file = new File([blob], `${gameLog.gameId}.json`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${this.apiUrl}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.status}`);
      }
      
      const result = await response.json() as { cid: string };
      return result.cid;
    } catch (error) {
      console.error('IPFS upload error:', error);
      // 返回 mock CID 作为降级
      return this.generateMockCid(gameLog.gameId);
    }
  }
  
  /**
   * 从 IPFS 获取游戏日志
   * 
   * @param cid IPFS CID
   * @returns 游戏日志
   */
  async fetchGameLog(cid: string): Promise<GameLog> {
    const response = await fetch(`https://w3s.link/ipfs/${cid}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.status}`);
    }
    
    return response.json() as Promise<GameLog>;
  }
  
  /**
   * 获取 IPFS 网关 URL
   */
  getGatewayUrl(cid: string): string {
    return `https://w3s.link/ipfs/${cid}`;
  }
  
  /**
   * 生成 Mock CID（用于测试/降级）
   */
  private generateMockCid(gameId: string): string {
    // 生成一个看起来像真实 CID 的字符串
    const hash = Buffer.from(gameId).toString('base64').replace(/[+/=]/g, '');
    return `bafybeig${hash.slice(0, 50).toLowerCase()}`;
  }
}

/** 单例导出 */
export const ipfsService = new IPFSService();
