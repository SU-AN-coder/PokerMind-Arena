# 模块四：预测市场系统

## 1. 模块概述

预测市场模块允许观众对 AI 扑克对战结果进行预测和竞猜，通过 Arcade Token 机制实现免 Gas 的参与体验。

### 1.1 核心职责
- 管理预测市场的创建与结算
- 计算动态赔率
- 处理用户投注与结算
- Arcade Token 的发放与消耗

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| 后端框架 | Node.js + Fastify | 高性能、低开销 |
| 实时通信 | Socket.io | 双向实时更新 |
| Token 管理 | Redis + PostgreSQL | 高并发 + 持久化 |
| 赔率计算 | 内存计算 | 毫秒级响应 |

### 1.3 设计原则
- **免 Gas 体验**：链下积分系统，链上可选结算
- **动态赔率**：根据投注分布实时调整
- **公平性**：游戏开始后锁定投注，结果由链上数据决定

---

## 2. 市场类型设计

### 2.1 市场类型枚举

```typescript
enum MarketType {
  // 游戏级别市场
  GAME_WINNER = 'game_winner',           // 谁会赢得本局
  FIRST_ELIMINATION = 'first_out',        // 谁先被淘汰
  LAST_SURVIVOR = 'last_survivor',        // 最后存活者
  
  // 阶段级别市场
  ROUND_WINNER = 'round_winner',          // 本回合谁赢
  BIGGEST_POT = 'biggest_pot',            // 最大底池出现在哪个阶段
  
  // 行为预测市场
  WILL_BLUFF = 'will_bluff',              // 某 AI 会诈唬吗
  WILL_ALL_IN = 'will_all_in',            // 本局会有全押吗
  SHOWDOWN_COUNT = 'showdown_count',      // 摊牌次数预测
}
```

### 2.2 市场数据结构

```typescript
interface PredictionMarket {
  id: string;
  gameId: string;
  type: MarketType;
  question: string;                // "谁会赢得本局比赛？"
  options: MarketOption[];
  status: MarketStatus;
  
  totalPool: number;               // 总投注池
  createdAt: number;
  closesAt: number;                // 投注截止时间
  resolvedAt?: number;
  result?: string;                 // 结果选项 ID
}

interface MarketOption {
  id: string;
  label: string;                   // "🔥 火焰王者"
  totalBets: number;               // 该选项总投注
  odds: number;                    // 当前赔率
  betCount: number;                // 投注人数
}

enum MarketStatus {
  OPEN = 'open',                   // 接受投注
  LOCKED = 'locked',               // 游戏进行中，停止投注
  RESOLVED = 'resolved',           // 已结算
  CANCELLED = 'cancelled'          // 已取消
}
```

---

## 3. Arcade Token 系统

### 3.1 Token 设计

```typescript
interface ArcadeToken {
  symbol: string;                  // "CHIP"
  name: string;                    // "Arena Chip"
  decimals: number;                // 0 (整数)
  
  // 获取方式
  dailyFreeAmount: number;         // 每日免费领取量: 100
  watchBonusAmount: number;        // 观看完整比赛奖励: 10
  correctPredictionMultiplier: number; // 预测正确额外奖励倍数: 1.1x
}

interface UserTokenAccount {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastDailyClaim: number;          // 上次领取每日奖励时间
  
  // 可选链上绑定
  walletAddress?: string;
  onChainBalance?: number;
}
```

### 3.2 Token 服务实现

