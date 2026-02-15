// pokersolver 类型声明 (CommonJS 模块)
declare module 'pokersolver' {
  export interface HandInstance {
    /** 牌型名称，如 "Royal Flush", "Straight Flush" */
    name: string;
    
    /** 牌型描述，如 "Flush, A High", "Two Pair, K's & 9's" */
    descr: string;
    
    /** 牌型等级 (1-10) */
    rank: number;
    
    /** 组成这手牌的牌 */
    cards: { value: string; suit: string }[];
    
    /**
     * 比较两手牌
     * @returns 正数表示当前牌大，负数表示另一手牌大，0表示平局
     */
    compare(hand: HandInstance): number;
    
    /** 转换为字符串 */
    toString(): string;
  }

  export class Hand {
    name: string;
    descr: string;
    rank: number;
    cards: { value: string; suit: string }[];
    
    /**
     * 从牌数组求解最佳牌型
     * @param cards 牌数组，格式如 ["Ah", "Kd", "Qc", "Js", "10h"]
     * @param game 游戏类型，默认 "standard"
     */
    static solve(cards: string[], game?: string): HandInstance;
    
    /**
     * 从多个手牌中选出赢家
     * @param hands Hand 对象数组
     */
    static winners(hands: HandInstance[]): HandInstance[];
    
    compare(hand: HandInstance): number;
    toString(): string;
  }

  interface Pokersolver {
    Hand: typeof Hand;
  }

  const pokersolver: Pokersolver;
  export default pokersolver;
}
