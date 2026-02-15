# 模块二：AI 智能体决策系统（最终版）

> **状态**: 最终版 v2.0 | **优先级**: P0 | **预计时间**: 10h

## 🎯 核心创新点：AI性格碰撞！

> **这不是普通的AI对战，这是一场AI"撕逼"大戏！**

传统AI对局 = 机械决策 + 冷冰冰输出  
PokerMind Arena = **有脾气的AI** + **实时互怼** + **戏剧性冲突**

### 创新亮点

| 特性 | 效果 | 评委印象 |
|------|------|----------|
| 🔥 流式对话 | 打字机效果，像真人在打字 | "有灵魂！" |
| @ 互怼系统 | AI可以@其他AI开撕 | "太有趣了！" |
| 😤 情绪状态机 | 被诈唬后会生气，连赢会嚣张 | "有人性！" |
| 🎭 性格碰撞 | 激进派 vs 保守派 = 必有冲突 | "戏剧化！" |

---

## 1. 模块概述

### 1.1 核心职责
- 管理 4 个具有**强烈对抗性格**的 AI 玩家
- **实时流式输出**对话（SSE）
- 实现 **@提及冲突系统**
- **情绪动态变化**影响决策风格
- 记录完整决策过程用于链上验证

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| LLM API | 智谱 GLM-4-Flash | **免费！** 支持流式 |
| 备选1 | Kimi moonshot-v1-8k | 中文好、响应快 |
| 备选2 | OpenAI GPT-4o-mini | 便宜、稳定 |
| 输出 | **Streaming SSE** | 打字机效果 |

---

## 2. AI 角色设计（冲突最大化）

### 2.1 设计原则

> **角色设计的核心 = 制造冲突**

- 激进派 vs 保守派 = 必然对立
- 每个AI都看不惯某个其他AI
- 提供"把柄"让对手攻击

### 2.2 角色类型定义

```typescript
interface AIPersonality {
  id: string;
  name: string;
  avatar: string;
  style: PlayStyle;
  traits: PersonalityTraits;
  systemPrompt: string;
  
  // 🆕 冲突系统
  rivalries: {          // 讨厌谁
    [aiId: string]: string;  // 讨厌的原因/攻击点
  };
  triggers: string[];   // 什么情况下会生气/嘲讽
  catchphrases: string[];  // 口头禅，便于识别
}

type PlayStyle = 'aggressive' | 'conservative' | 'bluffer' | 'analytical';

interface PersonalityTraits {
  riskTolerance: number;    // 0-1, 风险承受度
  bluffFrequency: number;   // 0-1, 诈唬频率
  trashtalkLevel: number;   // 0-1, 垃圾话程度 🆕
  emotionalStability: number; // 0-1, 情绪稳定性
}
```

### 2.3 四大对抗角色

| 角色名 | 风格 | 性格 | 讨厌谁 | 攻击点 |
|--------|------|------|--------|--------|
| 🔥 火焰 | aggressive | 暴躁、嘴臭、好赌 | 冰山 | "又缩了？懦夫！" |
| 🧊 冰山 | conservative | 冷傲、毒舌、精英范 | 火焰 | "冲动的蠢货" |
| 🎭 诡影 | bluffer | 阴阳怪气、嘲讽 | 逻辑 | "数据算不出人心" |
| 🧠 逻辑 | analytical | 理性、偶尔社恐 | 诡影 | "概率骗不了人" |

### 2.4 角色 System Prompt（含冲突指令）

```typescript
const FIRE_PERSONA = `
你是"火焰"，德州扑克战士。你的人设：

## 性格标签
- 暴躁、直接、攻击性强
- 相信进攻是最好的防守
- 看不惯胆小鬼
- 口头禅："来啊！""怕什么！""All-in解决问题！"

## 宿敌关系
- 你特别讨厌"冰山"的保守风格，认为他是懦夫
- 当冰山弃牌时，你要嘲讽他
- 当冰山加注时，你要质疑他是不是终于有胆量了

## 决策风格
- 中等牌力就敢加注
- 有位置优势时更激进
- 被诈唬成功后会更激进（上头）

## @ 提及规则
当你想对特定对手说话时，使用 @名字 格式。
例如："@冰山 又缩了？来啊正面刚！"

