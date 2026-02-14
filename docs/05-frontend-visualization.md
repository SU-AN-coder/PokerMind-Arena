# 模块五：前端可视化界面

## 1. 模块概述

前端模块负责展示实时对战画面、AI 思考过程、观众竞猜面板，提供流畅的观赛体验。

### 1.1 核心职责
- 实时渲染扑克牌桌和游戏状态
- 展示 AI "思考过程" 动画
- 集成观众竞猜面板
- 游戏回放功能

### 1.2 技术选型
| 组件 | 选择 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 生态成熟、类型安全 |
| 状态管理 | Zustand | 轻量、简洁 |
| 动画 | Framer Motion | 声明式动画、性能好 |
| 样式 | Tailwind CSS | 快速开发、响应式 |
| 实时通信 | Socket.io Client | 双向通信 |
| 构建 | Vite | 快速热更新 |

### 1.3 设计原则
- **演示优先**：5分钟内让观众理解游戏
- **动画流畅**：60fps 动画，无卡顿
- **信息清晰**：关键数据一目了然

---

## 2. 页面结构设计

### 2.1 整体布局

```
┌──────────────────────────────────────────────────────────┐
│                       Header                              │
│  Logo    |    Game Status    |    Token Balance    |Auth │
├────────────────────────────────┬─────────────────────────┤
│                                │                         │
│                                │    Prediction Panel     │
│         Poker Table            │   ┌─────────────────┐   │
│                                │   │ Market Question │   │
│     ┌───┐   ┌───┐   ┌───┐     │   │ Option A: 2.5x  │   │
│     │AI1│   │AI2│   │AI3│     │   │ Option B: 1.8x  │   │
│     └───┘   └───┘   └───┘     │   │ [Place Bet]     │   │
│            ┌─────┐             │   └─────────────────┘   │
│            │ POT │             │                         │
│            └─────┘             │    AI Thoughts Panel    │
│     ┌───┐           ┌───┐     │   ┌─────────────────┐   │
│     │AI4│           │AI5│     │   │ "我有强牌..."    │   │
│     └───┘           └───┘     │   │ Confidence: 85% │   │
│                                │   └─────────────────┘   │
│     [ Community Cards ]        │                         │
│                                │                         │
├────────────────────────────────┴─────────────────────────┤
│                     Action History                        │
│ AI1 raises $200 → AI2 calls → AI3 folds → ...            │
└──────────────────────────────────────────────────────────┘
```

### 2.2 页面路由

```typescript
const routes = [
  { path: '/', component: HomePage },           // 首页/大厅
  { path: '/game/:id', component: GameRoom },   // 游戏房间
  { path: '/history', component: GameHistory }, // 历史记录
  { path: '/profile', component: UserProfile }, // 用户中心
  { path: '/verify/:gameId', component: VerificationPage }, // 验证页
];
```

---

## 3. 组件设计

### 3.1 核心组件树

```
<App>
├── <Header />
│   ├── <Logo />
│   ├── <GameStatus />
│   ├── <TokenBalance />
│   └── <UserMenu />
│
├── <GameRoom>
│   ├── <PokerTable>
│   │   ├── <CommunityCards />
│   │   ├── <PotDisplay />
│   │   └── <PlayerSeat /> x 4-6
│   │       ├── <PlayerAvatar />
│   │       ├── <ChipStack />
│   │       ├── <HoleCards />
│   │       ├── <ActionIndicator />
│   │       └── <ThinkingBubble />
│   │
│   ├── <SidePanel>
│   │   ├── <PredictionMarket />
│   │   │   ├── <MarketQuestion />
│   │   │   ├── <OddsDisplay />
│   │   │   └── <BetControls />
│   │   │
│   │   └── <AIThoughts />
│   │       ├── <ReasoningText />
│   │       ├── <ConfidenceMeter />
│   │       └── <OpponentRead />
│   │
│   └── <ActionTimeline />
│
└── <Footer />
```

### 3.2 类型定义

