# 模块一：德州扑克游戏引擎（最终版）

> **状态**: 最终版 v2.0 | **优先级**: P0 | **预计时间**: 8h

## 🎯 核心简化：All-in or Fold 模式

### 为什么简化？

| 原方案 | 问题 | 新方案 |
|--------|------|--------|
| 完整德州扑克规则 | 边池计算5-7天 | **All-in or Fold** |
| 自研牌型评估 | 容易有bug | **pokersolver 库** |
| 复杂下注轮次 | 每轮4-5种动作 | **只有2个选择** |

### All-in or Fold 规则

```
每轮只有两个选择：
├── All-in: 把全部筹码推进去
└── Fold: 弃牌认输

无边池计算！无复杂下注逻辑！
赢家拿走所有！
```

---

## 1. 模块概述

### 1.1 核心职责
- 管理简化版扑克牌局状态
- 使用 `pokersolver` 处理牌型比较
- 每轮只有 All-in / Fold 两个选择
- 广播游戏事件到前端

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全 |
| 牌型评估 | **pokersolver** | 生产级验证、零bug |
| 状态管理 | 简单状态机 | All-in/Fold极简 |
| 实时通信 | Socket.io | 双向推送 |

### 1.3 关键依赖

```bash
npm install pokersolver
# pokersolver 支持所有扑克牌型的比较和评估
```

---

## 2. 数据结构

### 2.1 核心类型

```typescript
// 扑克牌（pokersolver格式）
// 格式: "Ah" = A♥, "Kd" = K♦, "Qc" = Q♣, "Js" = J♠
type CardString = string;  // e.g., "Ah", "Kd", "10c", "2s"

// 玩家状态
interface Player {
  id: string;
  name: string;
  avatar: string;
  chips: number;              // 当前筹码
  holeCards: [CardString, CardString];  // 手牌
  status: 'active' | 'allin' | 'folded' | 'eliminated';
}

// 游戏阶段（简化版）
type GamePhase = 
  | 'waiting'      // 等待开始
  | 'preflop'      // 发手牌，第一轮决策
  | 'flop'         // 发3张公共牌
  | 'turn'         // 发第4张
  | 'river'        // 发第5张
  | 'showdown'     // 摊牌比较
  | 'ended';       // 游戏结束

// 玩家动作（极简版）
type ActionType = 'allin' | 'fold';

interface PlayerAction {
  playerId: string;
  action: ActionType;
  speech: string;       // AI说的话
  emotion: string;      // 情绪
  target?: string;      // @某人
  timestamp: number;
}

// 游戏状态
interface GameState {
  gameId: string;
  phase: GamePhase;
  round: number;            // 当前第几轮
  players: Player[];
  communityCards: CardString[];
  pot: number;              // 底池（所有人的筹码）
  activePlayerIndex: number;
  deck: CardString[];       // 剩余牌组
  actionHistory: PlayerAction[];
  winner?: Player;
}
```

### 2.2 牌组生成

```typescript
const SUITS = ['h', 'd', 'c', 's'];  // hearts, diamonds, clubs, spades
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): CardString[] {
  const deck: CardString[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(rank + suit);  // "Ah", "Kd", etc.
    }
  }
  return deck;
}

function shuffleDeck(deck: CardString[]): CardString[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

---

## 3. pokersolver 集成

### 3.1 使用 pokersolver 评估牌型

```typescript
import { Hand } from 'pokersolver';

/**
 * 评估7张牌的最佳牌型
 * @param holeCards 玩家手牌 ["Ah", "Kd"]
 * @param communityCards 公共牌 ["Jh", "10h", "9h", "8c", "2d"]
 * @returns pokersolver Hand 对象
 */
function evaluateHand(holeCards: CardString[], communityCards: CardString[]): Hand {
  const allCards = [...holeCards, ...communityCards];
  return Hand.solve(allCards);
}

/**
 * 比较多个玩家的牌型，返回赢家
 * @param players 参与摊牌的玩家
 * @param communityCards 公共牌
 * @returns 赢家数组（可能平局）
 */
function determineWinners(
  players: Player[],
  communityCards: CardString[]
): { player: Player; hand: Hand }[] {
  const hands = players.map(player => ({
    player,
    hand: evaluateHand(player.holeCards, communityCards)
  }));
  
  // 使用 pokersolver 的 winners 方法
  const winningHands = Hand.winners(hands.map(h => h.hand));
  
  return hands.filter(h => winningHands.includes(h.hand));
}
```

### 3.2 牌型描述

```typescript
function getHandDescription(hand: Hand): string {
  // pokersolver 自带 descr 属性
  return hand.descr;  // e.g., "Royal Flush", "Two Pair, K's & 9's"
}