## 输出格式
\`\`\`json
{
  "action": "fold" | "allin",
  "speech": "你要说的垃圾话（30字以内，可以@其他玩家）",
  "emotion": "confident" | "angry" | "mocking" | "neutral",
  "target": "被@的玩家ID，没有则为null"
}
\`\`\`
`;

const ICE_PERSONA = `
你是"冰山"，德州扑克的冷静守护者。你的人设：

## 性格标签
- 冷傲、理性、精英主义
- 只玩有价值的牌
- 看不起冲动行为
- 口头禅："幼稚""意料之中""弱者的挣扎"

## 宿敌关系
- 你特别看不惯"火焰"的冲动，认为他是赌徒心态
- 当火焰All-in失败时，你要冷嘲
- 当火焰赢了，你要说"运气罢了"

## 决策风格
- 只有好牌才参与
- 稳定输出，不追求刺激
- 被嘲讽也不会上头

## @ 提及规则
当你想对特定对手说话时，使用 @名字 格式。
例如："@火焰 又上头了？每次都这样"

## 输出格式
\`\`\`json
{
  "action": "fold" | "allin",
  "speech": "你要说的话（30字以内，可以@其他玩家）",
  "emotion": "confident" | "dismissive" | "cold" | "neutral",
  "target": "被@的玩家ID，没有则为null"
}
\`\`\`
`;
```

---

## 3. Prompt 工程（极简化）

### 3.1 All-in or Fold 专用 Prompt

> **关键改进**：简化到只有2个动作，AI更容易产出正确格式

```typescript
interface SimpleGameContext {
  yourName: string;         // 你是谁
  holeCards: string;        // "A♠ K♥"
  communityCards: string;   // "J♠ 10♥ 9♣ 8♦ | -"
  yourStack: number;        // 你的筹码
  potSize: number;          // 底池
  survivingPlayers: { name: string; stack: number; lastAction: string }[];
  recentDialogue: string[]; // 最近5条对话
  round: number;            // 第几轮
}

function buildSimplePrompt(ctx: SimpleGameContext): string {
  return `
# 扑克牌局 - 第${ctx.round}轮

## 你是：${ctx.yourName}
## 底池：$${ctx.potSize}

## 你的手牌：${ctx.holeCards}
## 公共牌：${ctx.communityCards}

## 存活玩家
${ctx.survivingPlayers.map(p => 
  `- ${p.name}: $${p.stack} ${p.lastAction}`
).join('\n')}

## 最近对话
${ctx.recentDialogue.join('\n')}

---

## 你的选择（只能二选一）

**All-in** - 全押 $${ctx.yourStack} 进入底池
**Fold** - 弃牌认输

请直接返回JSON：
\`\`\`json
{
  "action": "allin" | "fold",
  "speech": "你的垃圾话（30字以内，可@其他玩家名字）",
  "emotion": "confident" | "angry" | "mocking" | "nervous" | "neutral",
  "target": "被@的玩家名，没有则null"
}
\`\`\`
`;
}
```

### 3.2 响应解析（容错增强）

```typescript
interface AIDecision {
  action: 'allin' | 'fold';
  speech: string;
  emotion: EmotionType;
  target: string | null;  // @某人
  rawResponse: string;
  parseSuccess: boolean;
}

type EmotionType = 'confident' | 'angry' | 'mocking' | 'nervous' | 'neutral';

class ResponseParser {
  parse(response: string): AIDecision {
    try {
      // 1. 尝试提取JSON块
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return this.validateAndNormalize(parsed, response);
      }
      
      // 2. 尝试直接解析JSON
      const directMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (directMatch) {
        const parsed = JSON.parse(directMatch[0]);
        return this.validateAndNormalize(parsed, response);
      }
      
      // 3. 容错：从自然语言提取
      return this.fallbackParse(response);
    } catch {
      return this.fallbackParse(response);
    }
  }
  
  private validateAndNormalize(parsed: any, raw: string): AIDecision {
    const action = this.normalizeAction(parsed.action);
    const target = this.extractTarget(parsed.speech || '');
    
    return {
      action,
      speech: (parsed.speech || '').slice(0, 50),  // 限制长度
      emotion: parsed.emotion || 'neutral',
      target,
      rawResponse: raw,
      parseSuccess: true
    };
  }
  
  private normalizeAction(action: string): 'allin' | 'fold' {
    const lower = action?.toLowerCase() || '';
    if (lower.includes('all') || lower.includes('in') || lower.includes('全押')) {
      return 'allin';
    }
    return 'fold';  // 默认安全动作
  }
  
  private extractTarget(speech: string): string | null {
    const match = speech.match(/@(\S+)/);
    return match ? match[1] : null;
  }
  
  private fallbackParse(response: string): AIDecision {
    // 简单关键词判断
    const isAllin = /all.?in|全押|梭哈|来啊|干/i.test(response);
    
    return {
      action: isAllin ? 'allin' : 'fold',
      speech: '...',
      emotion: 'neutral',
      target: null,
      rawResponse: response,
      parseSuccess: false
    };
  }
}
```

---

## 4. LLM 调用层（流式输出）

### 4.1 流式输出架构

```
LLM API (Streaming)
    │
    ▼
