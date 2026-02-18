/**
 * PokerMind Arena - Mock LLM Provider
 * 
 * 用于测试和开发，无需 API Key
 */

import type { ChatMessage, LLMOptions, LLMProvider } from '../../types.js';

const MOCK_RESPONSES = [
  { action: 'allin', speech: '全押！干就完了！', emotion: 'confident', target: null },
  { action: 'allin', speech: '@冰山 你敢跟吗？胆小鬼！', emotion: 'mocking', target: '冰山' },
  { action: 'fold', speech: '这把先让你，下把见真章', emotion: 'cautious', target: null },
  { action: 'allin', speech: '概率站在我这边，押注！', emotion: 'confident', target: null },
  { action: 'allin', speech: '@暗影 你那点筹码还想跟我玩？', emotion: 'mocking', target: '暗影' },
  { action: 'fold', speech: '...算了，没必要', emotion: 'neutral', target: null },
  { action: 'allin', speech: '这牌必须打！All-in！', emotion: 'confident', target: null },
  { action: 'allin', speech: '来啊！今天不是你死就是我活！', emotion: 'angry', target: null },
];

/**
 * Mock LLM Provider
 */
export class MockLLMProvider implements LLMProvider {
  name = 'Mock-LLM';
  
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string> {
    // 随机选择一个响应
    const mockData = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    
    const response = '```json\n' + JSON.stringify(mockData, null, 2) + '\n```';
    
    // 模拟流式输出（每个字符间隔 20-40ms）
    for (const char of response) {
      await this.delay(20 + Math.random() * 20);
      onChunk(char);
    }
    
    return response;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
