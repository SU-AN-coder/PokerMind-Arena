# 模块四：预测市场系统（最终版）

> **状态**: 最终版 v2.0 | **优先级**: P1 | **预计时间**: 8h

## 🎯 核心简化：彩池制 + 模拟观众

### 为什么简化？

| 原方案 | 问题 | 新方案 |
|--------|------|--------|
| 动态赔率计算 | 实现复杂、需要做市商逻辑 | **彩池制(Parimutuel)** - 所有赌注平分 |
| 真实用户系统 | 没有真实用户测试数据 | **模拟观众系统** - 自动生成投注 |
| PostgreSQL + Redis | 杀鸡用牛刀 | **内存状态** - 演示够用 |
| Arcade Token | 太复杂 | **虚拟积分** - 展示用 |

---

## 1. 模块概述

### 1.1 核心职责
- 提供简单的"谁会赢"预测投票
- **彩池制结算**：赢家平分输家的筹码
- **模拟观众**：自动生成虚假投注数据
- 展示"众人皆赌"的氛围

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| 后端 | 内存 Map | 无需数据库 |
| 结算 | 彩池制 | 公式简单 |
| 观众 | 模拟生成 | 数据好看 |

---

## 2. 彩池制（Parimutuel）原理

```
     所有人下注
          │
          ▼
    ┌─────────────┐
    │   总奖池     │
    │  $1000      │
    └──────┬──────┘
           │
    扣除平台费 5%
           │
           ▼
    ┌─────────────┐
    │  净奖池      │
    │  $950       │
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
赢家按投注比例瓜分   输家失去全部
    
例：净池950，赢家池300
赔率 = 950 / 300 = 3.17
押10块赢 31.7
```

### 2.1 彩池制核心公式

```typescript
/**
 * 彩池制赔率计算
 * @param totalPool 总投注池
 * @param winnerPool 获胜选项的投注总额
 * @param platformFee 平台抽成（默认5%）
 * @returns 赔率
 */
function calculatePayoutOdds(
  totalPool: number,
  winnerPool: number,
  platformFee: number = 0.05
): number {
  if (winnerPool === 0) return 0;  // 无人下注该选项
  const netPool = totalPool * (1 - platformFee);
  return netPool / winnerPool;
}

// 示例
// 总池1000，火焰池300，冰山池400，诡影池200，逻辑池100
// 火焰赢：赔率 = 950 / 300 = 3.17
// 押火焰100 → 赢317
```

---

## 3. 数据结构

### 3.1 预测市场

```typescript
interface PredictionMarket {
  gameId: string;
  question: string;           // "谁会赢得这场比赛？"
  status: 'open' | 'locked' | 'resolved';
  
  options: {
    aiId: string;
    aiName: string;
    avatar: string;
    totalBets: number;        // 该选项总投注
    betCount: number;         // 投注人数（含模拟）
  }[];
  
  totalPool: number;          // 总池
  closedAt?: number;          // 锁定时间
  winnerId?: string;          // 获胜AI
}

interface UserBet {
  oduserId: string;
  optionId: string;           // AI ID
  amount: number;
  placedAt: number;
}
```

### 3.2 市场管理器