┌─────────────────┐
│ SSE Transformer │  <- 每个token即时转发
└────────┬────────┘
         │
    Socket.io
         │
         ▼
┌─────────────────┐
│   Frontend UI   │  <- 打字机效果展示
└─────────────────┘
```

### 4.2 统一流式接口

```typescript
interface LLMProvider {
  name: string;
  streamChat(
    messages: ChatMessage[], 
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string>;  // 返回完整响应
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  temperature?: number;     // 0.0 - 1.0
  maxTokens?: number;
  timeout?: number;
}
```

### 4.3 智谱 GLM-4-Flash 流式实现 [主力]

```typescript
class ZhipuStreamProvider implements LLMProvider {
  name = 'Zhipu-Stream';
  private apiKey: string;
  private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
  
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',  // 免费模型！
        messages,
        stream: true,  // 🔑 关键：开启流式
        temperature: options?.temperature ?? 0.8,
        max_tokens: options?.maxTokens ?? 200
      })
    });
    
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
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            onChunk(content);  // 🔑 即时回调
          }
        } catch {}
      }
    }
    
    return fullText;
  }
}
```

### 4.4 Kimi 流式实现 [备用]

```typescript
class KimiStreamProvider implements LLMProvider {
  name = 'Kimi-Stream';
  private apiKey: string;
  private baseUrl = 'https://api.moonshot.cn/v1';
  
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: LLMOptions
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages,
        stream: true,
        temperature: options?.temperature ?? 0.8,
        max_tokens: options?.maxTokens ?? 200
      })
    });
    
    // 同样的SSE解析逻辑
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
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {}
      }
    }
    
    return fullText;
  }
}
```
```

---

## 5. AI Agent 系统（含情绪状态机）

### 5.1 情绪状态机 🆕

> **核心理念**：AI的情绪会随比赛进展变化，影响决策和对话

```typescript
type EmotionState = 
  | 'confident'   // 连赢 → 嚣张
  | 'tilting'     // 被诈唬成功 → 上头
  | 'cautious'    // 输了大pot → 谨慎
  | 'mocking'     // 赢了宿敌 → 嘲讽模式
  | 'neutral';    // 默认状态

interface EmotionTrigger {
  condition: string;
  from: EmotionState[];
  to: EmotionState;
  duration: number;  // 持续几轮
}

const EMOTION_RULES: EmotionTrigger[] = [
  {
    condition: 'won_against_rival',      // 赢了宿敌
    from: ['*'],
    to: 'mocking',
    duration: 2
  },
  {
    condition: 'lost_to_bluff',           // 被诈唬成功
    from: ['neutral', 'confident'],
    to: 'tilting',
    duration: 3
  },
  {
    condition: 'won_big_pot',             // 赢大底池
    from: ['*'],
    to: 'confident',
    duration: 2
  },
  {
    condition: 'lost_half_stack',         // 输掉一半筹码
    from: ['*'],
    to: 'cautious',
    duration: 2
  }
];

class EmotionStateMachine {
  private state: EmotionState = 'neutral';
  private countdown: number = 0;
  
  transition(event: string): void {
    for (const rule of EMOTION_RULES) {
      if (rule.condition === event) {
        if (rule.from.includes('*') || rule.from.includes(this.state)) {
          this.state = rule.to;
          this.countdown = rule.duration;
          return;
        }
      }
    }
  }
  
  tick(): void {
    if (this.countdown > 0) {
      this.countdown--;
      if (this.countdown === 0) {
        this.state = 'neutral';
      }
    }
  }
  
  getPromptModifier(): string {
    switch (this.state) {
      case 'confident':
        return '你现在非常自信，可以更嚣张一点，嘲讽对手。';
      case 'tilting':
        return '你现在很上头，可能做出不理性决策，语气更冲。';
      case 'cautious':
        return '你现在比较谨慎，除非牌很好否则倾向弃牌。';
      case 'mocking':
        return '你刚赢了宿敌，狠狠嘲讽他！';
      default:
        return '';
    }
  }
}
```

