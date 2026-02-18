/**
 * PokerMind Arena - LLM 统一调用服务
 */

import type { ChatMessage, LLMOptions, LLMProvider } from '../types.js';
import { ZhipuStreamProvider } from './providers/zhipu-stream.js';
import { KimiStreamProvider } from './providers/kimi-stream.js';
import { OpenAIStreamProvider } from './providers/openai-stream.js';
import { MockLLMProvider } from './providers/mock.js';

export type ProviderType = 'zhipu' | 'kimi' | 'openai' | 'mock';

/**
 * LLM 服务管理器
 */
export class LLMService {
  private providers: Map<ProviderType, LLMProvider> = new Map();
  private defaultProvider: ProviderType = 'zhipu';
  private useMock: boolean = false;
  
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
      console.log('   ✅ LLM Provider: Zhipu GLM-4-Flash');
    }
    
    if (kimiKey) {
      this.providers.set('kimi', new KimiStreamProvider(kimiKey));
      console.log('   ✅ LLM Provider: Kimi Moonshot');
    }
    
    if (openaiKey) {
      this.providers.set('openai', new OpenAIStreamProvider(openaiKey));
      console.log('   ✅ LLM Provider: OpenAI');
    }
    
    // 添加 Mock Provider 作为后备
    this.providers.set('mock', new MockLLMProvider());
    
    // 设置默认 provider
    if (this.providers.size > 1) {  // 除了 mock 还有其他 provider
      for (const key of this.providers.keys()) {
        if (key !== 'mock') {
          this.defaultProvider = key;
          break;
        }
      }
    } else {
      // 只有 mock provider
      this.defaultProvider = 'mock';
      this.useMock = true;
      console.log('   ⚠️ 未配置 API Key，使用 Mock LLM Provider');
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
   * 检查是否有可用的 provider（非 Mock）
   */
  hasAvailableProvider(): boolean {
    // 有超过一个 provider（包含 mock），说明有真正的 provider
    return this.providers.size > 1;
  }
  
  /**
   * 是否使用 Mock Provider
   */
  isUsingMock(): boolean {
    return this.useMock;
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