```typescript
class MarketManager {
  private markets: Map<string, PredictionMarket> = new Map();
  private bets: Map<string, UserBet[]> = new Map();  // gameId -> bets
  
  /**
   * 创建新市场
   */
  createMarket(gameId: string, players: { id: string; name: string; avatar: string }[]): PredictionMarket {
    const market: PredictionMarket = {
      gameId,
      question: '谁会赢得这场AI扑克大战？',
      status: 'open',
      options: players.map(p => ({
        aiId: p.id,
        aiName: p.name,
        avatar: p.avatar,
        totalBets: 0,
        betCount: 0
      })),
      totalPool: 0
    };
    
    this.markets.set(gameId, market);
    this.bets.set(gameId, []);
    
    // 🔑 关键：立即生成模拟投注
    this.generateSimulatedBets(gameId);
    
    return market;
  }
  
  /**
   * 用户下注
   */
  placeBet(gameId: string, userId: string, aiId: string, amount: number): boolean {
    const market = this.markets.get(gameId);
    if (!market || market.status !== 'open') return false;
    
    const option = market.options.find(o => o.aiId === aiId);
    if (!option) return false;
    
    // 更新市场数据
    option.totalBets += amount;
    option.betCount += 1;
    market.totalPool += amount;
    
    // 记录投注
    this.bets.get(gameId)!.push({
      userId,
      optionId: aiId,
      amount,
      placedAt: Date.now()
    });
    
    return true;
  }
  
  /**
   * 锁定市场（游戏开始）
   */
  lockMarket(gameId: string): void {
    const market = this.markets.get(gameId);
    if (market) {
      market.status = 'locked';
      market.closedAt = Date.now();
    }
  }
  
  /**
   * 结算市场
   */
  resolveMarket(gameId: string, winnerId: string): SettlementResult {
    const market = this.markets.get(gameId);
    if (!market) throw new Error('Market not found');
    
    market.status = 'resolved';
    market.winnerId = winnerId;
    
    const winnerOption = market.options.find(o => o.aiId === winnerId)!;
    const odds = calculatePayoutOdds(market.totalPool, winnerOption.totalBets);
    
    // 计算每个用户的收益
    const bets = this.bets.get(gameId) || [];
    const results: { userId: string; betAmount: number; payout: number }[] = [];
    
    for (const bet of bets) {
      if (bet.optionId === winnerId) {
        const payout = bet.amount * odds;
        results.push({ userId: bet.userId, betAmount: bet.amount, payout });
      } else {
        results.push({ userId: bet.userId, betAmount: bet.amount, payout: 0 });
      }
    }
    
    return {
      winnerId,
      winnerName: winnerOption.aiName,
      odds,
      totalPool: market.totalPool,
      winnerPool: winnerOption.totalBets,
      results
    };
  }
}

interface SettlementResult {
  winnerId: string;
  winnerName: string;
  odds: number;
  totalPool: number;
  winnerPool: number;
  results: { userId: string; betAmount: number; payout: number }[];
}
```

---

## 4. 模拟观众系统 🆕

### 4.1 为什么需要模拟观众？

> **问题**：演示时没有真实用户，预测市场看起来冷清  
> **解决**：自动生成模拟投注，让市场数据"好看"

### 4.2 模拟策略

```typescript
interface SimulatedBetConfig {
  minBettors: number;        // 最少模拟人数: 20
  maxBettors: number;        // 最多模拟人数: 50
  minBetAmount: number;      // 最小投注: 10
  maxBetAmount: number;      // 最大投注: 100
  
  // 热门偏向（让某个AI更被看好）
  favoredBias: number;       // 0.3 = 热门选项获得30%额外投注
}

class SimulatedAudienceGenerator {
  private config: SimulatedBetConfig = {
    minBettors: 20,
    maxBettors: 50,
    minBetAmount: 10,
    maxBetAmount: 100,
    favoredBias: 0.3
  };
  
  /**
   * 生成模拟观众名称
   */
  private generateViewerNames(count: number): string[] {
    const prefixes = ['快乐', '神秘', '硬核', '佛系', '狂热', '专业', '菜鸟', '老司机'];
    const suffixes = ['赌徒', '观众', '玩家', '分析师', '粉丝', '路人'];
    const names: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      names.push(`${prefix}${suffix}${Math.floor(Math.random() * 999)}`);
    }
    
    return names;
  }
  
  /**
   * 生成模拟投注
   */
  generateSimulatedBets(market: PredictionMarket): SimulatedBet[] {
    const bettorCount = this.randomInRange(this.config.minBettors, this.config.maxBettors);
    const names = this.generateViewerNames(bettorCount);
    const bets: SimulatedBet[] = [];
    
    // 随机选择一个"热门"选项
    const favoredIndex = Math.floor(Math.random() * market.options.length);
    
    for (let i = 0; i < bettorCount; i++) {
      // 决定投注哪个选项
      let optionIndex: number;
      if (Math.random() < this.config.favoredBias) {
        optionIndex = favoredIndex;  // 投注热门
      } else {
        optionIndex = Math.floor(Math.random() * market.options.length);
      }
      
      const amount = this.randomInRange(this.config.minBetAmount, this.config.maxBetAmount);
      
      bets.push({
        viewerName: names[i],
        optionId: market.options[optionIndex].aiId,
        amount,
        timestamp: Date.now() - Math.floor(Math.random() * 60000)  // 过去1分钟内
      });
    }
    
    return bets;
  }
  
  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

interface SimulatedBet {
  viewerName: string;
  optionId: string;
  amount: number;
  timestamp: number;
}
```

