/**
 * PokerMind Arena - AI 智能体类型定义
 */

/** 情绪类型 */
export type EmotionType = 'confident' | 'angry' | 'mocking' | 'nervous' | 'neutral' | 'tilting' | 'cautious';

/** AI 决策动作 */
export type AIAction = 'allin' | 'fold';

/** AI 决策结果 */
export interface AIDecision {
  action: AIAction;
  speech: string;
  emotion: EmotionType;
  target: string | null;  // @某人
  rawResponse: string;
  parseSuccess: boolean;
}

/** AI 性格配置 */
export interface AIPersonality {
  id: string;
  name: string;
  avatar: string;
  style: 'aggressive' | 'conservative' | 'chaotic' | 'analytical';
  rival: string;           // 宿敌ID
  catchphrase: string;     // 口头禅
  riskTolerance: number;   // 0-1, 风险承受度
  bluffFrequency: number;  // 0-1, 诈唬频率
  trashtalkLevel: number;  // 0-1, 垃圾话程度
  emotionalStability: number; // 0-1, 情绪稳定性
  systemPrompt: string;    // System Prompt
}

/** 简化的游戏上下文（用于 AI Prompt） */
export interface SimpleGameContext {
  yourName: string;         // 你是谁
  holeCards: string;        // "A♠ K♥"
  communityCards: string;   // "J♠ 10♥ 9♣ 8♦ | -"
  yourStack: number;        // 你的筹码
  potSize: number;          // 底池
  survivingPlayers: {
    name: string;
    stack: number;
    lastAction: string;
  }[];
  recentDialogue: string[]; // 最近5条对话
  round: number;            // 第几轮
}

/** LLM 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** LLM 调用选项 */
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

/** LLM Provider 接口 */
export interface LLMProvider {
  name: string;
  streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string>;
}

/** 情绪触发规则 */
export interface EmotionTrigger {
  condition: string;
  from: (EmotionType | '*')[];
  to: EmotionType;
  duration: number;  // 持续几轮
}

/** 嘲讽记录 */
export interface TauntRecord {
  from: string;
  content: string;
  timestamp: number;
}

/** 游戏日志（用于链上验证） */
export interface GameLog {
  gameId: string;
  startTime: number;
  endTime: number;
  players: {
    id: string;
    name: string;
    avatar: string;
  }[];
  decisions: {
    timestamp: number;
    playerId: string;
    playerName: string;
    action: AIAction;
    speech: string;
    emotion: EmotionType;
    target: string | null;
    holeCards: string;
    communityCards: string;
    potSize: number;
  }[];
  communityCards: string[];
  winner: {
    id: string;
    name: string;
  };
  pot: number;
}
