/**
 * PokerMind Arena - 牌组管理
 */

import type { CardString, Suit, Rank } from './types.js';

/** 所有花色 */
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

/** 所有点数 */
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/**
 * 创建一副标准52张扑克牌
 */
export function createDeck(): CardString[] {
  const deck: CardString[] = [];
  
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(rank + suit);  // "Ah", "Kd", etc.
    }
  }
  
  return deck;
}

/**
 * Fisher-Yates 洗牌算法
 * @param deck 牌组
 * @returns 洗好的牌组（新数组）
 */
export function shuffleDeck(deck: CardString[]): CardString[] {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * 从牌组顶部抽取指定数量的牌
 * @param deck 牌组（会被修改）
 * @param count 抽取数量
 * @returns 抽取的牌
 */
export function drawCards(deck: CardString[], count: number): CardString[] {
  const cards: CardString[] = [];
  
  for (let i = 0; i < count; i++) {
    const card = deck.pop();
    if (card) {
      cards.push(card);
    }
  }
  
  return cards;
}

/**
 * 解析牌字符串
 * @param card 牌字符串，如 "Ah", "10c"
 * @returns { rank, suit }
 */
export function parseCard(card: CardString): { rank: Rank; suit: Suit } {
  const suit = card.slice(-1) as Suit;
  const rank = card.slice(0, -1) as Rank;
  
  return { rank, suit };
}

/**
 * 验证牌字符串格式是否正确
 */
export function isValidCard(card: string): card is CardString {
  if (typeof card !== 'string' || card.length < 2 || card.length > 3) {
    return false;
  }
  
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  
  return SUITS.includes(suit as Suit) && RANKS.includes(rank as Rank);
}