```typescript
class ArcadeTokenService {
  private redis: Redis;
  private db: PostgresPool;
  
  // ============ 余额操作 ============
  
  async getBalance(userId: string): Promise<number> {
    const cached = await this.redis.get(`balance:${userId}`);
    if (cached !== null) return parseInt(cached);
    
    const result = await this.db.query(
      'SELECT balance FROM user_tokens WHERE user_id = $1',
      [userId]
    );
    const balance = result.rows[0]?.balance || 0;
    await this.redis.setex(`balance:${userId}`, 300, balance.toString());
    return balance;
  }
  
  async addTokens(userId: string, amount: number, reason: string): Promise<number> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO user_tokens (user_id, balance, total_earned)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id) 
         DO UPDATE SET balance = user_tokens.balance + $2,
                       total_earned = user_tokens.total_earned + $2
         RETURNING balance`,
        [userId, amount]
      );
      
      await client.query(
        `INSERT INTO token_transactions (user_id, amount, type, reason, created_at)
         VALUES ($1, $2, 'credit', $3, NOW())`,
        [userId, amount, reason]
      );
      
      await client.query('COMMIT');
      
      const newBalance = result.rows[0].balance;
      await this.redis.set(`balance:${userId}`, newBalance.toString());
      return newBalance;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  
  async deductTokens(userId: string, amount: number, reason: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE user_tokens 
         SET balance = balance - $2, total_spent = total_spent + $2
         WHERE user_id = $1 AND balance >= $2
         RETURNING balance`,
        [userId, amount]
      );
      
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      await client.query(
        `INSERT INTO token_transactions (user_id, amount, type, reason, created_at)
         VALUES ($1, $2, 'debit', $3, NOW())`,
        [userId, amount, reason]
      );
      
      await client.query('COMMIT');
      
      await this.redis.set(`balance:${userId}`, result.rows[0].balance.toString());
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  
  // ============ 每日奖励 ============
  
  async claimDailyReward(userId: string): Promise<ClaimResult> {
    const lastClaim = await this.redis.get(`daily:${userId}`);
    const today = new Date().toDateString();
    
    if (lastClaim === today) {
      return { success: false, reason: 'Already claimed today' };
    }
    
    const newBalance = await this.addTokens(userId, 100, 'daily_reward');
    await this.redis.setex(`daily:${userId}`, 86400, today);
    
    return { success: true, amount: 100, newBalance };
  }
}
```

---

## 4. 赔率计算系统

### 4.1 赔率算法

```typescript
class OddsCalculator {
  private readonly HOUSE_EDGE = 0.05;  // 5% 平台抽成
  private readonly MIN_ODDS = 1.01;     // 最低赔率
  private readonly MAX_ODDS = 100;      // 最高赔率
  
  /**
   * 基于投注分布计算赔率 (Pari-mutuel 模式)
   */
  calculateOdds(market: PredictionMarket): Map<string, number> {
    const totalPool = market.totalPool * (1 - this.HOUSE_EDGE);
    const odds = new Map<string, number>();
    
    for (const option of market.options) {
      if (option.totalBets === 0) {
        odds.set(option.id, this.MAX_ODDS);
      } else {
        const rawOdds = totalPool / option.totalBets;
        const clampedOdds = Math.max(this.MIN_ODDS, Math.min(this.MAX_ODDS, rawOdds));
        odds.set(option.id, Math.round(clampedOdds * 100) / 100);
      }
    }
    
    return odds;
  }
  
  /**
   * 计算隐含概率
   */
  calculateImpliedProbability(odds: number): number {
    return 1 / odds;
  }
  
  /**
   * 预估回报
   */
  estimatePayout(betAmount: number, odds: number): number {
    return betAmount * odds;
  }
  
  /**
   * 模拟新投注后的赔率变化
   */
  simulateOddsAfterBet(
    market: PredictionMarket,
    optionId: string,
    betAmount: number
  ): Map<string, number> {
    // 创建模拟市场
    const simMarket = JSON.parse(JSON.stringify(market));
    simMarket.totalPool += betAmount;
    
    const option = simMarket.options.find((o: any) => o.id === optionId);
    if (option) option.totalBets += betAmount;
    
    return this.calculateOdds(simMarket);
  }
}
```

### 4.2 赔率实时更新

```typescript
class OddsUpdateService {
  private io: Server;
  private calculator: OddsCalculator;
  
  constructor(io: Server) {
    this.io = io;
    this.calculator = new OddsCalculator();
  }
  
  /**
   * 广播赔率更新
   */
  broadcastOddsUpdate(market: PredictionMarket): void {
    const odds = this.calculator.calculateOdds(market);
    
    const update: OddsUpdate = {
      marketId: market.id,
      timestamp: Date.now(),
      options: market.options.map(opt => ({
        id: opt.id,
        label: opt.label,
        odds: odds.get(opt.id)!,
        totalBets: opt.totalBets,
        betCount: opt.betCount,
        impliedProbability: this.calculator.calculateImpliedProbability(odds.get(opt.id)!)
      })),
      totalPool: market.totalPool
    };
    
    this.io.to(`market:${market.id}`).emit('odds_update', update);
  }
}

interface OddsUpdate {
  marketId: string;
  timestamp: number;
  options: {
    id: string;
    label: string;
    odds: number;
    totalBets: number;
    betCount: number;
    impliedProbability: number;
  }[];
  totalPool: number;
}
```

---

## 5. 投注与结算服务

### 5.1 投注服务

```typescript
interface PlaceBetRequest {
  userId: string;
  marketId: string;
  optionId: string;
  amount: number;
}

interface BetResult {
  success: boolean;
  betId?: string;
  lockedOdds?: number;
  potentialPayout?: number;
  error?: string;
}

class BettingService {
  private tokenService: ArcadeTokenService;
  private marketRepo: MarketRepository;
  private betRepo: BetRepository;
  private oddsService: OddsUpdateService;
  
  async placeBet(request: PlaceBetRequest): Promise<BetResult> {
    // 1. 验证市场状态
    const market = await this.marketRepo.getById(request.marketId);
    if (!market) return { success: false, error: 'Market not found' };
    if (market.status !== MarketStatus.OPEN) {
      return { success: false, error: 'Market is closed for betting' };
    }
    
    // 2. 验证选项
    const option = market.options.find(o => o.id === request.optionId);
    if (!option) return { success: false, error: 'Invalid option' };
    
    // 3. 验证并扣除余额
    const deducted = await this.tokenService.deductTokens(
      request.userId,
      request.amount,
      `bet_${request.marketId}`
    );
    if (!deducted) return { success: false, error: 'Insufficient balance' };
    
    // 4. 计算当前赔率
    const currentOdds = new OddsCalculator().calculateOdds(market);
    const lockedOdds = currentOdds.get(request.optionId)!;
    
    // 5. 创建投注记录
    const bet: Bet = {
      id: uuidv4(),
      userId: request.userId,
      marketId: request.marketId,
      optionId: request.optionId,
      amount: request.amount,
      lockedOdds,
      potentialPayout: request.amount * lockedOdds,
      status: 'pending',
      createdAt: Date.now()
    };
    
    await this.betRepo.create(bet);
    
    // 6. 更新市场统计
    await this.marketRepo.addBet(request.marketId, request.optionId, request.amount);
    
    // 7. 广播赔率更新
    const updatedMarket = await this.marketRepo.getById(request.marketId);
    this.oddsService.broadcastOddsUpdate(updatedMarket!);
    
    return {
      success: true,
      betId: bet.id,
      lockedOdds,
      potentialPayout: bet.potentialPayout
    };
  }
  
  async cancelBet(betId: string, userId: string): Promise<boolean> {
    const bet = await this.betRepo.getById(betId);
    if (!bet || bet.userId !== userId || bet.status !== 'pending') {
      return false;
    }
    
    const market = await this.marketRepo.getById(bet.marketId);
    if (market?.status !== MarketStatus.OPEN) {
      return false; // 市场已锁定，不能取消
    }
    
    // 退还 Token
    await this.tokenService.addTokens(userId, bet.amount, `refund_${betId}`);
    await this.betRepo.updateStatus(betId, 'cancelled');
    await this.marketRepo.removeBet(bet.marketId, bet.optionId, bet.amount);
    
    return true;
  }
}

interface Bet {
  id: string;
  userId: string;
  marketId: string;
  optionId: string;
  amount: number;
  lockedOdds: number;
  potentialPayout: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled' | 'refunded';
  createdAt: number;
  settledAt?: number;
  payout?: number;
}
```

### 5.2 结算服务

```typescript
class SettlementService {
  private tokenService: ArcadeTokenService;
  private marketRepo: MarketRepository;
  private betRepo: BetRepository;
  
  /**
   * 结算市场
   */
  async settleMarket(marketId: string, winningOptionId: string): Promise<SettlementReport> {
    const market = await this.marketRepo.getById(marketId);
    if (!market || market.status === MarketStatus.RESOLVED) {
      throw new Error('Invalid market or already resolved');
    }
    
    // 1. 锁定市场
    await this.marketRepo.updateStatus(marketId, MarketStatus.RESOLVED);
    await this.marketRepo.setResult(marketId, winningOptionId);
    
    // 2. 获取所有投注
    const allBets = await this.betRepo.getByMarketId(marketId);
    
    // 3. 分批处理结算
    const report: SettlementReport = {
      marketId,
      winningOption: winningOptionId,
      totalBets: allBets.length,
      totalPool: market.totalPool,
      winnersCount: 0,
      totalPayout: 0,
      houseTake: 0
    };
    
    for (const bet of allBets) {
      if (bet.optionId === winningOptionId) {
        // 赢家
        const payout = bet.potentialPayout;
        await this.tokenService.addTokens(
          bet.userId,
          payout,
          `win_${marketId}`
        );
        await this.betRepo.settle(bet.id, 'won', payout);
        
        report.winnersCount++;
        report.totalPayout += payout;
      } else {
        // 输家
        await this.betRepo.settle(bet.id, 'lost', 0);
      }
    }
    
    // 4. 计算平台收入
    report.houseTake = market.totalPool - report.totalPayout;
    
    return report;
  }
  
  /**
   * 取消市场（异常情况）
   */
  async cancelMarket(marketId: string, reason: string): Promise<void> {
    const allBets = await this.betRepo.getByMarketId(marketId);
    
    // 全额退款
    for (const bet of allBets) {
      await this.tokenService.addTokens(
        bet.userId,
        bet.amount,
        `cancel_refund_${marketId}`
      );
      await this.betRepo.settle(bet.id, 'refunded', bet.amount);
    }
    
    await this.marketRepo.updateStatus(marketId, MarketStatus.CANCELLED);
  }
}

interface SettlementReport {
  marketId: string;
  winningOption: string;
  totalBets: number;
  totalPool: number;
  winnersCount: number;
  totalPayout: number;
  houseTake: number;
}
```

---

## 6. API 设计

### 6.1 REST API

```typescript
// 市场相关
GET    /api/markets                     // 获取所有开放市场
GET    /api/markets/:id                 // 获取市场详情
GET    /api/markets/game/:gameId        // 获取游戏相关市场

// 投注相关
POST   /api/bets                        // 下注
DELETE /api/bets/:id                    // 取消投注
GET    /api/bets/user/:userId           // 用户投注历史

// Token 相关
GET    /api/tokens/balance              // 获取余额
POST   /api/tokens/claim-daily          // 领取每日奖励
GET    /api/tokens/transactions         // 交易记录

// 结算相关
GET    /api/settlements/:marketId       // 获取结算报告
```

### 6.2 WebSocket 事件

```typescript
// 客户端 → 服务器
interface ClientEvents {
  'join_market': { marketId: string };
  'leave_market': { marketId: string };
  'place_bet': PlaceBetRequest;
}

// 服务器 → 客户端
interface ServerEvents {
  'odds_update': OddsUpdate;
  'market_status_change': { marketId: string; status: MarketStatus };
  'bet_confirmed': BetResult;
  'settlement_result': { marketId: string; yourBets: Bet[]; totalPayout: number };
  'balance_update': { balance: number };
}
```

### 6.3 Fastify 路由实现

```typescript
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';

const app = Fastify();
await app.register(fastifyWebsocket);

// 市场列表
app.get('/api/markets', async (request, reply) => {
  const markets = await marketService.getOpenMarkets();
  return { markets };
});

// 下注
app.post('/api/bets', async (request, reply) => {
  const { userId, marketId, optionId, amount } = request.body as PlaceBetRequest;
  
  // 验证
  if (amount <= 0 || amount > 1000) {
    return reply.code(400).send({ error: 'Invalid bet amount (1-1000)' });
  }
  
  const result = await bettingService.placeBet({ userId, marketId, optionId, amount });
  
  if (!result.success) {
    return reply.code(400).send({ error: result.error });
  }
  
  return result;
});

// WebSocket 连接
app.get('/ws', { websocket: true }, (connection, req) => {
  connection.socket.on('message', async (message) => {
    const data = JSON.parse(message.toString());
    
    switch (data.type) {
      case 'join_market':
        connection.socket.join(`market:${data.marketId}`);
        break;
      case 'place_bet':
        const result = await bettingService.placeBet(data.payload);
        connection.socket.send(JSON.stringify({ type: 'bet_confirmed', data: result }));
        break;
    }
  });
});
```

---

## 7. 数据库设计

### 7.1 PostgreSQL Schema

```sql
-- 用户 Token 账户
CREATE TABLE user_tokens (
  user_id VARCHAR(64) PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  wallet_address VARCHAR(42),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Token 交易记录
CREATE TABLE token_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  amount INTEGER NOT NULL,
  type VARCHAR(16) NOT NULL, -- 'credit' | 'debit'
  reason VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_token_tx_user ON token_transactions(user_id);

-- 预测市场
CREATE TABLE prediction_markets (
  id VARCHAR(64) PRIMARY KEY,
  game_id VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL,
  question TEXT NOT NULL,
  total_pool INTEGER DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  result VARCHAR(64),
  closes_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
CREATE INDEX idx_market_game ON prediction_markets(game_id);
CREATE INDEX idx_market_status ON prediction_markets(status);

-- 市场选项
CREATE TABLE market_options (
  id VARCHAR(64) PRIMARY KEY,
  market_id VARCHAR(64) NOT NULL REFERENCES prediction_markets(id),
  label VARCHAR(128) NOT NULL,
  total_bets INTEGER DEFAULT 0,
  bet_count INTEGER DEFAULT 0
);
CREATE INDEX idx_option_market ON market_options(market_id);

-- 投注记录
CREATE TABLE bets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  market_id VARCHAR(64) NOT NULL REFERENCES prediction_markets(id),
  option_id VARCHAR(64) NOT NULL REFERENCES market_options(id),
  amount INTEGER NOT NULL,
  locked_odds DECIMAL(10, 2) NOT NULL,
  potential_payout INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  payout INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);
CREATE INDEX idx_bet_user ON bets(user_id);
CREATE INDEX idx_bet_market ON bets(market_id);
CREATE INDEX idx_bet_status ON bets(status);
```

### 7.2 Redis 数据结构

```
# 用户余额缓存
balance:{userId} -> "1234"

# 每日领取记录
daily:{userId} -> "Sat Feb 14 2026"

# 市场实时数据
market:{marketId}:pool -> "50000"
market:{marketId}:bets:{optionId} -> "12500"

# 活跃用户会话
session:{userId} -> { socketId, joinedMarkets: [...] }
```

---

## 8. 目录结构

```
src/
├── prediction/
│   ├── index.ts                    # 模块入口
│   ├── services/
│   │   ├── betting-service.ts      # 投注服务
│   │   ├── settlement-service.ts   # 结算服务
│   │   ├── odds-calculator.ts      # 赔率计算
│   │   └── odds-update-service.ts  # 实时赔率推送
│   ├── token/
│   │   ├── arcade-token-service.ts # Token 管理
│   │   └── daily-reward.ts         # 每日奖励
│   ├── repositories/
│   │   ├── market-repository.ts    # 市场数据访问
│   │   └── bet-repository.ts       # 投注数据访问
│   ├── routes/
│   │   ├── market-routes.ts        # 市场 API
│   │   ├── bet-routes.ts           # 投注 API
│   │   └── token-routes.ts         # Token API
│   ├── websocket/
│   │   └── market-socket.ts        # WebSocket 处理
│   └── types/
│       └── index.ts                # 类型定义
├── database/
│   ├── migrations/                 # 数据库迁移
│   └── seed/                       # 测试数据
└── tests/
    └── prediction/
        ├── betting.test.ts
        ├── settlement.test.ts
        └── odds.test.ts
```

---

## 9. 与游戏引擎的集成

### 9.1 事件监听

```typescript
class GameMarketIntegration {
  private gameEngine: GameEngine;
  private marketService: MarketService;
  
  initialize() {
    // 游戏开始时创建市场
    this.gameEngine.on('game_started', async (event) => {
      await this.createMarketsForGame(event.gameId, event.players);
    });
    
    // 游戏进入锁定阶段
    this.gameEngine.on('first_action', async (event) => {
      await this.lockMarkets(event.gameId);
    });
    
    // 游戏结束时结算
    this.gameEngine.on('game_ended', async (event) => {
      await this.settleGameMarkets(event.gameId, event.winner);
    });
  }
  
  private async createMarketsForGame(gameId: string, players: Player[]) {
    // 创建"谁会赢"市场
    const winnerMarket: PredictionMarket = {
      id: `${gameId}_winner`,
      gameId,
      type: MarketType.GAME_WINNER,
      question: '谁会赢得本局比赛？',
      options: players.map(p => ({
        id: p.id,
        label: `${p.avatar} ${p.name}`,
        totalBets: 0,
        odds: players.length, // 初始均等赔率
        betCount: 0
      })),
      status: MarketStatus.OPEN,
      totalPool: 0,
      createdAt: Date.now(),
      closesAt: Date.now() + 60000 // 1分钟后关闭
    };
    
    await this.marketService.createMarket(winnerMarket);
  }
}
```

---

## 10. 开发计划

| 任务 | 预计时间 | 优先级 |
|------|----------|--------|
| 数据库设计与迁移 | 2h | P0 |
| Token 服务实现 | 3h | P0 |
| 赔率计算系统 | 2h | P0 |
| 投注服务实现 | 3h | P0 |
| 结算服务实现 | 2h | P0 |
| REST API 开发 | 3h | P1 |
| WebSocket 实时推送 | 2h | P1 |
| 游戏引擎集成 | 2h | P1 |
| 单元测试 | 3h | P2 |

**总计**: 约 22 小时（3个工作日）

---

## 11. 注意事项

1. **防刷保护**：限制单用户投注频率和金额上限
2. **数据一致性**：使用数据库事务确保扣款和投注原子性
3. **结算锁定**：使用乐观锁防止重复结算
4. **实时性**：赔率更新延迟不超过 500ms
5. **公平性**：游戏开始后禁止投注，结果由可验证的链上数据决定
