/**
 * PokerMind Arena - LLM 统一调用服务
 */

import type { ChatMessage, LLMOptions, LLMProvider } from '../types.js';
import { ZhipuStreamProvider } from './providers/zhipu-stream.js';
import { KimiStreamProvider } from './providers/kimi-stream.js';
import { OpenAIStreamProvider } from './providers/openai-stream.js';

export type ProviderType = 'zhipu' | 'kimi' | 'openai';

/**
 * LLM 服务管理器
 */
export class LLMService {
  private providers: Map<ProviderType, LLMProvider> = new Map();
  private defaultProvider: ProviderType = 'zhipu';
  
  constructor() {
    // 从环境变量初始化 providers
    this.initProviders();
  }
  
  private initProviders(): void {
    const zhipuKey = process.env.ZHIPU_API_KEY;
    const kimiKey = process.env.KIMI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (zhipuKey) {
      this.providers.set('zhipu', new ZhipuStreamProvider(zhipuKey));
    }
    
    if (kimiKey) {
      this.providers.set('kimi', new KimiStreamProvider(kimiKey));
    }
    
    if (openaiKey) {
      this.providers.set('openai', new OpenAIStreamProvider(openaiKey));
    }
    
    // 设置默认 provider
    if (this.providers.size > 0) {
      this.defaultProvider = this.providers.keys().next().value as ProviderType;
    }
  }
  
  /**
   * 设置默认 provider
   */
  setDefaultProvider(provider: ProviderType): void {
    if (this.providers.has(provider)) {
      this.defaultProvider = provider;
    }
  }
  
  /**
   * 流式调用 LLM
   */
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions & { provider?: ProviderType }
  ): Promise<string> {
    const providerType = options?.provider || this.defaultProvider;
    const provider = this.providers.get(providerType);
    
    if (!provider) {
      throw new Error(`LLM provider ${providerType} not configured`);
    }
    
    return provider.streamChat(messages, onChunk, options);
  }
  
  /**
   * 检查是否有可用的 provider
   */
  hasAvailableProvider(): boolean {
    return this.providers.size > 0;
  }
  
  /**
   * 列出所有可用的 providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

/** 单例 */
export const llmService = new LLMService();