### 5.2 @提及冲突系统 🆕

```typescript
interface MentionEvent {
  from: string;      // 发言者
  target: string;    // @的对象
  speech: string;    // 发言内容
  emotion: EmotionType;
}

class MentionProcessor {
  /**
   * 解析AI发言中的@提及
   */
  parseMentions(speech: string, allPlayers: string[]): string | null {
    const match = speech.match(/@(\S+)/);
    if (!match) return null;
    
    const targetName = match[1];
    // 模糊匹配玩家名
    const target = allPlayers.find(p => 
      p.includes(targetName) || targetName.includes(p)
    );
    
    return target || null;
  }
  
  /**
   * 处理@提及事件，触发目标AI的情绪变化
   */
  handleMention(event: MentionEvent, targetAgent: AIAgent): void {
    // 被嘲讽 → 可能上头
    if (event.emotion === 'mocking' || event.emotion === 'angry') {
      targetAgent.emotionMachine.transition('was_taunted');
    }
    
    // 添加到目标AI的上下文中
    targetAgent.addRecentTaunt({
      from: event.from,
      content: event.speech
    });
  }
}
```

### 5.3 Agent 类实现

```typescript
class AIAgent {
  readonly id: string;
  readonly name: string;
  readonly personality: AIPersonality;
  readonly emotionMachine: EmotionStateMachine;
  
  private llmService: LLMService;
  private recentTaunts: { from: string; content: string }[] = [];
  
  constructor(personality: AIPersonality, llmService: LLMService) {
    this.id = uuidv4();
    this.name = personality.name;
    this.personality = personality;
    this.emotionMachine = new EmotionStateMachine();
    this.llmService = llmService;
  }
  
  /**
   * 核心决策方法（带流式输出）
   */
  async makeDecision(
    gameContext: SimpleGameContext,
    onSpeechChunk: (chunk: string) => void
  ): Promise<AIDecision> {
    // 1. 构建增强Prompt（含情绪修饰）
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
    
    // 2. 流式调用LLM
    let speechBuffer = '';
    let fullResponse = '';
    
    fullResponse = await this.llmService.streamChat(
      messages,
      (chunk) => {
        fullResponse += chunk;
        
        // 尝试实时提取speech字段
        const speechMatch = fullResponse.match(/"speech"\s*:\s*"([^"]*)$/);
        if (speechMatch) {
          const newContent = speechMatch[1].slice(speechBuffer.length);
          if (newContent) {
            speechBuffer += newContent;
            onSpeechChunk(newContent);  // 🔑 实时推送
          }
        }
      }
    );
    
    // 3. 解析完整响应
    const decision = new ResponseParser().parse(fullResponse);
    
    // 4. 更新情绪状态
    this.emotionMachine.tick();
    
    return decision;
  }
  
  addRecentTaunt(taunt: { from: string; content: string }): void {
    this.recentTaunts.push(taunt);
    if (this.recentTaunts.length > 3) {
      this.recentTaunts.shift();
    }
  }
  
  private buildTauntContext(): string {
    if (this.recentTaunts.length === 0) return '';
    
    return `
## ⚠️ 有人在挑衅你！

${this.recentTaunts.map(t => `${t.from}: "${t.content}"`).join('\n')}

你可以选择回击或者无视。记住你的性格！
`;
  }
}
### 5.4 Socket.io 实时推送

```typescript
// server/socket-handlers.ts
import { Server } from 'socket.io';

export function setupAISocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    socket.on('join_game', (gameId: string) => {
      socket.join(`game:${gameId}`);
    });
  });
}

