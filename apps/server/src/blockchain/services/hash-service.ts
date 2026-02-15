/**
 * PokerMind Arena - Hash 计算服务
 * 
 * 用于计算游戏日志的 keccak256 哈希
 */

import { keccak256, toUtf8Bytes, id } from 'ethers';
import type { GameLog } from '../types.js';

/**
 * Hash 计算服务
 */
export class HashService {
  /**
   * 计算游戏决策的哈希值
   * 
   * @param gameLog 完整游戏日志
   * @returns bytes32 格式的哈希值
   */
  computeDecisionHash(gameLog: GameLog): string {
    // 使用稳定的 JSON 序列化（按 key 排序）
    const stableJson = this.stableStringify(gameLog);
    return keccak256(toUtf8Bytes(stableJson));
  }
  
  /**
   * 从原始 JSON 字符串计算哈希
   * 
   * @param rawJson 原始 JSON 字符串
   * @returns bytes32 格式的哈希值
   */
  computeHashFromRaw(rawJson: string): string {
    return keccak256(toUtf8Bytes(rawJson));
  }
  
  /**
   * 将 gameId 转换为 bytes32
   * 
   * @param gameId 游戏ID字符串
   * @returns bytes32 格式
   */
  gameIdToBytes32(gameId: string): string {
    return id(gameId); // keccak256 of string
  }
  
  /**
   * 稳定的 JSON 序列化（按 key 排序）
   * 确保相同数据始终产生相同的字符串
   */
  private stableStringify(obj: unknown): string {
    return JSON.stringify(obj, this.sortKeys);
  }
  
  /**
   * JSON.stringify 的 replacer 函数，用于按 key 排序
   */
  private sortKeys(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = (value as Record<string, unknown>)[key];
          return sorted;
        }, {} as Record<string, unknown>);
    }
    return value;
  }
  
  /**
   * 验证两个哈希是否匹配
   */
  verifyHash(storedHash: string, computedHash: string): boolean {
    return storedHash.toLowerCase() === computedHash.toLowerCase();
  }
}

/** 单例导出 */
export const hashService = new HashService();
