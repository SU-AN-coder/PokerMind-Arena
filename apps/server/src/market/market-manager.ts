/**
 * PokerMind Arena - 预测市场管理器
 * 
 * 核心功能：
 * - 创建/锁定/结算市场
 * - 彩池制赔率计算
 * - 投注管理
 */

import type {
  PredictionMarket,
  MarketOption,
  UserBet,
  SettlementResult,
  OddsInfo,
  MarketSnapshot,
  SimulatedBet
} from './types.js';

/** 平台抽成比例 (5%) */
const PLATFORM_FEE_RATE = 0.05;

/**
 * 预测市场管理器
 */
export class MarketManager {
  /** 活跃市场 Map<gameId, Market> */
  private markets: Map<string, PredictionMarket> = new Map();
  
  /** 用户投注 Map<gameId, UserBet[]> */
  private userBets: Map<string, UserBet[]> = new Map();
  
  /** 模拟投注记录（用于前端展示）Map<gameId, SimulatedBet[]> */
  private simulatedBets: Map<string, SimulatedBet[]> = new Map();
  
  /**
   * 创建新的预测市场
   */
  createMarket(
    gameId: string,
    players: { id: string; name: string; avatar: string }[]
  ): PredictionMarket {
    const options: MarketOption[] = players.map(p => ({
      aiId: p.id,
      aiName: p.name,
      avatar: p.avatar,
      totalBets: 0,
      betCount: 0
    }));
    
    const market: PredictionMarket = {
      gameId,
      question: '谁会赢得这场比赛？',
      status: 'open',
      options,
      totalPool: 0,
      createdAt: Date.now()
    };
    
    this.markets.set(gameId, market);
    this.userBets.set(gameId, []);
    this.simulatedBets.set(gameId, []);
    
    console.log(`📊 Market created for game ${gameId}`);
    return market;
  }
  
  /**
   * 获取市场
   */
  getMarket(gameId: string): PredictionMarket | undefined {
    return this.markets.get(gameId);
  }
  
  /**
   * 用户投注
   */
  placeBet(
    gameId: string,
    odUserId: string,
    optionId: string,
    amount: number
  ): { success: boolean; message: string; market?: PredictionMarket } {
    const market = this.markets.get(gameId);
    
    if (!market) {
      return { success: false, message: '市场不存在' };
    }
    
    if (market.status !== 'open') {
      return { success: false, message: '市场已锁定，无法投注' };
    }
    
    if (amount <= 0) {
      return { success: false, message: '投注金额必须大于0' };
    }
    
    const option = market.options.find(o => o.aiId === optionId);
    if (!option) {
      return { success: false, message: '无效的投注选项' };
    }
    
    // 更新选项数据
    option.totalBets += amount;
    option.betCount += 1;
    market.totalPool += amount;
    
    // 记录用户投注
    const bets = this.userBets.get(gameId)!;
    bets.push({
      odUserId,
      optionId,
      amount,
      placedAt: Date.now()
    });
    
    console.log(`💰 User ${odUserId} bet $${amount} on ${option.aiName}`);
    
    return { success: true, message: '投注成功', market };
  }
  
  /**
   * 添加模拟投注（仅用于展示，不影响实际结算）
   */
  addSimulatedBet(gameId: string, bet: SimulatedBet): void {
    const market = this.markets.get(gameId);
    if (!market || market.status !== 'open') return;
    
    const option = market.options.find(o => o.aiId === bet.optionId);
    if (!option) return;
    
    // 更新市场数据
    option.totalBets += bet.amount;
    option.betCount += 1;
    market.totalPool += bet.amount;
    
    // 记录模拟投注
    const bets = this.simulatedBets.get(gameId) || [];
    bets.push(bet);
    // 只保留最近 50 条
    if (bets.length > 50) {
      bets.shift();
    }
    this.simulatedBets.set(gameId, bets);
  }
  
  /**
   * 锁定市场（游戏开始时调用）
   */
  lockMarket(gameId: string): boolean {
    const market = this.markets.get(gameId);
    if (!market || market.status !== 'open') {
      return false;
    }
    
    market.status = 'locked';
    market.lockedAt = Date.now();
    
    console.log(`🔒 Market locked for game ${gameId}, total pool: $${market.totalPool}`);
    return true;
  }
  
