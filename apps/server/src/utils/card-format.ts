/**
 * PokerMind Arena - 卡牌格式化工具
 * 
 * 将内部卡牌表示转换为前端显示格式
 */

import type { CardString, Suit, Rank } from '../engine/types.js';
import { parseCard } from '../engine/deck.js';

// 花色映射：内部表示 -> 显示符号
const SUIT_SYMBOLS: Record<Suit, string> = {
  's': '♠',  // Spades - 黑桃
  'h': '♥',  // Hearts - 红桃
  'd': '♦',  // Diamonds - 方块
  'c': '♣'   // Clubs - 梅花
};

// 花色中文名
const SUIT_NAMES: Record<Suit, string> = {
  's': '黑桃',
  'h': '红桃',
  'd': '方块',
  'c': '梅花'
};

// 花色颜色类
const SUIT_COLORS: Record<Suit, 'red' | 'black'> = {
  's': 'black',
  'h': 'red',
  'd': 'red',
  'c': 'black'
};

// 点数映射：内部表示 -> 显示文本
const RANK_DISPLAY: Record<Rank, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  'T': '10',
  'J': 'J',
  'Q': 'Q',
  'K': 'K',
  'A': 'A'
};

// 点数中文名
const RANK_NAMES: Record<Rank, string> = {
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
  'T': '十',
  'J': 'J',
  'Q': 'Q',
  'K': 'K',
  'A': 'A'
};

/**
 * 格式化后的卡牌信息
 */
export interface FormattedCard {
  /** 原始表示 (如 "As") */
  raw: string;
  /** 显示符号 (如 "A♠") */
  display: string;
  /** 花色符号 (如 "♠") */
  suitSymbol: string;
  /** 花色名称 (如 "黑桃") */
  suitName: string;
  /** 点数显示 (如 "A") */
  rankDisplay: string;
  /** 点数中文 (如 "A") */
  rankName: string;
  /** 颜色 */
  color: 'red' | 'black';
  /** CSS类名 */
  colorClass: string;
}

/**
 * 格式化单张卡牌
 * 
 * @param card - 内部卡牌表示 (如 "As", "Kh", "Td")
 * @returns 格式化后的卡牌信息
 * 
 * @example
 * ```ts
 * const card = formatCardForDisplay('As');
 * // => { display: 'A♠', color: 'black', ... }
 * ```
 */
export function formatCardForDisplay(card: CardString): FormattedCard {
  if (!card || card.length < 2) {
    return {
      raw: '',
      display: '🂠',  // 卡背
      suitSymbol: '',
      suitName: '',
      rankDisplay: '',
      rankName: '',
      color: 'black',
      colorClass: 'text-gray-500'
    };
  }
  
  const { rank, suit } = parseCard(card);
  const suitSymbol = SUIT_SYMBOLS[suit];
  const rankDisplay = RANK_DISPLAY[rank];
  const color = SUIT_COLORS[suit];
  
  return {
    raw: card,
    display: `${rankDisplay}${suitSymbol}`,
    suitSymbol,
    suitName: SUIT_NAMES[suit],
    rankDisplay,
    rankName: RANK_NAMES[rank],
    color,
    colorClass: color === 'red' ? 'text-red-600' : 'text-gray-900'
  };
}

/**
 * 批量格式化卡牌
 */
export function formatCardsForDisplay(cards: CardString[]): FormattedCard[] {
  return cards.map(formatCardForDisplay);
}

/**
 * 生成卡牌的 CSS 类名
 */
export function getCardClassName(card: CardString): string {
  const formatted = formatCardForDisplay(card);
  const baseClass = 'card';
  const colorClass = formatted.color === 'red' ? 'card-red' : 'card-black';
  const suitClass = `card-${formatted.raw[1]}`;
  
  return `${baseClass} ${colorClass} ${suitClass}`;
}

/**
 * 获取卡牌的 Emoji 表示
 */
export function getCardEmoji(card: CardString): string {
  if (!card || card.length < 2) {
    return '🂠';  // 卡背
  }
  
  // Unicode 扑克牌字符起始位置
  // 黑桃: U+1F0A1, 红桃: U+1F0B1, 方块: U+1F0C1, 梅花: U+1F0D1
  const SUIT_BASE: Record<Suit, number> = {
    's': 0x1F0A0,  // 黑桃
    'h': 0x1F0B0,  // 红桃
    'd': 0x1F0C0,  // 方块
    'c': 0x1F0D0   // 梅花
  };
  
  // 点数偏移
  const RANK_OFFSET: Record<Rank, number> = {
    'A': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    'T': 10,
    'J': 11,
    // 注意：Unicode 扑克牌中 C (骑士) 在 Q 前面
    'Q': 13,
    'K': 14
  };
  
  const { rank, suit } = parseCard(card);
  const codePoint = SUIT_BASE[suit] + RANK_OFFSET[rank];
  
  return String.fromCodePoint(codePoint);
}

/**
 * 将卡牌数组转换为简洁字符串表示
 * 
 * @example
 * ```ts
 * cardsToString(['As', 'Kh', 'Qd'])
 * // => "A♠ K♥ Q♦"
 * ```
 */
export function cardsToString(cards: CardString[]): string {
  return cards
    .map(card => formatCardForDisplay(card).display)
    .join(' ');
}

/**
 * 将卡牌数组转换为中文描述
 * 
 * @example
 * ```ts
 * cardsToChineseString(['As', 'Kh'])
 * // => "黑桃A 红桃K"
 * ```
 */
export function cardsToChineseString(cards: CardString[]): string {
  return cards
    .map(card => {
      const formatted = formatCardForDisplay(card);
      return `${formatted.suitName}${formatted.rankDisplay}`;
    })
    .join(' ');
}
