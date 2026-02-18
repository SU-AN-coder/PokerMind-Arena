/**
 * PokerMind Arena - 智谱 GLM-4-Flash 流式 Provider
 * 
 * 免费！主力 LLM 选择
 */

import type { ChatMessage, LLMOptions } from '../../types.js';
import { BaseLLMProvider } from './base.js';

export class ZhipuStreamProvider extends BaseLLMProvider {
  name = 'Zhipu-GLM4-Flash';
  
  constructor(apiKey: string) {
    super(apiKey, 'https://open.bigmodel.cn/api/paas/v4');
  }
  
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string> {
    // 确保 body 正确编码为 UTF-8
    const bodyData = JSON.stringify({
      model: 'glm-4-flash',  // 免费模型！
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
      throw new Error(`Zhipu API error: ${response.status} - ${errorText}`);
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