  /**
   * 结算市场
   */
  resolveMarket(gameId: string, winnerId: string): SettlementResult[] {
    const market = this.markets.get(gameId);
    if (!market) {
      console.error(`Market not found: ${gameId}`);
      return [];
    }
    
    if (market.status === 'resolved') {
      console.warn(`Market already resolved: ${gameId}`);
      return [];
    }
    
    market.status = 'resolved';
    market.resolvedAt = Date.now();
    market.winnerId = winnerId;
    
    // 计算结算结果
    const results = this.calculateSettlement(gameId, winnerId);
    
    console.log(`🏆 Market resolved for game ${gameId}, winner: ${winnerId}`);
    console.log(`   Total settlements: ${results.length}`);
    
    return results;
  }
  
  /**
   * 彩池制结算计算
   * 
   * 公式：
   * 赔率 = (总池 × (1 - 抽成)) / 获胜选项总投注
   * 用户收益 = 用户投注 × 赔率
   */
  private calculateSettlement(gameId: string, winnerId: string): SettlementResult[] {
    const market = this.markets.get(gameId)!;
    const bets = this.userBets.get(gameId) || [];
    
    if (bets.length === 0 || market.totalPool === 0) {
      return [];
    }
    
    const winnerOption = market.options.find(o => o.aiId === winnerId);
    if (!winnerOption || winnerOption.totalBets === 0) {
      // 没人押对，所有人输
      return bets.map(bet => ({
        odUserId: bet.odUserId,
        optionId: bet.optionId,
        betAmount: bet.amount,
        payout: 0,
        profit: -bet.amount,
        isWinner: false
      }));
    }
    
    // 计算赔率
    const netPool = market.totalPool * (1 - PLATFORM_FEE_RATE);
    const odds = netPool / winnerOption.totalBets;
    
    // 计算每个用户的结算
    const results: SettlementResult[] = bets.map(bet => {
      const isWinner = bet.optionId === winnerId;
      
      if (isWinner) {
        const payout = bet.amount * odds;
        return {
          odUserId: bet.odUserId,
          optionId: bet.optionId,
          betAmount: bet.amount,
          payout,
          profit: payout - bet.amount,
          isWinner: true
        };
      } else {
        return {
          odUserId: bet.odUserId,
          optionId: bet.optionId,
          betAmount: bet.amount,
          payout: 0,
          profit: -bet.amount,
          isWinner: false
        };
      }
    });
    
    return results;
  }
  
  /**
   * 计算当前赔率
   */
  calculateOdds(gameId: string): OddsInfo[] {
    const market = this.markets.get(gameId);
    if (!market) return [];
    
    const netPool = market.totalPool * (1 - PLATFORM_FEE_RATE);
    
    return market.options.map(option => {
      // 避免除以零
      const odds = option.totalBets > 0 
        ? netPool / option.totalBets 
        : market.options.length * 2; // 无投注时给一个默认高赔率
      
      const percentage = market.totalPool > 0
        ? (option.totalBets / market.totalPool) * 100
        : 100 / market.options.length;
      
      return {
        aiId: option.aiId,
        aiName: option.aiName,
        avatar: option.avatar,
        odds: Math.round(odds * 100) / 100,  // 保留2位小数
        percentage: Math.round(percentage * 10) / 10,  // 保留1位小数
        totalBets: option.totalBets,
        betCount: option.betCount
      };
    });
  }
  
  /**
   * 获取市场快照（用于前端展示）
   */
  getMarketSnapshot(gameId: string): MarketSnapshot | null {
    const market = this.markets.get(gameId);
    if (!market) return null;
    
    const options = this.calculateOdds(gameId);
    const totalBettors = market.options.reduce((sum, o) => sum + o.betCount, 0);
    const recentBets = this.simulatedBets.get(gameId)?.slice(-10) || [];
    
    return {
      gameId,
      status: market.status,
      totalPool: market.totalPool,
      totalBettors,
      options,
      recentBets
    };
  }
  
  /**
   * 获取用户在某场游戏的投注
   */
  getUserBets(gameId: string, odUserId: string): UserBet[] {
    const bets = this.userBets.get(gameId) || [];
    return bets.filter(b => b.odUserId === odUserId);
  }
  
  /**
   * 清理已结算的市场（可选，用于内存管理）
   */
  cleanupResolvedMarkets(olderThanMs: number = 3600000): void {
    const now = Date.now();
    
    for (const [gameId, market] of this.markets) {
      if (market.status === 'resolved' && 
          market.resolvedAt && 
          now - market.resolvedAt > olderThanMs) {
        this.markets.delete(gameId);
        this.userBets.delete(gameId);
        this.simulatedBets.delete(gameId);
        console.log(`🧹 Cleaned up market: ${gameId}`);
      }
    }
  }
}

/** 单例导出 */
export const marketManager = new MarketManager();
