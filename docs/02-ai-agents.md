# 模块二：AI 智能体决策系统

## 1. 模块概述

AI 智能体模块是 PokerMind Arena 的核心创新点，通过 LLM 驱动的多风格 AI 玩家，实现具有"人类思维"特征的扑克对战。

### 1.1 核心职责
- 管理多个具有不同性格的 AI 玩家
- 将游戏状态转换为 LLM 可理解的 Prompt
- 解析 LLM 输出为合法游戏动作
- 记录 AI 决策过程（用于展示和验证）

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| LLM API | Kimi / 智谱 GLM-4 | 免费额度、中文理解好 |
| 备选方案 | OpenAI GPT-4o-mini | 成本低、响应快 |
| Prompt 框架 | 结构化 JSON | 便于解析、减少幻觉 |

---

## 2. AI 角色设计

### 2.1 角色类型定义

```typescript
interface AIPersonality {
  id: string;
  name: string;
  avatar: string;
  style: PlayStyle;
  traits: PersonalityTraits;
  systemPrompt: string;
}

type PlayStyle = 'aggressive' | 'conservative' | 'bluffer' | 'analytical' | 'unpredictable';

interface PersonalityTraits {
  riskTolerance: number;    // 0-1, 风险承受度
  bluffFrequency: number;   // 0-1, 诈唬频率
  patientLevel: number;     // 0-1, 耐心程度
  emotionalStability: number; // 0-1, 情绪稳定性
}
```

### 2.2 预设角色库

| 角色名 | 风格 | 特点描述 | 典型行为 |
|--------|------|----------|----------|
| 🔥 火焰王者 | aggressive | 激进型，喜欢大额加注 | 频繁 raise, 压迫对手 |
| 🧊 冰山守护 | conservative | 保守型，只玩强牌 | 紧手，等待好牌出击 |
| 🎭 诡谲面具 | bluffer | 诈唬型，喜欢虚张声势 | 常用 bluff，心理战 |
| 🧠 逻辑大师 | analytical | 分析型，概率计算派 | 基于赔率决策 |
| 🎲 混沌骰子 | unpredictable | 不可预测型 | 随机风格切换 |

### 2.3 角色 System Prompt 示例

```typescript
const AGGRESSIVE_PERSONA = `
你是一名德州扑克玩家，代号"火焰王者"。你的性格特点：
- 极度自信，相信进攻就是最好的防守
- 喜欢通过大额加注给对手施压
- 即使牌力一般也敢于半诈唬
- 讨厌被动跟注，认为这是软弱的表现
- 座右铭："要么大赢，要么大输"

决策原则：
1. 有位置优势时更激进
2. 筹码深时寻求大底池
3. 对弱势玩家持续施压
4. 关键位置不惧全押
`;

const CONSERVATIVE_PERSONA = `
你是一名德州扑克玩家，代号"冰山守护"。你的性格特点：
- 极度耐心，只玩前10%的起手牌
- 相信长期价值，不追求短期刺激
- 宁愿错过机会也不愿犯错
- 善于识别陷阱，避免被诈唬
- 座右铭："等待是最强的武器"

决策原则：
1. 位置不好时绝大多数手牌弃掉
2. 只在牌力足够时投入筹码
3. 设置止损线，及时止损
4. 对激进玩家保持警惕
`;
```

---

## 3. Prompt 工程

### 3.1 游戏状态 Prompt 模板

```typescript
interface GameContext {
  position: string;         // "BTN" | "SB" | "BB" | "UTG" | ...
  holeCards: string;        // "A♠ K♥"
  communityCards: string;   // "J♠ 10♥ 9♣ | - | -"
  potSize: number;
  stackSizes: Record<string, number>;
  currentBet: number;
  actionHistory: string[];
  phase: string;
}

function buildDecisionPrompt(context: GameContext, personality: AIPersonality): string {
  return `
## 当前牌局状态