```typescript
// 组件 Props 类型
interface PlayerSeatProps {
  player: Player;
  position: SeatPosition;
  isActive: boolean;
  isDealer: boolean;
  showCards: boolean;
}

interface CommunityCardsProps {
  cards: Card[];
  phase: GamePhase;
}

interface PredictionMarketProps {
  market: PredictionMarket;
  userBalance: number;
  onPlaceBet: (optionId: string, amount: number) => void;
}

interface AIThoughtsProps {
  agentId: string;
  decision: AIDecision | null;
  isThinking: boolean;
}

type SeatPosition = 'top-left' | 'top-center' | 'top-right' | 
                    'bottom-left' | 'bottom-right';
```

---

## 4. 扑克牌桌组件

### 4.1 桌面布局

```tsx
// components/PokerTable/index.tsx
import { motion } from 'framer-motion';

const SEAT_POSITIONS = {
  4: [
    { id: 'top-left', x: '20%', y: '10%' },
    { id: 'top-right', x: '80%', y: '10%' },
    { id: 'bottom-left', x: '20%', y: '80%' },
    { id: 'bottom-right', x: '80%', y: '80%' },
  ],
  6: [
    { id: 'top-left', x: '15%', y: '10%' },
    { id: 'top-center', x: '50%', y: '5%' },
    { id: 'top-right', x: '85%', y: '10%' },
    { id: 'bottom-left', x: '15%', y: '85%' },
    { id: 'bottom-center', x: '50%', y: '90%' },
    { id: 'bottom-right', x: '85%', y: '85%' },
  ],
};

export function PokerTable({ gameState }: { gameState: GameState }) {
  const positions = SEAT_POSITIONS[gameState.players.length as 4 | 6];
  
  return (
    <div className="relative w-full h-[600px] bg-gradient-to-b from-green-800 to-green-900 rounded-[50%] border-8 border-amber-800 shadow-2xl">
      {/* 桌面纹理 */}
      <div className="absolute inset-0 opacity-20 bg-[url('/felt-texture.png')]" />
      
      {/* 公共牌区域 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <CommunityCards 
          cards={gameState.communityCards} 
          phase={gameState.phase}
        />
      </div>
      
      {/* 底池显示 */}
      <PotDisplay pot={gameState.pot} sidePots={gameState.sidePots} />
      
      {/* 玩家座位 */}
      {gameState.players.map((player, index) => (
        <PlayerSeat
          key={player.id}
          player={player}
          position={positions[index]}
          isActive={gameState.activePlayerIndex === index}
          isDealer={gameState.dealerPosition === index}
          showCards={gameState.phase === 'showdown' || player.status === 'folded'}
        />
      ))}
      
      {/* 庄家按钮 */}
      <DealerButton position={positions[gameState.dealerPosition]} />
    </div>
  );
}
```

### 4.2 扑克牌组件

```tsx
// components/PokerTable/Card.tsx
import { motion } from 'framer-motion';

interface CardProps {
  card: Card | null;
  faceDown?: boolean;
  delay?: number;
}

const SUIT_COLORS = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export function Card({ card, faceDown = false, delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
      animate={{ rotateY: faceDown ? 180 : 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`
        w-16 h-24 rounded-lg shadow-lg cursor-pointer transform-gpu
        ${faceDown ? 'bg-gradient-to-br from-blue-700 to-blue-900' : 'bg-white'}
      `}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {!faceDown && card && (
        <div className={`p-2 ${SUIT_COLORS[card.suit]}`}>
          <div className="text-xl font-bold">{card.rank}</div>
          <div className="text-2xl">{SUIT_SYMBOLS[card.suit]}</div>
        </div>
      )}
      
      {faceDown && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-16 border-2 border-white/30 rounded" />
        </div>
      )}
    </motion.div>
  );
}

// 公共牌组件
export function CommunityCards({ cards, phase }: { cards: Card[]; phase: GamePhase }) {
  const visibleCount = {
    preflop: 0,
    flop: 3,
    turn: 4,
    river: 5,
    showdown: 5,
  }[phase] || 0;

  return (
    <div className="flex gap-2">
      {[0, 1, 2, 3, 4].map((index) => (
        <motion.div key={index} className="relative">
          {index < visibleCount ? (
            <Card card={cards[index]} delay={index * 0.15} />
          ) : (
            <div className="w-16 h-24 rounded-lg bg-green-700/50 border-2 border-dashed border-green-600" />
          )}
        </motion.div>
      ))}
    </div>
  );
}
```

