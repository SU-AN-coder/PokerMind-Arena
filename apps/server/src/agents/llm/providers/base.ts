/**
 * PokerMind Arena - LLM Provider 基础接口
 */

import type { ChatMessage, LLMOptions, LLMProvider } from '../../types.js';

/**
 * LLM Provider 抽象基类
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string;
  protected apiKey: string;
  protected baseUrl: string;
  
  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  abstract streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string>;
  
  /**
   * 解析 SSE 数据流
   */
  protected async parseSSEStream(
    response: Response,
    onChunk: (text: string) => void,
    extractContent: (data: Record<string, unknown>) => string
  ): Promise<string> {
    let fullText = '';
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = extractContent(parsed);
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    return fullText;
  }
}
