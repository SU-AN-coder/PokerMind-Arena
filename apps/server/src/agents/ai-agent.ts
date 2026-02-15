/**
 * PokerMind Arena - AI Agent 类
 * 
 * 封装单个 AI 玩家的决策逻辑
 */

import type {
  AIPersonality,
  AIDecision,
  SimpleGameContext,
  ChatMessage,
  TauntRecord
} from './types.js';
import { EmotionStateMachine } from './emotion-machine.js';
import { responseParser } from './response-parser.js';
import { buildSimplePrompt } from './prompts/simple-prompt.js';
import { llmService } from './llm/llm-service.js';
import { mentionProcessor } from './mention-processor.js';

/**
 * AI 智能体
 */
export class AIAgent {
  readonly id: string;
  readonly personality: AIPersonality;
  private emotionMachine: EmotionStateMachine;
  private recentTaunts: TauntRecord[] = [];
  
  constructor(personality: AIPersonality) {
    this.id = personality.id;
    this.personality = personality;
    this.emotionMachine = new EmotionStateMachine(personality.emotionalStability);
  }
  
  /**
   * 获取当前情绪
   */
  getEmotion() {
    return this.emotionMachine.getState();
  }
  
  /**
   * 触发情绪变化
   */
  triggerEmotion(event: string): void {
    this.emotionMachine.trigger(event);
  }
  
  /**
   * 轮次结束
   */
  endRound(): void {
    this.emotionMachine.tick();
  }
  
  /**
   * 添加最近的嘲讽记录
   */
  addRecentTaunt(taunt: TauntRecord): void {
    this.recentTaunts.push(taunt);
    if (this.recentTaunts.length > 3) {
      this.recentTaunts.shift();
    }
  }
  
  /**
   * 构建嘲讽上下文
   */
  private buildTauntContext(): string {
    return mentionProcessor.buildTauntContext(this.recentTaunts, this.personality.name);
  }
  
  /**
   * 做出决策（带流式输出）
   */
  async makeDecision(
    gameContext: SimpleGameContext,
    onSpeechChunk: (chunk: string) => void
  ): Promise<AIDecision> {
    // 1. 构建增强 Prompt（含情绪修饰）
    const emotionModifier = this.emotionMachine.getPromptModifier();
    const tauntContext = this.buildTauntContext();
    
    const messages: ChatMessage[] = [
      { 
        role: 'system', 
        content: this.personality.systemPrompt + '\n\n' + emotionModifier 
      },
      { 
        role: 'user', 
        content: buildSimplePrompt(gameContext) + '\n\n' + tauntContext 
      }
    ];
    
    // 2. 流式调用 LLM
    let fullResponse = '';
    
    try {
      fullResponse = await llmService.streamChat(
        messages,
        (chunk) => {
          fullResponse += chunk;
          
          // 提取非 JSON 部分作为"说话"即时输出
          if (!chunk.includes('{') && !chunk.includes('}')) {
            onSpeechChunk(chunk);
          }
        },
        { temperature: 0.8, maxTokens: 200 }
      );
    } catch (error) {
      console.error(`AI ${this.id} decision failed:`, error);
      return {
        action: 'fold',
        speech: '...（思考中断）',
        emotion: 'neutral',
        target: null,
        rawResponse: '',
        parseSuccess: false
      };
    }
    
    // 3. 解析响应
    const decision = responseParser.parse(fullResponse);
    
    // 4. 根据性格调整（保底逻辑）
    if (!decision.parseSuccess) {
      decision.action = this.personalityBasedFallback();
    }
    
    return decision;
  }
  
  /**
   * 基于性格的保底决策
   */
  private personalityBasedFallback(): 'allin' | 'fold' {
    // 根据风险承受度决定
    return Math.random() < this.personality.riskTolerance ? 'allin' : 'fold';
  }
  
  /**
   * 重置状态（新游戏开始）
   */
  reset(): void {
    this.emotionMachine.reset();
    this.recentTaunts = [];
  }
}