### 基本信息
- 你的位置: ${context.position}
- 你的手牌: ${context.holeCards}
- 公共牌: ${context.communityCards}
- 当前阶段: ${context.phase}

### 筹码情况
- 底池大小: ${context.potSize}
- 当前下注: ${context.currentBet}
- 各玩家筹码:
${Object.entries(context.stackSizes).map(([name, chips]) => `  - ${name}: ${chips}`).join('\n')}

### 本轮行动历史
${context.actionHistory.map((a, i) => `${i + 1}. ${a}`).join('\n')}

---

## 请做出决策

请根据你的性格特点和当前牌局，选择以下行动之一：

你必须以 JSON 格式返回决策：
\`\`\`json
{
  "action": "fold" | "check" | "call" | "raise" | "all-in",
  "amount": <加注金额，仅 raise 时需要>,
  "reasoning": "<简短的决策理由，50字以内>",
  "confidence": <0-100 的信心分数>,
  "read": "<对对手的判读，30字以内>"
}
\`\`\`

注意：
- 只返回 JSON，不要有其他内容
- amount 必须是合法金额（最小加注 = 上次加注额 或 大盲）
- reasoning 要体现你的性格特点
`;
}
```

### 3.2 响应解析

```typescript
interface AIDecision {
  action: ActionType;
  amount?: number;
  reasoning: string;
  confidence: number;
  read: string;
  rawResponse: string;  // 原始响应，用于调试
  parseSuccess: boolean;
}

class ResponseParser {
  parse(response: string): AIDecision {
    try {
      // 提取 JSON 块
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
      if (!jsonMatch) {
        return this.fallbackParse(response);
      }
      
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        action: this.normalizeAction(parsed.action),
        amount: parsed.amount,
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 50,
        read: parsed.read || '',
        rawResponse: response,
        parseSuccess: true
      };
    } catch (error) {
      return this.fallbackParse(response);
    }
  }
  
  // 容错解析：从自然语言中提取动作
  private fallbackParse(response: string): AIDecision {
    const actionPatterns = {
      fold: /弃牌|fold/i,
      call: /跟注|call/i,
      raise: /加注|raise|(\d+)/i,
      check: /过牌|check/i,
      'all-in': /全押|all.?in/i
    };
    
    for (const [action, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(response)) {
        return {
          action: action as ActionType,
          reasoning: 'Parsed from natural language',
          confidence: 30,
          read: '',
          rawResponse: response,
          parseSuccess: false
        };
      }
    }
    
    // 默认安全动作
    return {
      action: 'check',
      reasoning: 'Parse failed, defaulting to check',
      confidence: 0,
      read: '',
      rawResponse: response,
      parseSuccess: false
    };
  }
}
```

---

## 4. LLM 调用层

### 4.1 统一接口定义

```typescript
interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  getTokenCount(text: string): number;
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

### 4.2 Kimi API 实现

