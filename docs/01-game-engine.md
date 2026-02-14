# 模块一：德州扑克游戏引擎

## 1. 模块概述

游戏引擎是整个 PokerMind Arena 的核心基础，负责实现完整的德州扑克游戏逻辑。

### 1.1 核心职责
- 牌局状态管理（发牌、下注轮次、摊牌）
- 规则验证（合法操作检测、边池计算）
- 胜负判定（牌型比较、分池算法）
- 事件广播（状态变更通知）

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全、前后端同构 |
| 运行时 | Node.js | 异步处理、WebSocket 支持 |
| 状态管理 | 有限状态机 | 游戏阶段清晰、易于调试 |

---

## 2. 数据结构设计

### 2.1 核心类型定义

```typescript
// 扑克牌定义
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card {
  suit: Suit;
  rank: Rank;
}

// 玩家状态
interface Player {
  id: string;
  name: string;
  chips: number;          // 当前筹码
  holeCards: Card[];      // 手牌（2张）
  currentBet: number;     // 本轮已下注
  status: 'active' | 'folded' | 'all-in' | 'out';
  position: number;       // 座位位置
}

// 游戏阶段
type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

// 玩家动作
type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

interface PlayerAction {
  playerId: string;
  action: ActionType;
  amount?: number;        // raise/all-in 时的金额
  timestamp: number;
}

// 游戏状态
interface GameState {
  gameId: string;
  phase: GamePhase;
  players: Player[];
  communityCards: Card[]; // 公共牌（最多5张）
  pot: number;            // 主池
  sidePots: SidePot[];    // 边池
  currentBet: number;     // 当前最高下注
  dealerPosition: number; // 庄家位置
  activePlayerIndex: number;
  deck: Card[];           // 剩余牌组
  actionHistory: PlayerAction[];
  blinds: { small: number; big: number };
}

interface SidePot {
  amount: number;
  eligiblePlayers: string[];
}
```

### 2.2 牌型枚举与权重

```typescript
enum HandRank {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10
}

interface HandEvaluation {
  rank: HandRank;
  highCards: number[];    // 用于同级牌型比较
  description: string;    // "Full House, Kings over Jacks"
}
```

---

## 3. 状态机设计

### 3.1 游戏阶段流转

```
┌─────────┐
│ waiting │ ← 等待玩家加入
└────┬────┘
     │ 玩家数 >= 2
     ▼
┌─────────┐
│ preflop │ ← 发手牌，小盲/大盲下注
└────┬────┘
     │ 下注轮结束
     ▼
┌─────────┐
│  flop   │ ← 发3张公共牌
└────┬────┘
     │ 下注轮结束
     ▼
┌─────────┐
│  turn   │ ← 发第4张公共牌
└────┬────┘
     │ 下注轮结束
     ▼
┌─────────┐
│  river  │ ← 发第5张公共牌
└────┬────┘
     │ 下注轮结束
     ▼
┌──────────┐
│ showdown │ ← 摊牌比较
└────┬─────┘
     │ 结算完成
     ▼
┌─────────┐
│  ended  │ ← 一局结束
└─────────┘
```

### 3.2 状态机实现

```typescript
class PokerStateMachine {
  private state: GameState;
  
  constructor(config: GameConfig) {
    this.state = this.initializeGame(config);
  }
  
  // 状态转换
  transition(action: PlayerAction): GameState {
    this.validateAction(action);
    this.applyAction(action);
    
    if (this.isBettingRoundComplete()) {
      this.advancePhase();
    }
    
    return this.state;
  }
  
  private advancePhase() {
    const phaseOrder: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phaseOrder.indexOf(this.state.phase as any);
    
    if (this.getActivePlayers().length <= 1) {
      this.state.phase = 'showdown';
      return;
    }
    
    this.state.phase = phaseOrder[currentIndex + 1];
    this.dealCommunityCards();
    this.resetBettingRound();
  }
}
```

---

## 4. 核心算法实现

### 4.1 洗牌算法（Fisher-Yates）

```typescript
function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### 4.2 牌型评估算法

```typescript
class HandEvaluator {
  // 评估7张牌（2手牌 + 5公共牌）中最佳5张
  evaluate(cards: Card[]): HandEvaluation {
    const combinations = this.getCombinations(cards, 5);
    let bestHand: HandEvaluation | null = null;
    
    for (const combo of combinations) {
      const evaluation = this.evaluateFiveCards(combo);
      if (!bestHand || this.compareHands(evaluation, bestHand) > 0) {
        bestHand = evaluation;
      }
    }
    
    return bestHand!;
  }
  
  private evaluateFiveCards(cards: Card[]): HandEvaluation {
    // 检测顺序：皇家同花顺 → 同花顺 → 四条 → ... → 高牌
    if (this.isRoyalFlush(cards)) return { rank: HandRank.ROYAL_FLUSH, ... };
    if (this.isStraightFlush(cards)) return { rank: HandRank.STRAIGHT_FLUSH, ... };
    // ... 其他牌型检测
  }
  
