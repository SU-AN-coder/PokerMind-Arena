/**
 * PokerMind Arena - 牌型评估器 (pokersolver 封装)
 */

// pokersolver 是 CommonJS 模块，使用 createRequire 导入
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pokersolver = require('pokersolver');
const Hand = pokersolver.Hand;

import type { CardString, Player } from './types.js';

/** 牌型评估结果 */
export interface HandEvaluation {
  /** 牌型名称，如 "Royal Flush", "Two Pair" */
  name: string;
  /** 牌型描述，如 "Flush, A High" */
  description: string;
  /** 牌型等级 (1-10) */
  rank: number;
  /** pokersolver Hand 对象 */
  hand: any;
}

/** 获胜者结果 */
export interface WinnerResult {
  player: Player;
  evaluation: HandEvaluation;
}

/**
 * 评估7张牌的最佳牌型
 * @param holeCards 玩家手牌 ["Ah", "Kd"]
 * @param communityCards 公共牌 ["Jh", "10h", "9h", "8c", "2d"]
 * @returns 牌型评估结果
 */
export function evaluateHand(
  holeCards: CardString[],
  communityCards: CardString[]
): HandEvaluation {
  const allCards = [...holeCards, ...communityCards];
  const hand = Hand.solve(allCards);
  
  return {
    name: hand.name,
    description: hand.descr,
    rank: hand.rank,
    hand
  };
}

/**
 * 比较多个玩家的牌型，返回赢家
 * @param players 参与摊牌的玩家
 * @param communityCards 公共牌
 * @returns 赢家数组（可能平局）
 */
export function determineWinners(
  players: Player[],
  communityCards: CardString[]
): WinnerResult[] {
  // 评估所有玩家的牌型
  const evaluations = players.map(player => ({
    player,
    evaluation: evaluateHand(player.holeCards, communityCards)
  }));
  
  // 提取所有 Hand 对象
  const hands = evaluations.map(e => e.evaluation.hand);
  
  // 使用 pokersolver 的 winners 方法找出赢家
  const winningHands = Hand.winners(hands);
  
  // 返回赢家
  return evaluations.filter(e => winningHands.includes(e.evaluation.hand));
}

/**
 * 获取牌型的中文描述
 */
export function getHandNameChinese(name: string): string {
  const nameMap: Record<string, string> = {
    'Royal Flush': '皇家同花顺',
    'Straight Flush': '同花顺',
    'Four of a Kind': '四条',
    'Full House': '葫芦',
    'Flush': '同花',
    'Straight': '顺子',
    'Three of a Kind': '三条',
    'Two Pair': '两对',
    'Pair': '一对',
    'High Card': '高牌'
  };
  
  return nameMap[name] || name;
}

/**
 * 比较两手牌
 * @returns 正数表示 hand1 大，负数表示 hand2 大，0表示平局
 */
export function compareHands(
  hand1: any, 
  hand2: any
): number {
  return hand1.compare(hand2);
}