### 4.3 玩家座位组件

```tsx
// components/PokerTable/PlayerSeat.tsx
import { motion, AnimatePresence } from 'framer-motion';

export function PlayerSeat({ 
  player, 
  position, 
  isActive, 
  isDealer, 
  showCards 
}: PlayerSeatProps) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* 活跃玩家光晕 */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute -inset-4 bg-yellow-400/30 rounded-full blur-lg"
          />
        )}
      </AnimatePresence>
      
      {/* 头像 */}
      <PlayerAvatar 
        avatar={player.avatar}
        name={player.name}
        status={player.status}
      />
      
      {/* 筹码堆 */}
      <ChipStack amount={player.chips} />
      
      {/* 手牌 */}
      <div className="flex gap-1 mt-2">
        <Card 
          card={showCards ? player.holeCards[0] : null} 
          faceDown={!showCards} 
        />
        <Card 
          card={showCards ? player.holeCards[1] : null} 
          faceDown={!showCards} 
        />
      </div>
      
      {/* 当前下注 */}
      {player.currentBet > 0 && (
        <BetChips amount={player.currentBet} />
      )}
      
      {/* 思考气泡 */}
      {isActive && (
        <ThinkingBubble playerId={player.id} />
      )}
      
      {/* 动作标签 */}
      <ActionIndicator lastAction={player.lastAction} />
    </motion.div>
  );
}

function PlayerAvatar({ avatar, name, status }: { 
  avatar: string; 
  name: string; 
  status: string;
}) {
  const statusColors = {
    active: 'border-green-500',
    folded: 'border-gray-500 grayscale',
    'all-in': 'border-red-500',
    out: 'border-gray-800 grayscale opacity-50',
  };
  
  return (
    <div className={`
      relative w-20 h-20 rounded-full border-4 ${statusColors[status]}
      overflow-hidden bg-gradient-to-br from-gray-700 to-gray-900
    `}>
      <span className="text-4xl absolute inset-0 flex items-center justify-center">
        {avatar}
      </span>
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-1">
        {name}
      </div>
    </div>
  );
}
```

---

## 5. AI 思考展示组件

### 5.1 思考气泡

```tsx
// components/AIThoughts/ThinkingBubble.tsx
import { motion } from 'framer-motion';

export function ThinkingBubble({ decision, isThinking }: AIThoughtsProps) {
  return (
    <AnimatePresence>
      {isThinking ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute -top-20 left-1/2 -translate-x-1/2 bg-white rounded-xl px-4 py-2 shadow-lg"
        >
          {/* 思考动画 */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [-2, 2, -2] }}
                transition={{ 
                  duration: 0.6, 
                  repeat: Infinity, 
                  delay: i * 0.2 
                }}
                className="w-2 h-2 bg-gray-400 rounded-full"
              />
            ))}
          </div>
          
          {/* 气泡尾巴 */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45" />
        </motion.div>
      ) : decision && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-4 text-white shadow-2xl"
        >
          <div className="font-bold text-lg mb-2">
            {getActionLabel(decision.action)}
            {decision.amount && ` $${decision.amount}`}
          </div>
          
          <p className="text-sm opacity-90 mb-2">
            "{decision.reasoning}"
          </p>
          
          <ConfidenceMeter value={decision.confidence} />
          
          {decision.read && (
            <p className="text-xs opacity-75 mt-2 italic">
              对手判读: {decision.read}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs">信心:</span>
      <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${
            value > 70 ? 'bg-green-400' : 
            value > 40 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
        />
      </div>
      <span className="text-xs font-mono">{value}%</span>
    </div>
  );
}
```

### 5.2 侧边面板