  // 获取C(n,5)组合
  private getCombinations(cards: Card[], k: number): Card[][] {
    // 组合生成算法
  }
}
```

### 4.3 边池计算

```typescript
function calculateSidePots(players: Player[], totalPot: number): SidePot[] {
  const sidePots: SidePot[] = [];
  const allInAmounts = players
    .filter(p => p.status === 'all-in')
    .map(p => p.currentBet)
    .sort((a, b) => a - b);
  
  let processedAmount = 0;
  
  for (const amount of allInAmounts) {
    const contributingPlayers = players.filter(
      p => p.currentBet >= amount && p.status !== 'folded'
    );
    
    sidePots.push({
      amount: (amount - processedAmount) * contributingPlayers.length,
      eligiblePlayers: contributingPlayers.map(p => p.id)
    });
    
    processedAmount = amount;
  }
  
  return sidePots;
}
```

---

## 5. API 接口设计

### 5.1 游戏管理接口

```typescript
interface IGameEngine {
  // 创建新游戏
  createGame(config: GameConfig): string;
  
  // 玩家加入
  joinGame(gameId: string, player: PlayerInfo): boolean;
  
  // 开始游戏
  startGame(gameId: string): GameState;
  
  // 执行动作
  executeAction(gameId: string, action: PlayerAction): ActionResult;
  
  // 获取当前状态
  getGameState(gameId: string): GameState;
  
  // 获取玩家可用动作
  getAvailableActions(gameId: string, playerId: string): AvailableAction[];
}

interface ActionResult {
  success: boolean;
  newState: GameState;
  events: GameEvent[];
  error?: string;
}

interface GameEvent {
  type: 'action' | 'phase_change' | 'winner' | 'pot_update';
  data: any;
  timestamp: number;
}
```

### 5.2 事件系统

```typescript
class GameEventEmitter extends EventEmitter {
  // 订阅游戏事件
  onAction(callback: (action: PlayerAction) => void): void;
  onPhaseChange(callback: (phase: GamePhase) => void): void;
  onGameEnd(callback: (result: GameResult) => void): void;
  onStateUpdate(callback: (state: GameState) => void): void;
}
```

---

## 6. 目录结构

```
src/
├── engine/
│   ├── index.ts              # 引擎入口
│   ├── game-state.ts         # 游戏状态管理
│   ├── state-machine.ts      # 状态机实现
│   ├── rules/
│   │   ├── validator.ts      # 规则验证
│   │   ├── betting.ts        # 下注逻辑
│   │   └── showdown.ts       # 摊牌逻辑
│   ├── evaluator/
│   │   ├── hand-evaluator.ts # 牌型评估
│   │   └── comparator.ts     # 牌型比较
│   ├── utils/
│   │   ├── deck.ts           # 牌组操作
│   │   ├── shuffle.ts        # 洗牌算法
│   │   └── pot-calculator.ts # 底池计算
│   └── types/
│       └── index.ts          # 类型定义
└── tests/
    └── engine/
        ├── state-machine.test.ts
        ├── hand-evaluator.test.ts
        └── rules.test.ts
```

---

## 7. 测试用例设计

### 7.1 单元测试

```typescript
describe('HandEvaluator', () => {
  it('should detect royal flush correctly', () => {
    const cards = [
      { suit: 'hearts', rank: '10' },
      { suit: 'hearts', rank: 'J' },
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'hearts', rank: 'A' },
    ];
    const result = evaluator.evaluateFiveCards(cards);
    expect(result.rank).toBe(HandRank.ROYAL_FLUSH);
  });
  
  it('should compare two pair correctly', () => {
    // AA-KK vs AA-QQ
    const hand1 = evalutate([/* AA-KK */]);
    const hand2 = evalutate([/* AA-QQ */]);
    expect(comparator.compare(hand1, hand2)).toBeGreaterThan(0);
  });
});

describe('BettingRules', () => {
  it('should validate minimum raise', () => {
    const state = createGameState({ currentBet: 100, bigBlind: 50 });
    expect(validator.isValidRaise(150, state)).toBe(true);  // 最小加注
    expect(validator.isValidRaise(140, state)).toBe(false); // 加注不足
  });
});
```

### 7.2 集成测试

```typescript
describe('Full Game Flow', () => {
  it('should complete a 4-player game', async () => {
    const engine = new PokerEngine();
    const gameId = engine.createGame({ playerCount: 4, blinds: [10, 20] });
    
    // 模拟完整一局
    engine.startGame(gameId);
    
    // 验证阶段流转
    expect(engine.getGameState(gameId).phase).toBe('preflop');
    
    // 执行下注动作...
    // 验证最终结算
  });
});
```

---

## 8. 开发计划

| 任务 | 预计时间 | 优先级 |
|------|----------|--------|
| 数据结构定义 | 2h | P0 |
| 状态机框架 | 4h | P0 |
| 牌型评估算法 | 4h | P0 |
| 下注规则验证 | 3h | P0 |
| 边池计算 | 2h | P1 |
| 事件系统 | 2h | P1 |
| 单元测试 | 4h | P1 |
| 集成测试 | 2h | P2 |

**总计**: 约 23 小时（3个工作日）

---

## 9. 注意事项

1. **随机数安全**: 生产环境需使用密码学安全的随机数生成器
2. **状态不可变**: 每次状态变更返回新对象，便于历史追溯
3. **并发处理**: 同一时刻只能有一个玩家执行动作
4. **超时机制**: 玩家决策超时自动 fold/check
