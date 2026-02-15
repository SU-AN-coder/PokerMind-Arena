/**
 * PokerMind Arena - 情绪状态机
 * 
 * AI 的情绪会根据游戏事件动态变化，影响决策和对话风格
 */

import type { EmotionType, EmotionTrigger } from './types.js';

/** 情绪触发规则 */
const EMOTION_RULES: EmotionTrigger[] = [
  {
    condition: 'won_against_rival',      // 赢了宿敌
    from: ['*'],
    to: 'mocking',
    duration: 2
  },
  {
    condition: 'lost_to_bluff',           // 被诈唬成功
    from: ['neutral', 'confident'],
    to: 'tilting',
    duration: 3
  },
  {
    condition: 'won_big_pot',             // 赢大底池
    from: ['*'],
    to: 'confident',
    duration: 2
  },
  {
    condition: 'lost_half_stack',         // 输掉一半筹码
    from: ['*'],
    to: 'cautious',
    duration: 2
  },
  {
    condition: 'got_bad_beat',            // 遭遇 Bad Beat
    from: ['*'],
    to: 'angry',
    duration: 2
  },
  {
    condition: 'consecutive_wins',        // 连赢
    from: ['*'],
    to: 'confident',
    duration: 3
  },
  {
    condition: 'consecutive_losses',      // 连输
    from: ['neutral', 'confident'],
    to: 'tilting',
    duration: 2
  }
];

/**
 * 情绪状态机
 */
export class EmotionStateMachine {
  private state: EmotionType = 'neutral';
  private countdown: number = 0;
  private emotionalStability: number;
  
  constructor(emotionalStability: number = 0.5) {
    this.emotionalStability = emotionalStability;
  }
  
  /**
   * 获取当前情绪
   */
  getState(): EmotionType {
    return this.state;
  }
  
  /**
   * 触发情绪变化
   */
  trigger(event: string): void {
    for (const rule of EMOTION_RULES) {
      if (rule.condition === event) {
        if (rule.from.includes('*') || rule.from.includes(this.state)) {
          // 情绪稳定性高的AI更难被触发
          if (Math.random() > this.emotionalStability) {
            this.state = rule.to;
            this.countdown = rule.duration;
          }
          break;
        }
      }
    }
  }
  
  /**
   * 每轮结束后调用，递减情绪持续时间
   */
  tick(): void {
    if (this.countdown > 0) {
      this.countdown--;
      if (this.countdown === 0) {
        this.state = 'neutral';
      }
    }
  }
  
  /**
   * 重置情绪
   */
  reset(): void {
    this.state = 'neutral';
    this.countdown = 0;
  }
  
  /**
   * 获取情绪修饰 Prompt
   */
  getPromptModifier(): string {
    switch (this.state) {
      case 'confident':
        return '⚡ 你现在信心爆棚！说话更嚣张，更倾向 All-in！';
      case 'tilting':
        return '😤 你现在有点上头！想要翻本，更容易冲动 All-in！';
      case 'angry':
        return '🔥 你很愤怒！想要报复，可能做出不理性决策！';
      case 'mocking':
        return '😏 你刚赢了宿敌！狠狠嘲讽他！';
      case 'cautious':
        return '😰 你输了很多，现在比较谨慎，除非牌很好否则倾向弃牌。';
      case 'nervous':
        return '😓 你有点紧张，说话不要太自信。';
      default:
        return '';
    }
  }
}