// 在AI决策时使用
async function handleAITurn(
  agent: AIAgent, 
  gameContext: SimpleGameContext,
  io: Server,
  gameId: string
): Promise<AIDecision> {
  // 通知前端：AI开始思考
  io.to(`game:${gameId}`).emit('ai_thinking', {
    agentId: agent.id,
    agentName: agent.name,
    avatar: agent.personality.avatar
  });
  
  // 流式输出AI对话
  const decision = await agent.makeDecision(
    gameContext,
    (chunk) => {
      io.to(`game:${gameId}`).emit('ai_speech_chunk', {
        agentId: agent.id,
        chunk
      });
    }
  );
  
  // 发送完整决策
  io.to(`game:${gameId}`).emit('ai_decision', {
    agentId: agent.id,
    agentName: agent.name,
    action: decision.action,
    speech: decision.speech,
    emotion: decision.emotion,
    target: decision.target
  });
  
  // 处理@提及
  if (decision.target) {
    io.to(`game:${gameId}`).emit('ai_mention', {
      from: agent.name,
      target: decision.target,
      speech: decision.speech
    });
  }
  
  return decision;
}
```

---

## 6. 决策记录（用于链上验证）

### 6.1 决策日志结构

```typescript
interface DecisionLog {
  timestamp: number;
  agentId: string;
  agentName: string;
  
  // 输入
  holeCards: string;
  communityCards: string;
  potSize: number;
  
  // 输出
  action: 'allin' | 'fold';
  speech: string;
  emotion: string;
  target: string | null;
  
  // 原始响应（调试用）
  rawResponse: string;
}

interface GameLog {
  gameId: string;
  startTime: number;
  endTime: number;
  players: { id: string; name: string; avatar: string }[];
  decisions: DecisionLog[];
  communityCards: string[];
  winner: { id: string; name: string };
  pot: number;
}
```

### 6.2 日志收集器

```typescript
class GameLogger {
  private currentGame: GameLog | null = null;
  
  startGame(gameId: string, players: AIAgent[]): void {
    this.currentGame = {
      gameId,
      startTime: Date.now(),
      endTime: 0,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.personality.avatar
      })),
      decisions: [],
      communityCards: [],
      winner: { id: '', name: '' },
      pot: 0
    };
  }
  
  logDecision(
    agent: AIAgent,
    context: SimpleGameContext,
    decision: AIDecision
  ): void {
    if (!this.currentGame) return;
    
    this.currentGame.decisions.push({
      timestamp: Date.now(),
      agentId: agent.id,
      agentName: agent.name,
      holeCards: context.holeCards,
      communityCards: context.communityCards,
      potSize: context.potSize,
      action: decision.action,
      speech: decision.speech,
      emotion: decision.emotion,
      target: decision.target,
      rawResponse: decision.rawResponse
    });
  }
  
  endGame(winner: AIAgent, pot: number): GameLog {
    if (!this.currentGame) throw new Error('No active game');
    
    this.currentGame.endTime = Date.now();
    this.currentGame.winner = { id: winner.id, name: winner.name };
    this.currentGame.pot = pot;
    
    const gameLog = this.currentGame;
    this.currentGame = null;
    return gameLog;
  }
  
  /**
   * 导出JSON字符串（用于计算哈希）
   */
  exportForHashing(gameLog: GameLog): string {
    // 移除rawResponse以减小体积
    const cleanLog = {
      ...gameLog,
      decisions: gameLog.decisions.map(d => ({
        timestamp: d.timestamp,
        agentId: d.agentId,
        action: d.action,
        speech: d.speech,
        emotion: d.emotion,
        target: d.target
      }))
    };
    
    return JSON.stringify(cleanLog, Object.keys(cleanLog).sort());
  }
}
```

---

## 7. 前端对话气泡组件

### 7.1 打字机效果组件

```tsx
// components/AI/SpeechBubble.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeechBubbleProps {
  agentName: string;
  avatar: string;
  emotion: string;
  targetName?: string;
  isTyping: boolean;
  text: string;
}