function getHandRank(hand: Hand): string {
  return hand.name;   // e.g., "Royal Flush", "Straight Flush", "Four of a Kind"
}
```

---

## 4. 游戏引擎实现

### 4.1 核心引擎类

```typescript
import { EventEmitter } from 'events';
import { Hand } from 'pokersolver';

interface GameConfig {
  initialChips: number;       // 初始筹码（每人100）
  roundCount: number;         // 总轮数（5轮）
}

class PokerGameEngine extends EventEmitter {
  private state: GameState;
  private config: GameConfig;
  
  constructor(config: GameConfig = { initialChips: 100, roundCount: 5 }) {
    super();
    this.config = config;
    this.state = this.createInitialState();
  }
  
  private createInitialState(): GameState {
    return {
      gameId: this.generateGameId(),
      phase: 'waiting',
      round: 0,
      players: [],
      communityCards: [],
      pot: 0,
      activePlayerIndex: 0,
      deck: [],
      actionHistory: []
    };
  }
  
  /**
   * 添加AI玩家
   */
  addPlayer(player: Omit<Player, 'chips' | 'status' | 'holeCards'>): void {
    this.state.players.push({
      ...player,
      chips: this.config.initialChips,
      holeCards: ['', ''] as [CardString, CardString],
      status: 'active'
    });
    this.emit('player_joined', player);
  }
  
  /**
   * 开始新一轮
   */
  startRound(): void {
    this.state.round++;
    this.state.phase = 'preflop';
    
    // 重置存活玩家
    this.state.players.forEach(p => {
      if (p.chips > 0) {
        p.status = 'active';
      }
    });
    
    // 洗牌发牌
    this.state.deck = shuffleDeck(createDeck());
    this.dealHoleCards();
    
    // 收集底池（每人投入全部筹码的 20%，作为 ante）
    const ante = Math.ceil(this.config.initialChips * 0.2);
    this.state.pot = 0;
    this.state.players.forEach(p => {
      if (p.status === 'active') {
        const contribution = Math.min(ante, p.chips);
        p.chips -= contribution;
        this.state.pot += contribution;
      }
    });
    
    this.state.activePlayerIndex = 0;
    this.state.communityCards = [];
    this.state.actionHistory = [];
    
    this.emit('round_started', {
      round: this.state.round,
      pot: this.state.pot,
      players: this.state.players
    });
  }
  
