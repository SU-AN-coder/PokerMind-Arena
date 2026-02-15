/**
 * PokerMind Arena - AI Agent 模块入口
 */

// 类型导出
export type {
  AIDecision,
  AIAction,
  AIPersonality,
  EmotionType,
  SimpleGameContext,
  ChatMessage,
  LLMOptions,
  LLMProvider,
  TauntRecord,
  GameLog
} from './types.js';

// 角色导出
export {
  FIRE_PERSONALITY,
  ICE_PERSONALITY,
  SHADOW_PERSONALITY,
  LOGIC_PERSONALITY,
  ALL_PERSONALITIES,
  getPersonalityById
} from './personalities/index.js';

// 核心类导出
export { AIAgent } from './ai-agent.js';
export { EmotionStateMachine } from './emotion-machine.js';
export { ResponseParser, responseParser } from './response-parser.js';
export { MentionProcessor, mentionProcessor } from './mention-processor.js';

// LLM 服务导出
export { LLMService, llmService } from './llm/llm-service.js';

// Prompt 构建导出
export { buildSimplePrompt, buildContextFromGameState } from './prompts/simple-prompt.js';

// 日志导出
export { GameLogger, gameLogger } from './logging/game-logger.js';