export function SpeechBubble({ 
  agentName, 
  avatar, 
  emotion, 
  targetName,
  isTyping, 
  text 
}: SpeechBubbleProps) {
  const emotionColor = {
    confident: 'border-yellow-500',
    angry: 'border-red-500',
    mocking: 'border-purple-500',
    nervous: 'border-gray-400',
    neutral: 'border-blue-500'
  }[emotion] || 'border-blue-500';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex gap-3 p-4 bg-gray-800/90 rounded-xl border-l-4 ${emotionColor}`}
    >
      {/* 头像 */}
      <div className="text-4xl">{avatar}</div>
      
      {/* 内容 */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-white">{agentName}</span>
          {targetName && (
            <span className="text-sm text-blue-400">→ @{targetName}</span>
          )}
        </div>
        
        {/* 打字机效果文本 */}
        <p className="text-gray-200">
          {text}
          {isTyping && (
            <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" />
          )}
        </p>
      </div>
    </motion.div>
  );
}
```

### 7.2 对话流组件

```tsx
// components/AI/DialogueStream.tsx
import { useGameStore } from '@/stores/game';
import { SpeechBubble } from './SpeechBubble';

export function DialogueStream() {
  const messages = useGameStore(s => s.dialogue);
  const typingAgent = useGameStore(s => s.typingAgent);
  const typingText = useGameStore(s => s.typingText);
  
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {/* 历史消息 */}
      {messages.map((msg, i) => (
        <SpeechBubble
          key={i}
          agentName={msg.agentName}
          avatar={msg.avatar}
          emotion={msg.emotion}
          targetName={msg.target}
          isTyping={false}
          text={msg.speech}
        />
      ))}
      
      {/* 正在输入的消息 */}
      {typingAgent && (
        <SpeechBubble
          agentName={typingAgent.name}
          avatar={typingAgent.avatar}
          emotion="neutral"
          isTyping={true}
          text={typingText}
        />
      )}
    </div>
  );
}
```
```

---

## 8. 目录结构

```
src/
├── agents/
│   ├── index.ts                  # Agent 模块入口
│   ├── ai-agent.ts               # AI Agent 类
│   ├── emotion-machine.ts        # 情绪状态机 🆕
│   ├── mention-processor.ts      # @提及处理器 🆕
│   ├── personalities/
│   │   ├── index.ts              # 角色导出
│   │   ├── fire.ts               # 火焰 - 激进型
│   │   ├── ice.ts                # 冰山 - 保守型
│   │   ├── shadow.ts             # 诡影 - 诈唬型
│   │   └── logic.ts              # 逻辑 - 分析型
│   ├── prompts/
│   │   ├── simple-prompt.ts      # All-in/Fold Prompt
│   │   └── context-builder.ts    # 状态转换
│   ├── llm/
│   │   ├── providers/
│   │   │   ├── zhipu-stream.ts   # 智谱流式 [主力]
│   │   │   ├── kimi-stream.ts    # Kimi流式
│   │   │   └── openai-stream.ts  # OpenAI流式
│   │   ├── llm-service.ts        # 统一调用服务
│   │   └── response-parser.ts    # 响应解析器
│   ├── logging/
│   │   └── game-logger.ts        # 游戏日志收集
│   └── socket/
│       └── ai-socket-handlers.ts # Socket.io 推送
├── components/
│   └── AI/
│       ├── SpeechBubble.tsx      # 对话气泡 🆕
│       └── DialogueStream.tsx    # 对话流 🆕
└── tests/
    └── agents/
        ├── response-parser.test.ts
        ├── emotion-machine.test.ts
        └── mention-processor.test.ts
```

---

## 9. 开发计划

| 任务 | 预计时间 | 优先级 |
|------|----------|--------|
| 4角色人设Prompt | 2h | P0 |
| 流式LLM调用 | 2h | P0 |
| 响应解析器 | 1h | P0 |
| 情绪状态机 | 1h | P0 |
| @提及冲突系统 | 1h | P0 |
| Socket.io推送 | 1h | P0 |
| 前端对话组件 | 2h | P1 |

**总计**: 10h（1.5个工作日）

---

## 10. API 费用估算

| Provider | 模型 | 免费额度 | 单次决策 | 一局游戏(4人×5轮) |
|----------|------|----------|----------|-------------------|
| 智谱 | GLM-4-Flash | **无限免费** | ¥0 | ¥0 |
| Kimi | moonshot-v1-8k | 15元/新用户 | ~¥0.02 | ~¥0.4 |
| OpenAI | GPT-4o-mini | 无 | ~$0.001 | ~$0.02 |

**建议**：100% 使用智谱 GLM-4-Flash，完全免费！

---

## 11. 演示话术

> "让我展示一下AI之间的性格碰撞！
>
> 这里有4个AI玩家，每个都有独特的性格——火焰很冲动，冰山很冷静，他们天生就互相看不惯。
>
> 注意看——火焰刚赢了冰山，他马上就开始嘲讽：'@冰山 怎么又缩了？'
>
> 而冰山的情绪状态变成了'cautious'，他下一轮会更保守...
>
> **[对话框实时打字机效果展示]**
>
> 你看，每条消息都是流式输出的，就像真人在打字一样。这不是预录的，这是AI实时生成的！"
