/**
 * PokerMind Arena - 预测市场服务
 * 
 * 整合市场管理和模拟观众，提供高层 API
 */

import type { Server } from 'socket.io';
import { marketManager, MarketManager } from './market-manager.js';
import { simulatedAudienceGenerator, SimulatedAudienceGenerator } from './simulated-audience.js';
import type { 
  PredictionMarket, 
  MarketSnapshot, 
  SettlementResult
} from './types.js';

/**
 * 预测市场服务
 */
export class MarketService {
  private manager: MarketManager;
  private audienceGenerator: SimulatedAudienceGenerator;
  private io: Server | null = null;
  private liveSimulationTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.manager = marketManager;
    this.audienceGenerator = simulatedAudienceGenerator;
  }
  
  /**
   * 设置 Socket.io 实例
   */
  setSocketIO(io: Server): void {
    this.io = io;
  }
  
  /**
   * 创建市场并生成初始模拟投注
   */
  createMarketWithSimulation(
    gameId: string,
    players: { id: string; name: string; avatar: string }[]
  ): PredictionMarket {
    // 创建市场
    const market = this.manager.createMarket(gameId, players);
    
    // 生成初始模拟投注
    const initialBets = this.audienceGenerator.generateInitialBets(market);
    
    for (const bet of initialBets) {
      this.manager.addSimulatedBet(gameId, bet);
    }
    
    console.log(`📊 Market created with ${initialBets.length} simulated bets`);
    
    // 开始实时模拟
    this.startLiveSimulation(gameId);
    
    return this.manager.getMarket(gameId)!;
  }
  
  /**
   * 开始实时模拟投注
   */
  private startLiveSimulation(gameId: string): void {
    // 每 2-5 秒生成一个模拟投注
    const scheduleNext = () => {
      const delay = 2000 + Math.random() * 3000;
      
      const timer = setTimeout(() => {
        const market = this.manager.getMarket(gameId);
        
        if (!market || market.status !== 'open') {
          this.stopLiveSimulation(gameId);
          return;
        }
        
        const bet = this.audienceGenerator.generateLiveBet(market);
        
        if (bet) {
          this.manager.addSimulatedBet(gameId, bet);
          
          // 广播到前端
          if (this.io) {
            this.io.to(`market:${gameId}`).emit('new_bet', {
              ...bet,
              comment: this.audienceGenerator.generateBetComment(
                bet, 
                market.options.find(o => o.aiId === bet.optionId)?.aiName || ''
              )
            });
            
            // 同时广播更新后的赔率
            const snapshot = this.getMarketSnapshot(gameId);
            if (snapshot) {
              this.io.to(`market:${gameId}`).emit('market_update', snapshot);
            }
          }
        }
        
        scheduleNext();
      }, delay);
      
      this.liveSimulationTimers.set(gameId, timer);
    };
    
    scheduleNext();
  }
  
  /**
   * 停止实时模拟
   */
  private stopLiveSimulation(gameId: string): void {
    const timer = this.liveSimulationTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.liveSimulationTimers.delete(gameId);
    }
  }
  
  /**
   * 用户投注
   */
  placeBet(
    gameId: string,
    userId: string,
    optionId: string,
    amount: number
  ): { success: boolean; message: string } {
    const result = this.manager.placeBet(gameId, userId, optionId, amount);
    
    if (result.success && this.io) {
      const snapshot = this.getMarketSnapshot(gameId);
      if (snapshot) {
        this.io.to(`market:${gameId}`).emit('market_update', snapshot);
      }
    }
    
    return result;
  }
  
  /**
   * 锁定市场（游戏开始时）
   */
  lockMarket(gameId: string): boolean {
    this.stopLiveSimulation(gameId);
    
    const success = this.manager.lockMarket(gameId);
    
    if (success && this.io) {
      this.io.to(`market:${gameId}`).emit('market_locked', {
        gameId,
        snapshot: this.getMarketSnapshot(gameId)
      });
    }
    
    return success;
  }
  
  /**
   * 结算市场（游戏结束时）
   */
  resolveMarket(gameId: string, winnerId: string): SettlementResult[] {
    const results = this.manager.resolveMarket(gameId, winnerId);
    
    if (this.io) {
      const market = this.manager.getMarket(gameId);
      const winnerOption = market?.options.find(o => o.aiId === winnerId);
      
      this.io.to(`market:${gameId}`).emit('market_resolved', {
        gameId,
        winnerId,
        winnerName: winnerOption?.aiName,
        winnerAvatar: winnerOption?.avatar,
        settlements: results.slice(0, 10),  // 只发送前10个结算
        snapshot: this.getMarketSnapshot(gameId)
      });
    }
    
    return results;
  }
  
  /**
   * 获取市场快照
   */
  getMarketSnapshot(gameId: string): MarketSnapshot | null {
    return this.manager.getMarketSnapshot(gameId);
  }
  
  /**
   * 获取用户投注
   */
  getUserBets(gameId: string, userId: string) {
    return this.manager.getUserBets(gameId, userId);
  }
}

/** 单例导出 */
export const marketService = new MarketService();