  /**
   * 发手牌
   */
  private dealHoleCards(): void {
    const activePlayers = this.state.players.filter(p => p.status === 'active');
    
    for (const player of activePlayers) {
      player.holeCards = [
        this.state.deck.pop()!,
        this.state.deck.pop()!
      ] as [CardString, CardString];
    }
    
    this.emit('cards_dealt', {
      players: activePlayers.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.holeCards
      }))
    });
  }
  
  /**
   * 发公共牌
   */
  private dealCommunityCards(count: number): void {
    for (let i = 0; i < count; i++) {
      this.state.communityCards.push(this.state.deck.pop()!);
    }
    
    this.emit('community_cards', {
      phase: this.state.phase,
      cards: this.state.communityCards
    });
  }
  
  /**
   * 获取当前应该行动的玩家
   */
  getCurrentPlayer(): Player | null {
    const activePlayers = this.state.players.filter(
      p => p.status === 'active' && !this.hasActedThisPhase(p.id)
    );
    
    return activePlayers[0] || null;
  }
  
  private hasActedThisPhase(playerId: string): boolean {
    // 检查本阶段是否已行动
    const phaseActions = this.state.actionHistory.filter(
      a => a.playerId === playerId
    );
    // 简化：每个阶段只行动一次
    return phaseActions.length > 0;
  }
  
  /**
   * 执行玩家动作
   */
  executeAction(action: PlayerAction): void {
    const player = this.state.players.find(p => p.id === action.playerId);
    if (!player || player.status !== 'active') {
      throw new Error('Invalid player');
    }
    
    // 记录动作
    this.state.actionHistory.push(action);
    
    if (action.action === 'allin') {
      // All-in：把所有筹码投入
      this.state.pot += player.chips;
      player.chips = 0;
      player.status = 'allin';
      
      this.emit('player_allin', {
        player: player,
        pot: this.state.pot,
        speech: action.speech
      });
    } else {
      // Fold：弃牌
      player.status = 'folded';
      
      this.emit('player_fold', {
        player: player,
        speech: action.speech
      });
    }
    
    // 检查是否需要进入下一阶段
    this.checkPhaseCompletion();
  }
  
  /**
   * 检查阶段是否完成
   */
  private checkPhaseCompletion(): void {
    const activePlayers = this.state.players.filter(
      p => p.status === 'active' || p.status === 'allin'
    );
    
    // 只剩1人 → 直接获胜
    if (activePlayers.length === 1) {
      this.resolveWinner([activePlayers[0]]);
      return;
    }
    
    // 所有人都已行动 → 进入下一阶段
    const allActed = activePlayers.every(p => 
      p.status === 'allin' || 
      this.state.actionHistory.some(a => a.playerId === p.id)
    );
    
    if (allActed) {
      this.advancePhase();
    }
  }
  
  /**
   * 进入下一阶段
   */
  private advancePhase(): void {
    // 清空本轮行动记录
    this.state.actionHistory = [];
    
    switch (this.state.phase) {
      case 'preflop':
        this.state.phase = 'flop';
        this.dealCommunityCards(3);
        break;
      case 'flop':
        this.state.phase = 'turn';
        this.dealCommunityCards(1);
        break;
      case 'turn':
        this.state.phase = 'river';
        this.dealCommunityCards(1);
        break;
      case 'river':
        this.state.phase = 'showdown';
        this.showdown();
        break;
    }
    
    this.emit('phase_changed', { phase: this.state.phase });
  }
  
  /**
   * 摊牌
   */
  private showdown(): void {
    const contenders = this.state.players.filter(
      p => p.status === 'allin'
    );
    
    if (contenders.length === 0) {
      // 没人All-in，所有人都Fold
      const lastActive = this.state.players.find(p => p.status === 'active');
      if (lastActive) {
        this.resolveWinner([lastActive]);
      }
      return;
    }
    
    // 使用 pokersolver 比较
    const winners = determineWinners(contenders, this.state.communityCards);
    
    this.emit('showdown', {
      players: contenders.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.holeCards,
        hand: evaluateHand(p.holeCards, this.state.communityCards).descr
      })),
      communityCards: this.state.communityCards
    });
    
    this.resolveWinner(winners.map(w => w.player));
  }
  
  /**
   * 结算获胜者
   */
  private resolveWinner(winners: Player[]): void {
    const winAmount = Math.floor(this.state.pot / winners.length);
    
    winners.forEach(winner => {
      winner.chips += winAmount;
    });
    
    this.state.phase = 'ended';
    this.state.winner = winners[0];  // 主要赢家
    
    this.emit('round_ended', {
      winners: winners.map(w => ({
        id: w.id,
        name: w.name,
        avatar: w.avatar,
        winAmount
      })),
      pot: this.state.pot
    });
    
    // 检查游戏是否完全结束
    this.checkGameEnd();
  }
  
  /**
   * 检查游戏是否结束
   */
  private checkGameEnd(): void {
    const playersWithChips = this.state.players.filter(p => p.chips > 0);
    
    // 只剩1人有筹码，或者已达最大轮数
    if (playersWithChips.length === 1 || this.state.round >= this.config.roundCount) {
      const finalWinner = playersWithChips.reduce(
        (max, p) => p.chips > max.chips ? p : max
      );
      
      this.emit('game_ended', {
        winner: finalWinner,
        players: this.state.players,
        totalRounds: this.state.round
      });
    }
  }
  
  /**
   * 获取当前游戏状态
   */
  getState(): GameState {
    return { ...this.state };
  }
  
  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
```

---

## 5. Socket.io 集成

### 5.1 游戏房间管理

```typescript
// server/game-manager.ts
import { Server } from 'socket.io';

class GameRoomManager {
  private io: Server;
  private games: Map<string, PokerGameEngine> = new Map();
  
  constructor(io: Server) {
    this.io = io;
  }
  
  createGame(): string {
    const engine = new PokerGameEngine();
    const gameId = engine.getState().gameId;
    
    this.games.set(gameId, engine);
    this.setupEngineListeners(engine, gameId);
    
    return gameId;
  }
  
