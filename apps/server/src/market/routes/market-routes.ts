/**
 * PokerMind Arena - 预测市场 HTTP 路由
 */

import type { FastifyInstance } from 'fastify';
import { marketService } from '../market-service.js';

/**
 * 注册预测市场路由
 */
export async function marketRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * 获取市场快照
   * GET /api/market/:gameId
   */
  app.get<{
    Params: { gameId: string }
  }>('/api/market/:gameId', async (request, reply) => {
    const { gameId } = request.params;
    
    const snapshot = marketService.getMarketSnapshot(gameId);
    
    if (!snapshot) {
      return reply.code(404).send({ error: 'Market not found' });
    }
    
    return snapshot;
  });
  
  /**
   * 获取赔率
   * GET /api/market/:gameId/odds
   */
  app.get<{
    Params: { gameId: string }
  }>('/api/market/:gameId/odds', async (request, reply) => {
    const { gameId } = request.params;
    
    const snapshot = marketService.getMarketSnapshot(gameId);
    
    if (!snapshot) {
      return reply.code(404).send({ error: 'Market not found' });
    }
    
    return {
      gameId,
      status: snapshot.status,
      totalPool: snapshot.totalPool,
      odds: snapshot.options
    };
  });
  
  /**
   * 用户投注
   * POST /api/market/:gameId/bet
   */
  app.post<{
    Params: { gameId: string };
    Body: { odUserId: string; optionId: string; amount: number }
  }>('/api/market/:gameId/bet', async (request, reply) => {
    const { gameId } = request.params;
    const { odUserId, optionId, amount } = request.body;
    
    if (!odUserId || !optionId || !amount) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }
    
    const result = marketService.placeBet(gameId, odUserId, optionId, amount);
    
    if (!result.success) {
      return reply.code(400).send({ error: result.message });
    }
    
    return {
      success: true,
      message: result.message,
      snapshot: marketService.getMarketSnapshot(gameId)
    };
  });
  
  /**
   * 获取用户投注记录
   * GET /api/market/:gameId/bets/:odUserId
   */
  app.get<{
    Params: { gameId: string; odUserId: string }
  }>('/api/market/:gameId/bets/:odUserId', async (request, reply) => {
    const { gameId, odUserId } = request.params;
    
    const bets = marketService.getUserBets(gameId, odUserId);
    
    return { bets };
  });
}
