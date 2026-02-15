/**
 * PokerMind Arena - @提及处理器
 * 
 * 处理 AI 之间的 @互动，提取被提及的目标
 */

import type { TauntRecord } from './types.js';

/**
 * 提及处理器
 */
export class MentionProcessor {
  private playerNames: string[] = [];
  
  /**
   * 设置玩家名称列表
   */
  setPlayers(names: string[]): void {
    this.playerNames = names;
  }
  
  /**
   * 从对话中提取被 @的玩家名
   */
  extractTarget(speech: string): string | null {
    // 匹配 @名字 模式
    const mentionMatch = speech.match(/@(\S+)/);
    if (!mentionMatch) return null;
    
    const mentioned = mentionMatch[1];
    
    // 检查是否是有效玩家名
    const target = this.playerNames.find(name => 
      name === mentioned || 
      name.includes(mentioned) ||
      mentioned.includes(name)
    );
    
    return target || null;
  }
  
  /**
   * 高亮 @提及（用于前端显示）
   */
  highlightMentions(speech: string): string {
    return speech.replace(
      /@(\S+)/g,
      '<span class="text-blue-400 font-bold">@$1</span>'
    );
  }
  
  /**
   * 构建嘲讽上下文（用于 AI Prompt）
   */
  buildTauntContext(recentTaunts: TauntRecord[], currentPlayerId: string): string {
    // 筛选针对当前玩家的嘲讽
    const relevantTaunts = recentTaunts
      .filter(t => t.content.includes(`@${currentPlayerId}`) || t.content.includes('@'))
      .slice(-3);  // 最近3条
    
    if (relevantTaunts.length === 0) return '';
    
    return `
## ⚠️ 有人在挑衅你！

${relevantTaunts.map(t => `${t.from}: "${t.content}"`).join('\n')}

你可以选择回击或者无视。记住你的性格！
`;
  }
}

/** 单例 */
export const mentionProcessor = new MentionProcessor();
