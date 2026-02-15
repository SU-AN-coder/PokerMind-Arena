/**
 * PokerMind Arena - 验证相关 API 路由
 */

import type { FastifyInstance } from 'fastify';
import { verificationService } from '../services/verification-service.js';
import { chainService } from '../services/chain-service.js';
import { ipfsService } from '../services/ipfs-service.js';

/**
 * 注册验证相关路由
 */
export async function verifyRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * 获取游戏的链上记录
   * GET /api/verify/:gameId
   */
  app.get<{
    Params: { gameId: string }
  }>('/api/verify/:gameId', async (request, reply) => {
    const { gameId } = request.params;
    
    const record = await chainService.getGameRecord(gameId);
    
    if (!record) {
      return reply.code(404).send({ 
        error: 'Game not found on chain',
        gameId 
      });
    }
    
    return {
      gameId,
      decisionHash: record.decisionHash,
      ipfsCid: record.ipfsCid,
      timestamp: record.timestamp,
      ipfsUrl: ipfsService.getGatewayUrl(record.ipfsCid),
      explorerUrl: `https://explorer.monad.xyz/address/${process.env.GAME_VERIFIER_ADDRESS || '0x...'}`
    };
  });
  
  /**
   * 执行验证
   * POST /api/verify/:gameId
   */
  app.post<{
    Params: { gameId: string };
    Body: { rawJson: string }
  }>('/api/verify/:gameId', async (request, reply) => {
    const { gameId } = request.params;
    const { rawJson } = request.body;
    
    if (!rawJson) {
      return reply.code(400).send({ error: 'rawJson is required' });
    }
    
    const result = await chainService.verifyGame(gameId, rawJson);
    
    return {
      gameId,
      verified: result.matched,
      storedHash: result.storedHash,
      computedHash: result.computedHash,
      message: result.matched 
        ? '✅ 数据完整性验证通过！链上哈希与原始数据匹配。'
        : '❌ 验证失败：数据可能已被篡改。'
    };
  });
  
  /**
   * 从 IPFS 获取游戏数据
   * GET /api/ipfs/:cid
   */
  app.get<{
    Params: { cid: string }
  }>('/api/ipfs/:cid', async (request, reply) => {
    const { cid } = request.params;
    
    try {
      const gameLog = await ipfsService.fetchGameLog(cid);
      return gameLog;
    } catch (error) {
      return reply.code(404).send({ 
        error: 'Failed to fetch from IPFS',
        cid 
      });
    }
  });
  
  /**
   * 完整验证流程（演示用）
   * POST /api/verify/full/:gameId
   */
  app.post<{
    Params: { gameId: string };
    Body: { ipfsCid: string }
  }>('/api/verify/full/:gameId', async (request, reply) => {
    const { gameId } = request.params;
    const { ipfsCid } = request.body;
    
    if (!ipfsCid) {
      return reply.code(400).send({ error: 'ipfsCid is required' });
    }
    
    try {
      const result = await verificationService.performVerification(gameId, ipfsCid);
      
      return {
        gameId,
        ipfsCid,
        rawDataPreview: result.rawData.slice(0, 200) + '...',
        computedHash: result.computedHash,
        storedHash: result.storedHash,
        verified: result.matched,
        message: result.matched
          ? '✅ 验证通过！数据完整性已确认。'
          : '❌ 验证失败！'
      };
    } catch (error) {
      return reply.code(500).send({ 
        error: 'Verification failed',
        details: (error as Error).message 
      });
    }
  });
}
