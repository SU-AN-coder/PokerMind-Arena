/**
 * PokerMind Arena - Kimi 流式 Provider
 * 
 * 备选 LLM，中文效果好
 */

import type { ChatMessage, LLMOptions } from '../../types.js';
import { BaseLLMProvider } from './base.js';

export class KimiStreamProvider extends BaseLLMProvider {
  name = 'Kimi-Moonshot';
  
  constructor(apiKey: string) {
    super(apiKey, 'https://api.moonshot.cn/v1');
  }
  
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string> {
    const bodyData = JSON.stringify({
      model: 'moonshot-v1-8k',
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.8,
      max_tokens: options?.maxTokens ?? 200
    });
    
    // 确保 API key 是纯 ASCII
    const cleanApiKey = this.apiKey.replace(/[^\x00-\x7F]/g, '');
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanApiKey}`
      },
      body: bodyData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kimi API error: ${response.status} - ${errorText}`);
    }
    
    return this.parseSSEStream(
      response,
      onChunk,
      (data) => {
        const choices = data.choices as { delta?: { content?: string } }[] | undefined;
        return choices?.[0]?.delta?.content || '';
      }
    );
  }
}
