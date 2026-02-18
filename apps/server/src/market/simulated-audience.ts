/**
 * PokerMind Arena - 模拟观众生成器
 * 
 * 在没有真实用户的情况下，生成模拟投注数据
 * 让演示看起来更热闹
 */

import type { 
  PredictionMarket, 
  SimulatedBet, 
  SimulatedBetConfig 
} from './types.js';

/** 默认配置 */
const DEFAULT_CONFIG: SimulatedBetConfig = {
  minBettors: 20,
  maxBettors: 50,
  minBetAmount: 10,
  maxBetAmount: 100,
  favoredBias: 0.3
};

/** 名字前缀 */
const NAME_PREFIXES = [
  '快乐', '神秘', '硬核', '佛系', '狂热', '专业', 
  '菜鸟', '老司机', '隐藏', '传说', '普通', '神奇',
  '沉默', '疯狂', '理智', '幸运', '倔强', '执着'
];

/** 名字后缀 */
const NAME_SUFFIXES = [
  '赌徒', '观众', '玩家', '分析师', '粉丝', '路人',
  '达人', '萌新', '大神', '水友', '铁粉', '押注王'
];

/**
 * 模拟观众生成器
 */
export class SimulatedAudienceGenerator {
  private config: SimulatedBetConfig;
  
  constructor(config: Partial<SimulatedBetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 生成模拟观众名称
   */
  private generateViewerName(): string {
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    const number = Math.floor(Math.random() * 999);
    return `${prefix}${suffix}${number}`;
  }
  
  /**
   * 在范围内生成随机整数
   */
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  /**
   * 生成随机投注金额（倾向于整数）
   */
  private generateBetAmount(): number {
    const amounts = [10, 20, 25, 50, 100];
    
    // 70% 概率选择预设金额
    if (Math.random() < 0.7) {
      return amounts[Math.floor(Math.random() * amounts.length)];
    }
    
    // 30% 概率随机金额
    return this.randomInRange(this.config.minBetAmount, this.config.maxBetAmount);
  }
  
  /**
   * 生成初始模拟投注（游戏创建时）
   */
  generateInitialBets(market: PredictionMarket): SimulatedBet[] {
    const bettorCount = this.randomInRange(
      this.config.minBettors, 
      this.config.maxBettors
    );
    
    const bets: SimulatedBet[] = [];
    
    // 随机选择一个"热门"选项
    const favoredIndex = Math.floor(Math.random() * market.options.length);
    
    for (let i = 0; i < bettorCount; i++) {
      // 决定押哪个选项
      let optionIndex: number;
      
      if (Math.random() < this.config.favoredBias) {
        // 偏向热门选项
        optionIndex = favoredIndex;
      } else {
        // 随机选择
        optionIndex = Math.floor(Math.random() * market.options.length);
      }
      
      const option = market.options[optionIndex];
      
      bets.push({
        viewerName: this.generateViewerName(),
        optionId: option.aiId,
        optionAvatar: option.avatar,
        amount: this.generateBetAmount(),
        timestamp: Date.now() - Math.floor(Math.random() * 60000) // 过去1分钟内
      });
    }
    
    // 按时间排序
    bets.sort((a, b) => a.timestamp - b.timestamp);
    
    return bets;
  }
  
  /**
   * 生成实时模拟投注（游戏进行中）
   */
  generateLiveBet(market: PredictionMarket): SimulatedBet | null {
    if (market.status !== 'open') {
      return null;
    }
    
    // 计算当前赔率，倾向于押赔率高的
    const totalPool = market.totalPool || 1;
    const weights = market.options.map(option => {
      const odds = totalPool / (option.totalBets || 1);
      // 赔率越高，被选中概率越低（模拟真实行为）
      return 1 / Math.sqrt(odds);
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    let selectedOption = market.options[0];
    for (let i = 0; i < market.options.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedOption = market.options[i];
        break;
      }
    }
    
    return {
      viewerName: this.generateViewerName(),
      optionId: selectedOption.aiId,
      optionAvatar: selectedOption.avatar,
      amount: this.generateBetAmount(),
      timestamp: Date.now()
    };
  }
  
  /**
   * 生成投注评论（可选，增加氛围）
   */
  generateBetComment(bet: SimulatedBet, aiName: string): string {
    const comments = [
      `${bet.viewerName} 押了 ${aiName} $${bet.amount}`,
      `${bet.viewerName}: "${aiName}稳了！"`,
      `${bet.viewerName} 梭哈 ${aiName}！`,
      `${bet.viewerName}: "相信${aiName}！"`,
      `${bet.viewerName} 小押 ${aiName} $${bet.amount}`,
      `${bet.viewerName}: "${aiName}今天状态好"`,
      `${bet.viewerName} 跟投 ${aiName}`,
    ];
    
    return comments[Math.floor(Math.random() * comments.length)];
  }
}

/** 单例导出 */
export const simulatedAudienceGenerator = new SimulatedAudienceGenerator();