### 4.3 实时模拟投注流

```typescript
class LiveBetSimulator {
  private io: Server;
  private generator: SimulatedAudienceGenerator;
  private intervals: Map<string, NodeJS.Timer> = new Map();
  
  /**
   * 开始模拟投注流（每3-8秒一笔）
   */
  startSimulating(gameId: string, market: PredictionMarket): void {
    const emit = () => {
      const bets = this.generator.generateSimulatedBets(market);
      const bet = bets[Math.floor(Math.random() * bets.length)];
      
      // 更新市场数据
      const option = market.options.find(o => o.aiId === bet.optionId)!;
      option.totalBets += bet.amount;
      option.betCount += 1;
      market.totalPool += bet.amount;
      
      // 广播
      this.io.to(`game:${gameId}`).emit('new_bet', {
        viewerName: bet.viewerName,
        optionName: option.aiName,
        optionAvatar: option.avatar,
        amount: bet.amount,
        newTotalPool: market.totalPool
      });
      
      // 随机延迟下一次
      const delay = 3000 + Math.random() * 5000;
      this.intervals.set(gameId, setTimeout(emit, delay));
    };
    
    emit();
  }
  
  stopSimulating(gameId: string): void {
    const interval = this.intervals.get(gameId);
    if (interval) {
      clearTimeout(interval);
      this.intervals.delete(gameId);
    }
  }
}
```

---

## 5. Socket.io 事件

### 5.1 服务端事件

```typescript
// server/socket-handlers/market.ts
export function setupMarketSocketHandlers(io: Server, marketManager: MarketManager) {
  io.on('connection', (socket) => {
    // 加入市场房间
    socket.on('join_market', (gameId: string) => {
      socket.join(`market:${gameId}`);
      
      const market = marketManager.getMarket(gameId);
      if (market) {
        socket.emit('market_state', market);
      }
    });
    
    // 用户下注
    socket.on('place_bet', async (data: { gameId: string; aiId: string; amount: number }) => {
      const userId = socket.data.userId || `anon_${socket.id}`;
      const success = marketManager.placeBet(data.gameId, userId, data.aiId, data.amount);
      
      if (success) {
        const market = marketManager.getMarket(data.gameId)!;
        
        // 通知所有人
        io.to(`market:${data.gameId}`).emit('bet_placed', {
          userId,
          aiId: data.aiId,
          amount: data.amount,
          newTotalPool: market.totalPool
        });
        
        // 更新赔率
        io.to(`market:${data.gameId}`).emit('odds_update', {
          options: market.options.map(o => ({
            aiId: o.aiId,
            totalBets: o.totalBets,
            betCount: o.betCount,
            odds: calculatePayoutOdds(market.totalPool, o.totalBets)
          }))
        });
      }
    });
  });
}
```

### 5.2 客户端事件

| 事件 | 方向 | 数据 |
|------|------|------|
| `join_market` | C→S | `{ gameId }` |
| `market_state` | S→C | `PredictionMarket` |
| `place_bet` | C→S | `{ gameId, aiId, amount }` |
| `bet_placed` | S→C | `{ userId, aiId, amount }` |
| `new_bet` | S→C | 模拟投注（含观众名） |
| `odds_update` | S→C | 所有选项的新赔率 |
| `market_locked` | S→C | 市场已锁定 |
| `market_resolved` | S→C | `SettlementResult` |

---

## 6. 前端组件

### 6.1 投注面板

