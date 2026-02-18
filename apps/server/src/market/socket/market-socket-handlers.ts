/**
 * PokerMind Arena - 预测市场 Socket 处理器
 */

import type { Server, Socket } from 'socket.io';
import { marketService } from '../market-service.js';

/**
 * 注册预测市场 Socket 事件
 */
export function registerMarketSocketHandlers(io: Server): void {
  // 设置 io 实例给 marketService
  marketService.setSocketIO(io);
  
  io.on('connection', (socket: Socket) => {
    
    // 加入市场房间
    socket.on('join_market', (gameId: string) => {
      socket.join(`market:${gameId}`);
      console.log(`📊 ${socket.id} joined market:${gameId}`);
      
      // 发送当前市场快照
      const snapshot = marketService.getMarketSnapshot(gameId);
      if (snapshot) {
        socket.emit('market_snapshot', snapshot);
      }
    });
    
    // 离开市场房间
    socket.on('leave_market', (gameId: string) => {
      socket.leave(`market:${gameId}`);
      console.log(`📊 ${socket.id} left market:${gameId}`);
    });
    
    // 用户投注
    socket.on('place_bet', (data: {
      gameId: string;
      odUserId: string;
      optionId: string;
      amount: number;
    }) => {
      const result = marketService.placeBet(
        data.gameId,
        data.odUserId,
        data.optionId,
        data.amount
      );
      
      socket.emit('bet_result', {
        success: result.success,
        message: result.message
      });
    });
    
    // 请求市场快照
    socket.on('get_market_snapshot', (gameId: string) => {
      const snapshot = marketService.getMarketSnapshot(gameId);
      socket.emit('market_snapshot', snapshot);
    });
    
  });
}

/**
 * 广播市场创建事件
 */
export function broadcastMarketCreated(
  io: Server,
  gameId: string,
  players: { id: string; name: string; avatar: string }[]
): void {
  marketService.createMarketWithSimulation(gameId, players);
  const snapshot = marketService.getMarketSnapshot(gameId);
  
  io.emit('market_created', {
    gameId,
    snapshot
  });
}

/**
 * 广播市场锁定事件
 */
export function broadcastMarketLocked(io: Server, gameId: string): void {
  marketService.lockMarket(gameId);
}

/**
 * 广播市场结算事件
 */
export function broadcastMarketResolved(
  io: Server, 
  gameId: string, 
  winnerId: string
): void {
  marketService.resolveMarket(gameId, winnerId);
}