```tsx
// components/SidePanel/AIThoughtsPanel.tsx

export function AIThoughtsPanel({ 
  activeAgent, 
  decision, 
  history 
}: AIPanelProps) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 h-64 overflow-hidden">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        <span className="text-xl">{activeAgent?.avatar}</span>
        {activeAgent?.name} 思考中...
      </h3>
      
      {decision ? (
        <div className="space-y-3">
          {/* 决策展示 */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xl">
                {getActionEmoji(decision.action)} {getActionLabel(decision.action)}
              </span>
              {decision.amount && (
                <span className="text-yellow-400 font-bold">
                  ${decision.amount}
                </span>
              )}
            </div>
            
            <p className="text-gray-300 text-sm">
              {decision.reasoning}
            </p>
          </div>
          
          {/* 信心度 */}
          <ConfidenceMeter value={decision.confidence} />
          
          {/* 对手判读 */}
          {decision.read && (
            <div className="text-gray-400 text-sm">
              <span className="text-gray-500">对手判读:</span> {decision.read}
            </div>
          )}
        </div>
      ) : (
        <ThinkingAnimation />
      )}
      
      {/* 决策历史滚动 */}
      <div className="mt-4 space-y-1 max-h-20 overflow-y-auto">
        {history.slice(-5).map((h, i) => (
          <div key={i} className="text-xs text-gray-500">
            {h.agent}: {h.action} {h.amount && `$${h.amount}`}
          </div>
        ))}
      </div>
    </div>
  );
}

function getActionEmoji(action: string) {
  return {
    fold: '❌',
    check: '✋',
    call: '📞',
    raise: '⬆️',
    'all-in': '🚀',
  }[action] || '❓';
}
```

---

## 6. 预测市场面板

### 6.1 竞猜界面

```tsx
// components/SidePanel/PredictionPanel.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';

export function PredictionPanel({ 
  market, 
  userBalance, 
  onPlaceBet 
}: PredictionMarketProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  
  return (
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl p-4">
      <h3 className="text-white font-bold mb-2">🎯 预测市场</h3>
      
      <p className="text-gray-300 mb-4">{market.question}</p>
      
      {/* 选项列表 */}
      <div className="space-y-2 mb-4">
        {market.options.map((option) => (
          <OddsOption
            key={option.id}
            option={option}
            isSelected={selectedOption === option.id}
            onClick={() => setSelectedOption(option.id)}
          />
        ))}
      </div>
      
      {/* 下注控制 */}
      {selectedOption && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-400">下注金额:</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min={1}
              max={userBalance}
              className="w-20 bg-white/10 rounded px-2 py-1 text-white"
            />
            <span className="text-yellow-400">🪙 {userBalance}</span>
          </div>
          
          {/* 快捷金额 */}
          <div className="flex gap-2">
            {[10, 50, 100, 'ALL'].map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(
                  amount === 'ALL' ? userBalance : amount as number
                )}
                className="px-2 py-1 bg-white/10 rounded text-sm hover:bg-white/20"
              >
                {amount}
              </button>
            ))}
          </div>
          
          {/* 潜在收益 */}
          <div className="text-green-400 text-sm">
            潜在收益: {calculatePayout(betAmount, market, selectedOption)}
          </div>
          
          <button
            onClick={() => onPlaceBet(selectedOption, betAmount)}
            disabled={betAmount > userBalance || betAmount <= 0}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg font-bold text-white disabled:opacity-50"
          >
            确认下注
          </button>
        </motion.div>
      )}
      
      {/* 市场统计 */}
      <div className="mt-4 flex justify-between text-xs text-gray-400">
        <span>总投注池: {market.totalPool} 🪙</span>
        <span>参与人数: {market.options.reduce((a, o) => a + o.betCount, 0)}</span>
      </div>
    </div>
  );
}

function OddsOption({ option, isSelected, onClick }: {
  option: MarketOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  const percentage = calculatePercentageWidth(option);
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full p-3 rounded-lg relative overflow-hidden
        ${isSelected 
          ? 'bg-yellow-500/30 border-2 border-yellow-400' 
          : 'bg-white/10 border-2 border-transparent hover:border-white/30'}
      `}
    >
      {/* 投注比例背景 */}
      <div 
        className="absolute inset-0 bg-blue-500/20"
        style={{ width: `${percentage}%` }}
      />
      
      <div className="relative flex justify-between items-center">
        <span className="text-white font-medium">{option.label}</span>
        <div className="text-right">
          <div className="text-xl font-bold text-yellow-400">
            {option.odds.toFixed(2)}x
          </div>
          <div className="text-xs text-gray-400">
            {option.betCount} 人投注
          </div>
        </div>
      </div>
    </motion.button>
  );
}
```

---

## 7. 状态管理

### 7.1 Zustand Store

```typescript
// stores/gameStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface GameStore {
  // 游戏状态
  gameState: GameState | null;
  isConnected: boolean;
  
  // AI 决策
  currentDecision: AIDecision | null;
  decisionHistory: AIDecision[];
  
  // 预测市场
  activeMarket: PredictionMarket | null;
  userBets: Bet[];
  
  // 用户
  userBalance: number;
  
  // Actions
  setGameState: (state: GameState) => void;
  setCurrentDecision: (decision: AIDecision | null) => void;
  addToHistory: (decision: AIDecision) => void;
  updateMarket: (market: PredictionMarket) => void;
  setUserBalance: (balance: number) => void;
  addUserBet: (bet: Bet) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    gameState: null,
    isConnected: false,
    currentDecision: null,
    decisionHistory: [],
    activeMarket: null,
    userBets: [],
    userBalance: 0,
    
    setGameState: (gameState) => set({ gameState }),
    
    setCurrentDecision: (currentDecision) => set({ currentDecision }),
    
    addToHistory: (decision) => set((state) => ({
      decisionHistory: [...state.decisionHistory, decision].slice(-50)
    })),
    
    updateMarket: (activeMarket) => set({ activeMarket }),
    
    setUserBalance: (userBalance) => set({ userBalance }),
    
    addUserBet: (bet) => set((state) => ({
      userBets: [...state.userBets, bet]
    })),
    
    reset: () => set({
      gameState: null,
      currentDecision: null,
      decisionHistory: [],
      userBets: []
    })
  }))
);
```

### 7.2 WebSocket 集成

```typescript
// hooks/useGameSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';

