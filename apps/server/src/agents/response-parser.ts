/**
 * PokerMind Arena - AI 响应解析器
 * 
 * 从 LLM 输出中提取结构化决策，支持容错
 */

import type { AIDecision, AIAction, EmotionType } from './types.js';
import { mentionProcessor } from './mention-processor.js';

/**
 * 响应解析器
 */
export class ResponseParser {
  /**
   * 解析 LLM 响应
   */
  parse(response: string): AIDecision {
    try {
      // 1. 尝试提取 JSON 块
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return this.validateAndNormalize(parsed, response);
      }
      
      // 2. 尝试直接解析 JSON
      const directMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (directMatch) {
        const parsed = JSON.parse(directMatch[0]);
        return this.validateAndNormalize(parsed, response);
      }
      
      // 3. 容错：从自然语言提取
      return this.fallbackParse(response);
    } catch {
      return this.fallbackParse(response);
    }
  }
  
  /**
   * 验证并规范化解析结果
   */
  private validateAndNormalize(parsed: Record<string, unknown>, raw: string): AIDecision {
    const action = this.normalizeAction(parsed.action);
    const target = mentionProcessor.extractTarget(
      typeof parsed.speech === 'string' ? parsed.speech : ''
    );
    
    return {
      action,
      speech: this.normalizeSpeech(parsed.speech),
      emotion: this.normalizeEmotion(parsed.emotion),
      target,
      rawResponse: raw,
      parseSuccess: true
    };
  }
  
  /**
   * 规范化动作
   */
  private normalizeAction(action: unknown): AIAction {
    if (typeof action === 'string') {
      const lower = action.toLowerCase();
      if (lower.includes('allin') || lower.includes('all-in') || lower.includes('all_in')) {
        return 'allin';
      }
    }
    return 'fold';
  }
  
  /**
   * 规范化情绪
   */
  private normalizeEmotion(emotion: unknown): EmotionType {
    const validEmotions: EmotionType[] = ['confident', 'angry', 'mocking', 'nervous', 'neutral', 'tilting', 'cautious'];
    
    if (typeof emotion === 'string' && validEmotions.includes(emotion as EmotionType)) {
      return emotion as EmotionType;
    }
    return 'neutral';
  }
  
  /**
   * 规范化对话
   */
  private normalizeSpeech(speech: unknown): string {
    if (typeof speech === 'string') {
      // 限制长度
      return speech.slice(0, 100);
    }
    return '...';
  }
  
  /**
   * 容错解析（从自然语言推断）
   */
  private fallbackParse(response: string): AIDecision {
    // 简单关键词判断
    const isAllin = /all.?in|全押|梭哈|来啊|干|冲|搞/i.test(response);
    
    // 尝试提取说话内容
    let speech = '...';
    const speechMatch = response.match(/["「『](.+?)["」』]/);
    if (speechMatch) {
      speech = speechMatch[1];
    } else {
      // 取最后一行非 JSON 内容
      const lines = response.split('\n').filter(l => !l.includes('{') && l.trim().length > 0);
      if (lines.length > 0) {
        speech = lines[lines.length - 1].slice(0, 50);
      }
    }
    
    return {
      action: isAllin ? 'allin' : 'fold',
      speech,
      emotion: 'neutral',
      target: mentionProcessor.extractTarget(speech),
      rawResponse: response,
      parseSuccess: false
    };
  }
}

/** 单例 */
export const responseParser = new ResponseParser();