```typescript
class KimiProvider implements LLMProvider {
  name = 'Kimi';
  private apiKey: string;
  private baseUrl = 'https://api.moonshot.cn/v1';
  
  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 500
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

### 4.3 智谱 GLM-4 实现

```typescript
class ZhipuProvider implements LLMProvider {
  name = 'Zhipu';
  private apiKey: string;
  private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
  
  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',  // 免费模型
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 500
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

### 4.4 Provider 管理与降级

```typescript
class LLMService {
  private providers: LLMProvider[];
  private currentIndex = 0;
  
  constructor(providers: LLMProvider[]) {
    this.providers = providers;
  }
  
  async getDecision(
    context: GameContext, 
    personality: AIPersonality
  ): Promise<AIDecision> {
    const messages: ChatMessage[] = [
      { role: 'system', content: personality.systemPrompt },
      { role: 'user', content: buildDecisionPrompt(context, personality) }
    ];
    
    // 尝试主 Provider
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[(this.currentIndex + i) % this.providers.length];
      
      try {
        const response = await provider.chat(messages, {
          temperature: this.getTemperature(personality),
          timeout: 10000
        });
        
        return new ResponseParser().parse(response);
      } catch (error) {
        console.warn(`Provider ${provider.name} failed, trying next...`);
      }
    }
    
    // 所有 Provider 失败，返回保守默认动作
    return this.getDefaultDecision(context);
  }
  
  private getTemperature(personality: AIPersonality): number {
    // 不可预测型用更高温度
    return personality.style === 'unpredictable' ? 0.9 : 0.7;
  }
}
```

---

## 5. AI Agent 管理器

### 5.1 Agent 生命周期

```typescript
class AIAgent {
  readonly id: string;
  readonly personality: AIPersonality;
  private conversationHistory: ChatMessage[] = [];
  private llmService: LLMService;
  
  // 记忆系统：记住本局关键信息
  private memory: AgentMemory = {
    opponentTendencies: {},  // 对手行为倾向
    significantHands: [],     // 重要手牌记录
    currentMood: 'neutral'    // 当前情绪状态
  };
  
  async makeDecision(gameState: GameState): Promise<AIDecision> {
    const context = this.buildContext(gameState);
    
    // 添加记忆上下文
    const enrichedPersonality = this.enrichWithMemory(this.personality);
    
    const decision = await this.llmService.getDecision(context, enrichedPersonality);
    
    // 更新记忆
    this.updateMemory(gameState, decision);
    
    return decision;
  }
  
  private updateMemory(state: GameState, decision: AIDecision): void {
    // 更新对手倾向判断
    // 记录关键决策
    // 根据结果调整情绪状态
  }
}

interface AgentMemory {
  opponentTendencies: Record<string, {
    aggression: number;
    bluffLikelihood: number;
  }>;
  significantHands: {
    hand: string;
    outcome: 'won' | 'lost';
    chipDelta: number;
  }[];
  currentMood: 'tilt' | 'confident' | 'cautious' | 'neutral';
}
```

### 5.2 Agent Pool 管理

```typescript
class AIAgentPool {
  private agents: Map<string, AIAgent> = new Map();
  private availablePersonalities: AIPersonality[];
  
  // 创建新 Agent
  createAgent(style?: PlayStyle): AIAgent {
    const personality = style 
      ? this.getPersonalityByStyle(style)
      : this.getRandomPersonality();
    
    const agent = new AIAgent(uuidv4(), personality, this.llmService);
    this.agents.set(agent.id, agent);
    return agent;
  }
  
  // 批量创建（用于一局游戏）
  createAgentsForGame(count: number): AIAgent[] {
    const styles: PlayStyle[] = ['aggressive', 'conservative', 'bluffer', 'analytical'];
    const selectedStyles = this.selectDiverseStyles(count, styles);
    
    return selectedStyles.map(style => this.createAgent(style));
  }
  
  // 确保风格多样性
  private selectDiverseStyles(count: number, styles: PlayStyle[]): PlayStyle[] {
    if (count >= styles.length) {
      return [...styles, ...this.selectDiverseStyles(count - styles.length, styles)];
    }
    return this.shuffleArray(styles).slice(0, count);
  }
}
```

---

## 6. 决策记录与可追溯性

### 6.1 决策日志结构

```typescript
interface DecisionLog {
  gameId: string;
  agentId: string;
  roundNumber: number;
  timestamp: number;
  
  // 输入
  gameState: GameState;
  prompt: string;
  
  // 输出
  rawResponse: string;
  parsedDecision: AIDecision;
  
  // 元数据
  llmProvider: string;
  latencyMs: number;
  tokenCount: {
    input: number;
    output: number;
  };
  
  // 哈希（用于链上验证）
  hash: string;
}

class DecisionLogger {
  private logs: DecisionLog[] = [];
  
  log(decision: DecisionLog): void {
    decision.hash = this.computeHash(decision);
    this.logs.push(decision);
    
    // 持久化到数据库
    this.persistToDatabase(decision);
  }
  
  private computeHash(log: DecisionLog): string {
    const payload = JSON.stringify({
      gameState: log.gameState,
      decision: log.parsedDecision,
      timestamp: log.timestamp
    });
    return sha256(payload);
  }
}
```

---

## 7. 性能优化

### 7.1 请求池控制

```typescript
class RequestThrottler {
  private queue: (() => Promise<any>)[] = [];
  private processing = 0;
  private maxConcurrent = 2;  // 避免 API 限流
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.processing < this.maxConcurrent) {
      this.processing++;
      const task = this.queue.shift()!;
      await task();
      this.processing--;
      this.processQueue();
    }
  }
}
```

### 7.2 响应缓存（相似局面）

```typescript
class DecisionCache {
  private cache = new LRUCache<string, AIDecision>({ max: 1000 });
  
  getCacheKey(context: GameContext, personality: AIPersonality): string {
    // 简化状态以提高缓存命中
    return hash({
      holeCards: context.holeCards,
      communityCards: context.communityCards,
      potOdds: Math.round(context.potSize / context.currentBet),
      style: personality.style
    });
  }
  
  // 相似局面可复用决策（加一定随机性）
  getCachedDecision(key: string): AIDecision | null {
    const cached = this.cache.get(key);
    if (cached && Math.random() > 0.3) {  // 70% 复用
      return cached;
    }
    return null;
  }
}
```

---

## 8. 目录结构

```
src/
├── agents/
│   ├── index.ts                  # Agent 模块入口
│   ├── ai-agent.ts               # AI Agent 类
│   ├── agent-pool.ts             # Agent 池管理
│   ├── personalities/
│   │   ├── index.ts              # 角色导出
│   │   ├── aggressive.ts         # 激进型
│   │   ├── conservative.ts       # 保守型
│   │   ├── bluffer.ts            # 诈唬型
│   │   └── analytical.ts         # 分析型
│   ├── prompts/
│   │   ├── decision-prompt.ts    # 决策 Prompt 模板
│   │   └── context-builder.ts    # 状态转换
│   ├── llm/
│   │   ├── providers/
│   │   │   ├── kimi.ts           # Kimi 实现
│   │   │   ├── zhipu.ts          # 智谱实现
│   │   │   └── openai.ts         # OpenAI 实现
│   │   ├── llm-service.ts        # 统一调用服务
│   │   └── response-parser.ts    # 响应解析器
│   ├── memory/
│   │   └── agent-memory.ts       # Agent 记忆系统
│   └── logging/
│       └── decision-logger.ts    # 决策日志
└── tests/
    └── agents/
        ├── response-parser.test.ts
        └── agent-decision.test.ts
```

---

## 9. 开发计划

| 任务 | 预计时间 | 优先级 |
|------|----------|--------|
| 角色人设设计 | 2h | P0 |
| Prompt 模板开发 | 3h | P0 |
| LLM Provider 实现 | 3h | P0 |
| 响应解析器 | 2h | P0 |
| Agent 类实现 | 3h | P0 |
| 决策日志系统 | 2h | P1 |
| 记忆系统 | 3h | P2 |
| 缓存优化 | 2h | P2 |

**总计**: 约 20 小时（2.5个工作日）

---

## 10. API 费用估算

| Provider | 模型 | 输入费用 | 输出费用 | 单次决策成本 |
|----------|------|----------|----------|--------------|
| 智谱 | GLM-4-Flash | 免费 | 免费 | ¥0 |
| Kimi | moonshot-v1-8k | ¥0.012/1K | ¥0.012/1K | ~¥0.02 |
| OpenAI | GPT-4o-mini | $0.15/1M | $0.60/1M | ~$0.001 |

**一局游戏（4人 × 20轮决策）**：
- 智谱方案：¥0
- Kimi方案：约 ¥1.6
- OpenAI方案：约 $0.08

建议：优先使用智谱免费额度进行开发和演示。