export function useGameSocket(gameId: string) {
  const socketRef = useRef<Socket | null>(null);
  const { 
    setGameState, 
    setCurrentDecision, 
    addToHistory,
    updateMarket,
    setUserBalance 
  } = useGameStore();
  
  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL);
    socketRef.current = socket;
    
    socket.on('connect', () => {
      socket.emit('join_game', { gameId });
    });
    
    // 游戏状态更新
    socket.on('game_state', (state: GameState) => {
      setGameState(state);
    });
    
    // AI 决策
    socket.on('ai_thinking', ({ agentId }) => {
      setCurrentDecision(null); // 清除显示思考动画
    });
    
    socket.on('ai_decision', (decision: AIDecision) => {
      setCurrentDecision(decision);
      addToHistory(decision);
      
      // 3秒后清除当前决策显示
      setTimeout(() => setCurrentDecision(null), 3000);
    });
    
    // 预测市场更新
    socket.on('odds_update', (market: PredictionMarket) => {
      updateMarket(market);
    });
    
    socket.on('market_resolved', ({ marketId, result, userPayout }) => {
      // 显示结算动画
      showSettlementAnimation(result, userPayout);
    });
    
    // 余额更新
    socket.on('balance_update', ({ balance }) => {
      setUserBalance(balance);
    });
    
    return () => {
      socket.disconnect();
    };
  }, [gameId]);
  
  const placeBet = (optionId: string, amount: number) => {
    socketRef.current?.emit('place_bet', { optionId, amount });
  };
  
  return { placeBet };
}
```

---

## 8. 动画效果

### 8.1 筹码动画

```tsx
// components/Animations/ChipAnimation.tsx
import { motion } from 'framer-motion';

