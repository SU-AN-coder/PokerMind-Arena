/**
 * PokerMind Arena - IPFS 服务
 * 
 * 支持多个 IPFS 提供商：Pinata、Web3.Storage、Mock
 */

import https from 'node:https';
import type { GameLog } from '../types.js';

interface IPFSProvider {
  name: string;
  upload(data: GameLog): Promise<string>;
}

/**
 * Pinata Provider（推荐）
 * 使用 https 模块避免 fetch 的 Unicode 编码问题
 */
class PinataProvider implements IPFSProvider {
  name = 'Pinata';
  private jwt: string;
  
  constructor(jwt: string) {
    this.jwt = jwt;
  }
  
  async upload(data: GameLog): Promise<string> {
    const payload = JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: `pokermind-${data.gameId}.json`
      }
    });
    
    const bodyBuffer = Buffer.from(payload, 'utf-8');
    
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.pinata.cloud',
        path: '/pinning/pinJSONToIPFS',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyBuffer.length,
          'Authorization': `Bearer ${this.jwt}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(data) as { IpfsHash: string };
            resolve(result.IpfsHash);
          } else {
            reject(new Error(`Pinata upload failed: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });
  }
}

/**
 * Web3.Storage Provider
 */
class Web3StorageProvider implements IPFSProvider {
  name = 'Web3.Storage';
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  async upload(data: GameLog): Promise<string> {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const file = new File([blob], `${data.gameId}.json`, { type: 'application/json' });
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('https://api.web3.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Web3.Storage upload failed: ${response.status} - ${error}`);
    }
    
    const result = await response.json() as { cid: string };
    return result.cid;
  }
}

/**
 * Mock Provider（开发/测试用）
 */
class MockIPFSProvider implements IPFSProvider {
  name = 'Mock';
  
  async upload(data: GameLog): Promise<string> {
    // 生成一个基于内容的假 CID
    const content = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const mockCid = `bafybei${Math.abs(hash).toString(36).padStart(46, 'a').slice(0, 46)}`;
    return mockCid;
  }
}

/**
 * IPFS 服务（自动选择最佳 Provider）
 */
export class IPFSService {
  private provider: IPFSProvider;
  private fallbackProvider: MockIPFSProvider;
  
  constructor() {
    this.fallbackProvider = new MockIPFSProvider();
    this.provider = this.selectProvider();
    
    console.log(`   📦 IPFS Provider: ${this.provider.name}`);
  }
  
  private selectProvider(): IPFSProvider {
    // 优先使用 Pinata
    const pinataJwt = process.env.PINATA_JWT?.trim();
    if (pinataJwt && pinataJwt.length > 10) {
      return new PinataProvider(pinataJwt);
    }
    
    // 其次使用 Web3.Storage
    const w3sToken = process.env.WEB3_STORAGE_TOKEN?.trim();
    if (w3sToken && w3sToken.length > 10) {
      return new Web3StorageProvider(w3sToken);
    }
    
    // 最后使用 Mock
    console.warn('   ⚠️ No IPFS provider configured, using Mock');
    return this.fallbackProvider;
  }
  
  /**
   * 检查服务是否可用（非 Mock）
   */
  isAvailable(): boolean {
    return this.provider.name !== 'Mock';
  }
  
  /**
   * 上传游戏日志
   */
  async uploadGameLog(gameLog: GameLog): Promise<string> {
    try {
      const cid = await this.provider.upload(gameLog);
      console.log(`✅ Uploaded to ${this.provider.name}: ${cid}`);
      return cid;
    } catch (error) {
      console.error(`❌ ${this.provider.name} upload failed:`, error);
      
      // 降级到 Mock
      if (this.provider.name !== 'Mock') {
        console.log('⚠️ Falling back to Mock IPFS');
        return this.fallbackProvider.upload(gameLog);
      }
      
      throw error;
    }
  }
  
  /**
   * 获取 IPFS 网关 URL
   */
  getGatewayUrl(cid: string): string {
    // 根据 provider 选择最佳网关
    if (this.provider.name === 'Pinata') {
      return `https://gateway.pinata.cloud/ipfs/${cid}`;
    }
    return `https://ipfs.io/ipfs/${cid}`;
  }
  
  /**
   * 获取所有可用网关 URL
   */
  getAllGatewayUrls(cid: string): string[] {
    return [
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://w3s.link/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`
    ];
  }
  
  /**
   * 从 IPFS 获取数据
   */
  async fetchGameLog(cid: string): Promise<GameLog> {
    const urls = this.getAllGatewayUrls(cid);
    
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return response.json() as Promise<GameLog>;
        }
      } catch {
        continue; // 尝试下一个网关
      }
    }
    
    throw new Error(`Failed to fetch from all IPFS gateways: ${cid}`);
  }
  
  /**
   * 获取当前使用的 Provider 名称
   */
  getProviderName(): string {
    return this.provider.name;
  }
  
  /**
   * 是否使用 Mock 模式
   */
  isMockMode(): boolean {
    return this.provider.name === 'Mock';
  }
}

/** 单例导出 */
export const ipfsService = new IPFSService();