  private setupEngineListeners(engine: PokerGameEngine, gameId: string): void {
    // 转发所有事件到房间
    const events = [
      'player_joined',
      'round_started',
      'cards_dealt',
      'community_cards',
      'player_allin',
      'player_fold',
      'phase_changed',
      'showdown',
      'round_ended',
      'game_ended'
    ];
    
    events.forEach(event => {
      engine.on(event, (data) => {
        this.io.to(`game:${gameId}`).emit(event, data);
      });
    });
  }
  
  getEngine(gameId: string): PokerGameEngine | undefined {
    return this.games.get(gameId);
  }
}
```

### 5.2 Socket 事件处理

```typescript
// server/socket-handlers/game.ts
export function setupGameSocketHandlers(io: Server, gameManager: GameRoomManager) {
  io.on('connection', (socket) => {
    socket.on('join_game', (gameId: string) => {
      socket.join(`game:${gameId}`);
      
      const engine = gameManager.getEngine(gameId);
      if (engine) {
        socket.emit('game_state', engine.getState());
      }
    });
    
    socket.on('start_game', (gameId: string) => {
      const engine = gameManager.getEngine(gameId);
      if (engine) {
        engine.startRound();
      }
    });
    
    // AI动作由服务器自动处理，不需要客户端触发
  });
}
```

---

## 6. 牌面格式转换

```typescript
/**
 * 将 pokersolver 格式转换为显示格式
 * "Ah" → "A♥"
 * "10c" → "10♣"
 */
function formatCardForDisplay(card: CardString): string {
  const suitMap: Record<string, string> = {
    'h': '♥',
    'd': '♦',
    'c': '♣',
    's': '♠'
  };
  
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  
  return rank + suitMap[suit];
}

/**
 * 批量转换
 */
function formatCardsForDisplay(cards: CardString[]): string[] {
  return cards.map(formatCardForDisplay);
}
```

---

## 7. 目录结构

```
src/
├── engine/
│   ├── index.ts                  # 引擎入口
│   ├── poker-engine.ts           # 游戏引擎类
│   ├── deck.ts                   # 牌组管理
│   ├── evaluator.ts              # pokersolver 封装
│   └── types.ts                  # 类型定义
├── server/
│   ├── game-manager.ts           # 游戏房间管理
│   └── socket-handlers/
│       └── game.ts               # 游戏Socket处理
└── utils/
    └── card-format.ts            # 牌面格式转换
```

---

## 8. 开发计划

| 任务 | 时间 | 优先级 |
|------|------|--------|
| 安装 pokersolver + 类型 | 0.5h | P0 |
| Deck 牌组管理 | 1h | P0 |
| PokerGameEngine 核心 | 3h | P0 |
| pokersolver 集成 | 1h | P0 |
| Socket.io 事件 | 1.5h | P0 |
| 测试 + 调试 | 1h | P0 |

**总计**: 8h

---

## 9. pokersolver 使用示例

```typescript
import { Hand } from 'pokersolver';

// 示例：评估一手牌
const holeCards = ['Ah', 'Kh'];
const community = ['Jh', '10h', '9h', '8c', '2d'];

const hand = Hand.solve([...holeCards, ...community]);
console.log(hand.name);    // "Flush"
console.log(hand.descr);   // "Flush, A High"

// 示例：比较两手牌
const hand1 = Hand.solve(['Ah', 'Kh', 'Jh', '10h', '9h']);
const hand2 = Hand.solve(['Ks', 'Ks', 'Kd', 'Qh', 'Qd']);

const winners = Hand.winners([hand1, hand2]);
console.log(winners[0] === hand1);  // true (Flush 大于 Full House? 错，Full House 更大)
// 实际：Full House > Flush，所以 hand2 赢
```

---

## 10. 演示话术

> "游戏引擎使用了'All-in or Fold'简化规则——每轮每个AI只有两个选择：全押或弃牌。
>
> 这不是偷懒，而是设计选择！这让比赛更加戏剧化，每个决策都是生死抉择。
>
> 牌型评估我们用的是 pokersolver 库——这是一个经过验证的生产级库，能正确处理所有牌型比较。
>
> **[展示摊牌画面]**
>
> 你看，火焰拿着 A♥ K♥，配合公共牌组成了同花。冰山是一对Q...
>
> pokersolver 自动判定火焰获胜！"
