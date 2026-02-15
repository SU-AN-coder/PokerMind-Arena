/**
 * PokerMind Arena - 游戏日志收集器
 * 
 * 收集游戏数据用于链上验证
 */

import type { GameLog, AIDecision, AIAction, EmotionType } from '../types.js';

interface AgentInfo {
  id: string;
  personality: {
    name: string;
    avatar: string;
  };
}

/**
 * 游戏日志收集器
 */
export class GameLogger {
  private currentGame: GameLog | null = null;
  
  /**
   * 开始新游戏
   */
  startGame(gameId: string, players: AgentInfo[]): void {
    this.currentGame = {
      gameId,
      startTime: Date.now(),
      endTime: 0,
      players: players.map(p => ({
        id: p.id,
        name: p.personality.name,
        avatar: p.personality.avatar
      })),
      decisions: [],
      communityCards: [],
      winner: { id: '', name: '' },
      pot: 0
    };
  }
  
  /**
   * 记录决策
   */
  logDecision(
    agent: AgentInfo,
    context: {
      holeCards: string;
      communityCards: string;
      potSize: number;
    },
    decision: AIDecision
  ): void {
    if (!this.currentGame) return;
    
    this.currentGame.decisions.push({
      timestamp: Date.now(),
      playerId: agent.id,
      playerName: agent.personality.name,
      action: decision.action,
      speech: decision.speech,
      emotion: decision.emotion,
      target: decision.target,
      holeCards: context.holeCards,
      communityCards: context.communityCards,
      potSize: context.potSize
    });
  }
  
  /**
   * 设置公共牌
   */
  setCommunityCards(cards: string[]): void {
    if (this.currentGame) {
      this.currentGame.communityCards = cards;
    }
  }
  
  /**
   * 结束游戏
   */
  endGame(winner: { id: string; name: string }, pot: number): GameLog | null {
    if (!this.currentGame) return null;
    
    this.currentGame.endTime = Date.now();
    this.currentGame.winner = winner;
    this.currentGame.pot = pot;
    
    const log = this.currentGame;
    this.currentGame = null;
    
    return log;
  }
  
  /**
   * 获取当前日志（用于调试）
   */
  getCurrentLog(): GameLog | null {
    return this.currentGame;
  }
}

/** 单例 */
export const gameLogger = new GameLogger();