```tsx
// components/Market/BettingPanel.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { socket } from '@/lib/socket';

interface BettingPanelProps {
  gameId: string;
  market: PredictionMarket;
}

export function BettingPanel({ gameId, market }: BettingPanelProps) {
  const [selectedAi, setSelectedAi] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  
  const handlePlaceBet = () => {
    if (!selectedAi) return;
    socket.emit('place_bet', { gameId, aiId: selectedAi, amount: betAmount });
    setSelectedAi(null);
  };
  
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-lg font-bold text-white mb-3">
        🎲 {market.question}
      </h3>
      
      {/* 选项列表 */}
      <div className="space-y-2 mb-4">
        {market.options.map(option => {
          const odds = calculatePayoutOdds(market.totalPool, option.totalBets);
          
          return (
            <motion.button
              key={option.aiId}
              onClick={() => setSelectedAi(option.aiId)}
              whileHover={{ scale: 1.02 }}
              className={`w-full p-3 rounded-lg flex items-center justify-between
                ${selectedAi === option.aiId 
                  ? 'bg-blue-600 border-2 border-blue-400' 
                  : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{option.avatar}</span>
                <span className="text-white font-medium">{option.aiName}</span>
              </div>
              
              <div className="text-right">
                <div className="text-yellow-400 font-bold">
                  {odds.toFixed(2)}x
                </div>
                <div className="text-xs text-gray-400">
                  {option.betCount}人 · ${option.totalBets}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      
      {/* 投注金额 */}
      <div className="flex gap-2 mb-4">
        {[10, 25, 50, 100].map(amount => (
          <button
            key={amount}
            onClick={() => setBetAmount(amount)}
            className={`flex-1 py-2 rounded ${
              betAmount === amount 
                ? 'bg-yellow-500 text-black' 
                : 'bg-gray-700 text-white'
            }`}
          >
            ${amount}
          </button>
        ))}
      </div>
      
      {/* 下注按钮 */}
      <button
        onClick={handlePlaceBet}
        disabled={!selectedAi || market.status !== 'open'}
        className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 
                   rounded-lg font-bold text-white text-lg
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {market.status === 'open' ? `下注 $${betAmount}` : '投注已截止'}
      </button>
      
      {/* 总池 */}
      <div className="mt-3 text-center text-gray-400">
        总奖池: <span className="text-yellow-400 font-bold">${market.totalPool}</span>
      </div>
    </div>
  );
}
```

### 6.2 实时投注滚动条

```tsx
// components/Market/LiveBetFeed.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '@/lib/socket';

interface LiveBet {
  viewerName: string;
  optionName: string;
  optionAvatar: string;
  amount: number;
}

export function LiveBetFeed({ gameId }: { gameId: string }) {
  const [bets, setBets] = useState<LiveBet[]>([]);
  
  useEffect(() => {
    const handleNewBet = (bet: LiveBet) => {
      setBets(prev => [bet, ...prev.slice(0, 9)]);  // 最多显示10条
    };
    
    socket.on('new_bet', handleNewBet);
    return () => socket.off('new_bet', handleNewBet);
  }, []);
  
  return (
    <div className="bg-gray-900/50 rounded-lg p-2 max-h-[200px] overflow-hidden">
      <div className="text-xs text-gray-500 mb-2">🔴 实时投注</div>
      
      <AnimatePresence>
        {bets.map((bet, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 py-1 text-sm"
          >
            <span className="text-gray-400">{bet.viewerName}</span>
            <span className="text-white">押</span>
            <span>{bet.optionAvatar}</span>
            <span className="text-yellow-400 font-bold">${bet.amount}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

---

## 7. 开发计划

| 任务 | 时间 | 优先级 |
|------|------|--------|
| MarketManager 核心 | 2h | P0 |
| 彩池制结算逻辑 | 1h | P0 |
| 模拟观众生成器 | 2h | P0 |
| Socket.io 事件 | 1h | P0 |
| 前端投注面板 | 2h | P1 |

**总计**: 8h

---

## 8. 演示话术

> "现在让我们看看预测市场！
>
> 观众可以在比赛开始前下注，猜测哪个AI会获胜。
>
> 你看这里——已经有47个观众下注了，总奖池达到$2,350。
>
> 火焰目前是热门，赔率只有1.8倍；而冰山是冷门，赔率高达4.2倍。
>
> **[实时投注滚动条展示]**
>
> 每隔几秒就有新的投注进来... '狂热赌徒888押火焰$100'...
>
> 这用的是彩池制——所有赢家平分输家的筹码。简单、公平、有趣！"

---

## 9. 与其他模块集成

```
游戏开始前
    │
    ▼
┌─────────────────┐
│ createMarket()  │ ← 创建预测市场
└────────┬────────┘
         │
┌────────▼────────┐
│ 模拟投注开始     │ ←模拟观众自动下注
└────────┬────────┘
         │
游戏开始 (5秒倒计时后)
         │
┌────────▼────────┐
│ lockMarket()    │ ← 锁定投注
└────────┬────────┘
         │
游戏进行中...
         │
┌────────▼────────┐
│ resolveMarket() │ ← 结算市场
└────────┬────────┘
         │
    前端展示结果
```