export function ChipFlyAnimation({ 
  from, 
  to, 
  amount,
  onComplete 
}: ChipAnimationProps) {
  return (
    <motion.div
      initial={{ x: from.x, y: from.y, scale: 1 }}
      animate={{ x: to.x, y: to.y, scale: 0.5 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      className="fixed z-50 pointer-events-none"
    >
      <div className="relative">
        {/* 筹码堆 */}
        {[...Array(Math.min(5, Math.ceil(amount / 100)))].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: 0 }}
            animate={{ y: i * -4 }}
            className={`
              w-10 h-10 rounded-full absolute
              bg-gradient-to-r from-red-600 to-red-700
              border-4 border-white/20
              shadow-lg
            `}
            style={{ top: i * -2 }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
              $
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* 金额标签 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-1 rounded text-yellow-400 text-sm font-bold whitespace-nowrap"
      >
        ${amount}
      </motion.div>
    </motion.div>
  );
}
```

### 8.2 翻牌动画

```tsx
// components/Animations/CardReveal.tsx

export function CardRevealAnimation({ 
  cards, 
  phase 
}: { cards: Card[]; phase: GamePhase }) {
  const revealSequence = {
    flop: [0, 1, 2],
    turn: [3],
    river: [4],
  };
  
  const indices = revealSequence[phase as keyof typeof revealSequence] || [];
  
  return (
    <>
      {indices.map((index, i) => (
        <motion.div
          key={index}
          initial={{ 
            rotateY: 180, 
            scale: 0.5, 
            y: -100,
            opacity: 0 
          }}
          animate={{ 
            rotateY: 0, 
            scale: 1, 
            y: 0,
            opacity: 1 
          }}
          transition={{ 
            duration: 0.6, 
            delay: i * 0.3,
            type: 'spring',
            stiffness: 200
          }}
        >
          <Card card={cards[index]} />
        </motion.div>
      ))}
    </>
  );
}
```

### 8.3 胜利动画

```tsx
// components/Animations/WinnerCelebration.tsx

export function WinnerCelebration({ winner, amount }: { 
  winner: Player; 
  amount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    >
      {/* 烟花粒子 */}
      <Confetti
        width={window.innerWidth}
        height={window.innerHeight}
        recycle={false}
        numberOfPieces={200}
      />
      
      <motion.div
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl p-8 text-center shadow-2xl"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-6xl mb-4"
        >
          🏆
        </motion.div>
        
        <h2 className="text-3xl font-bold text-white mb-2">
          {winner.avatar} {winner.name} 获胜!
        </h2>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-5xl font-bold text-white"
        >
          +${amount}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
```

---

## 9. 目录结构

```
src/
├── components/
│   ├── PokerTable/
│   │   ├── index.tsx
│   │   ├── Card.tsx
│   │   ├── CommunityCards.tsx
│   │   ├── PlayerSeat.tsx
│   │   ├── ChipStack.tsx
│   │   ├── PotDisplay.tsx
│   │   └── DealerButton.tsx
│   ├── AIThoughts/
│   │   ├── ThinkingBubble.tsx
│   │   ├── AIThoughtsPanel.tsx
│   │   └── ConfidenceMeter.tsx
│   ├── Prediction/
│   │   ├── PredictionPanel.tsx
│   │   ├── OddsOption.tsx
│   │   └── BetControls.tsx
│   ├── Animations/
│   │   ├── ChipAnimation.tsx
│   │   ├── CardReveal.tsx
│   │   └── WinnerCelebration.tsx
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── SidePanel.tsx
│   └── common/
│       ├── Button.tsx
│       └── Modal.tsx
├── pages/
│   ├── Home.tsx
│   ├── GameRoom.tsx
│   ├── History.tsx
│   └── Verify.tsx
├── stores/
│   └── gameStore.ts
├── hooks/
│   ├── useGameSocket.ts
│   └── useAnimations.ts
├── utils/
│   ├── cardHelpers.ts
│   └── formatters.ts
├── styles/
│   └── globals.css
├── App.tsx
└── main.tsx
```

---

## 10. 开发计划

| 任务 | 预计时间 | 优先级 |
|------|----------|--------|
| 项目脚手架搭建 | 1h | P0 |
| 扑克牌桌基础组件 | 4h | P0 |
| 扑克牌组件 + 翻牌动画 | 2h | P0 |
| 玩家座位组件 | 3h | P0 |
| AI 思考展示 | 3h | P0 |
| 预测市场面板 | 3h | P1 |
| WebSocket 集成 | 2h | P1 |
| 筹码/胜利动画 | 2h | P1 |
| 响应式布局 | 2h | P2 |
| 游戏回放功能 | 3h | P2 |

**总计**: 约 25 小时（3个工作日）

---

## 11. 性能优化

1. **组件记忆化**：使用 `React.memo` 避免无关重渲染
2. **动画节流**：使用 `requestAnimationFrame` 控制动画帧率
3. **懒加载**：历史记录页面使用 `React.lazy` 懒加载
4. **WebSocket 节流**：合并高频更新，批量推送
5. **图片优化**：使用 WebP 格式，预加载关键资源
