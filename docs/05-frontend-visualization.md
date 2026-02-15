# 模块五：前端可视化界面（最终版）

> **状态**: 最终版 v2.0 | **优先级**: P0 | **预计时间**: 12h

## 🎯 设计目标：ESPN式"God View"直播体验

> **参考**: ESPN扑克锦标赛直播，可以看到所有人的底牌

### 核心体验

| 特性 | 效果 | 优先级 |
|------|------|--------|
| 🎴 全透明底牌 | 观众能看到所有AI的手牌 | P0 |
| 💬 实时对话流 | 打字机效果的AI互怼 | P0 |
| 🎲 投注面板 | 一键下注预测获胜者 | P0 |
| ✅ 验证面板 | 展示链上可验证流程 | P0 |
| 📊 赔率显示 | 实时赔率变化 | P1 |

---

## 1. 整体布局

### 1.1 桌面端布局（1440px+）

```
┌──────────────────────────────────────────────────────────────────────┐
│  🃏 PokerMind Arena    ┃  Round 3 of 5  ┃  ⏱ 00:47  ┃  🔗 Verified  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │    🔥 火焰                              🧊 冰山              │   │
│   │    A♠ K♥                               Q♦ Q♣               │   │
│   │    $800  [ALL-IN]                      $1200               │   │
│   │                                                             │   │
│   │                   ┌─────────────────┐                       │   │
│   │                   │    J♠ 10♥ 9♣    │                       │   │
│   │                   │     POT $450    │                       │   │
│   │                   └─────────────────┘                       │   │
│   │                                                             │   │
│   │    🎭 诡影                              🧠 逻辑              │   │
│   │    8♠ 8♥                               A♦ J♦               │   │
│   │    [FOLD]                              $950                │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
├─────────────────────────┬────────────────────────────────────────────┤
│                         │                                            │
│   💬 AI 对话            │   🎲 预测市场                              │
│   ──────────────────    │   ──────────────────                       │
│   🔥 火焰: @冰山 又缩了 │   谁会赢得这场比赛？                       │
│             ？来啊！▊   │                                            │
│                         │   🔥 火焰  [====   ] 45% | 1.8x           │
│   🧊 冰山: 冲动的代价.. │   🧊 冰山  [===    ] 35% | 2.4x           │
│                         │   🎭 诡影  [=      ] 12% | 6.5x           │
│   🎭 诡影: Fold...      │   🧠 逻辑  [=      ]  8% | 9.2x           │
│                         │                                            │
│                         │   [10] [25] [50] [100]                     │
│                         │   [✓ 下注火焰 $50]                         │
│                         │                                            │
│                         │   总池: $2,150  |  87人参与                │
├─────────────────────────┴────────────────────────────────────────────┤
│  🔗 验证: Game #0x3f2a.. committed to Monad | View TX | IPFS | ✅    │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 组件结构

```
<App>
├── <Header />
│   ├── <Logo />
│   ├── <RoundIndicator />
│   ├── <Timer />
│   └── <VerificationBadge />
│
├── <GameRoom>
│   ├── <PokerTable>
│   │   ├── <PlayerSeat /> x 4
│   │   │   ├── <Avatar />
│   │   │   ├── <HoleCards />  ← ESPN式全透明
│   │   │   ├── <ChipStack />
│   │   │   └── <ActionBadge />
│   │   │
│   │   ├── <CommunityCards />
│   │   └── <PotDisplay />
│   │
│   ├── <BottomPanel>
│   │   ├── <DialogueStream />  ← 打字机效果
│   │   └── <BettingPanel />    ← 预测市场
│   │
│   └── <VerificationBar />     ← 链上验证状态
│
└── <GameEndModal />            ← 结算 + 验证入口
```

---

## 2. 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 框架 | React 18 | 生态成熟 |
| 状态 | Zustand | 轻量简洁 |
| 动画 | Framer Motion | 声明式、性能好 |
| 样式 | Tailwind CSS | 快速开发 |
| 实时 | Socket.io | 双向通信 |
| 构建 | Vite | 快速热更新 |

---

## 3. 核心组件

### 3.1 牌桌组件（God View）

```tsx
// components/Table/PokerTable.tsx
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/game';
import { PlayerSeat } from './PlayerSeat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';

const SEAT_POSITIONS = [
  { x: '15%', y: '15%' },   // 左上 - 火焰
  { x: '85%', y: '15%' },   // 右上 - 冰山
  { x: '15%', y: '75%' },   // 左下 - 诡影
  { x: '85%', y: '75%' },   // 右下 - 逻辑
];

export function PokerTable() {
  const players = useGameStore(s => s.players);
  const communityCards = useGameStore(s => s.communityCards);
  const pot = useGameStore(s => s.pot);
  const activePlayerId = useGameStore(s => s.activePlayerId);
  
  return (
    <div className="relative w-full h-[500px] bg-gradient-to-b from-green-800 to-green-900 rounded-3xl border-4 border-amber-700 shadow-2xl">
      
      {/* 公共牌区域 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <CommunityCards cards={communityCards} />
        <PotDisplay pot={pot} />
      </div>
      
      {/* 玩家座位 */}
      {players.map((player, index) => (
        <PlayerSeat
          key={player.id}
          player={player}
          position={SEAT_POSITIONS[index]}
          isActive={player.id === activePlayerId}
        />
      ))}
    </div>
  );
}
```

### 3.2 玩家座位（含底牌展示）

```tsx
// components/Table/PlayerSeat.tsx
import { motion } from 'framer-motion';
import { PlayingCard } from './PlayingCard';

interface PlayerSeatProps {
  player: {
    id: string;
    name: string;
    avatar: string;
    holeCards: [string, string];  // ["A♠", "K♥"]
    stack: number;
    status: 'active' | 'allin' | 'folded' | 'eliminated';
    lastAction?: string;
  };
  position: { x: string; y: string };
  isActive: boolean;
}

export function PlayerSeat({ player, position, isActive }: PlayerSeatProps) {
  const isFolded = player.status === 'folded';
  const isEliminated = player.status === 'eliminated';
  
  return (
    <motion.div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: position.x, top: position.y }}
      animate={{ 
        scale: isActive ? 1.05 : 1,
        opacity: isEliminated ? 0.4 : 1
      }}
    >
      <div className={`flex flex-col items-center p-3 rounded-xl
        ${isActive ? 'bg-yellow-500/30 ring-2 ring-yellow-400' : 'bg-black/40'}
        ${isFolded ? 'opacity-60' : ''}
      `}>
        
        {/* 头像 + 名字 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-3xl">{player.avatar}</span>
          <span className="text-white font-bold">{player.name}</span>
        </div>
        
        {/* 🔑 核心：底牌展示（ESPN风格） */}
        <div className="flex gap-1 mb-2">
          <PlayingCard card={player.holeCards[0]} faded={isFolded} />
          <PlayingCard card={player.holeCards[1]} faded={isFolded} />
        </div>
        
        {/* 筹码 */}
        <div className="text-yellow-400 font-bold text-lg">
          ${player.stack.toLocaleString()}
        </div>
        
        {/* 行动标签 */}
        {player.status === 'allin' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-1 px-3 py-1 bg-red-600 rounded-full text-white text-sm font-bold"
          >
            ALL-IN
          </motion.div>
        )}
        {isFolded && (
          <div className="mt-1 px-3 py-1 bg-gray-600 rounded-full text-gray-300 text-sm">
            FOLD
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

### 3.3 扑克牌组件

```tsx
// components/Table/PlayingCard.tsx
import { motion } from 'framer-motion';

interface PlayingCardProps {
  card: string;  // "A♠", "K♥", "10♦", "J♣"
  faded?: boolean;
  delay?: number;
}

const SUIT_COLORS: Record<string, string> = {
  '♠': 'text-gray-900',
  '♣': 'text-gray-900', 
  '♥': 'text-red-600',
  '♦': 'text-red-600',
};

export function PlayingCard({ card, faded = false, delay = 0 }: PlayingCardProps) {
  // 解析牌面："A♠" → rank="A", suit="♠"
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: faded ? 0.5 : 1 }}
      transition={{ duration: 0.4, delay }}
      className={`w-12 h-16 bg-white rounded-lg shadow-lg flex flex-col items-center justify-center
        ${faded ? 'grayscale' : ''}
      `}
    >
      <span className={`text-lg font-bold ${SUIT_COLORS[suit]}`}>{rank}</span>
      <span className={`text-xl ${SUIT_COLORS[suit]}`}>{suit}</span>
    </motion.div>
  );
}
```

### 3.4 公共牌

```tsx
// components/Table/CommunityCards.tsx
import { PlayingCard } from './PlayingCard';

export function CommunityCards({ cards }: { cards: string[] }) {
  return (
    <div className="flex gap-2 justify-center mb-2">
      {cards.map((card, i) => (
        <PlayingCard key={i} card={card} delay={i * 0.2} />
      ))}
      
      {/* 空位占位符 */}
      {[...Array(5 - cards.length)].map((_, i) => (
        <div 
          key={`empty-${i}`}
          className="w-12 h-16 rounded-lg border-2 border-dashed border-green-600/50"
        />
      ))}
    </div>
  );
}
```

---

## 4. 对话流组件（打字机效果）

### 4.1 对话流

```tsx
// components/Dialogue/DialogueStream.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/game';
import { SpeechBubble } from './SpeechBubble';

export function DialogueStream() {
  const messages = useGameStore(s => s.dialogue);
  const typingAgent = useGameStore(s => s.typingAgent);
  const typingText = useGameStore(s => s.typingText);
  
  return (
    <div className="h-[200px] overflow-y-auto space-y-2 p-3 bg-gray-900/50 rounded-xl">
      <h3 className="text-sm font-bold text-gray-400 mb-2">💬 AI 对话</h3>
      
      <AnimatePresence>
        {messages.slice(-5).map((msg, i) => (
          <SpeechBubble
            key={i}
            avatar={msg.avatar}
            name={msg.name}
            text={msg.speech}
            target={msg.target}
            emotion={msg.emotion}
            isTyping={false}
          />
        ))}
      </AnimatePresence>
      
      {/* 正在打字的消息 */}
      {typingAgent && (
        <SpeechBubble
          avatar={typingAgent.avatar}
          name={typingAgent.name}
          text={typingText}
          isTyping={true}
        />
      )}
    </div>
  );
}
```

### 4.2 对话气泡

```tsx
// components/Dialogue/SpeechBubble.tsx
import { motion } from 'framer-motion';

interface SpeechBubbleProps {
  avatar: string;
  name: string;
  text: string;
  target?: string;
  emotion?: string;
  isTyping: boolean;
}

const EMOTION_COLORS: Record<string, string> = {
  confident: 'border-l-yellow-500',
  angry: 'border-l-red-500',
  mocking: 'border-l-purple-500',
  nervous: 'border-l-gray-400',
  neutral: 'border-l-blue-500',
};

export function SpeechBubble({ avatar, name, text, target, emotion = 'neutral', isTyping }: SpeechBubbleProps) {
  // 高亮@提及
  const highlightedText = text.replace(
    /@(\S+)/g,
    '<span class="text-blue-400 font-bold">@$1</span>'
  );
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex gap-2 p-2 bg-gray-800/80 rounded-lg border-l-4 ${EMOTION_COLORS[emotion]}`}
    >
      <span className="text-2xl">{avatar}</span>
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-white text-sm">{name}</span>
          {target && (
            <span className="text-xs text-blue-400">→ @{target}</span>
          )}
        </div>
        
        <p 
          className="text-gray-200 text-sm"
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
        
        {isTyping && (
          <span className="inline-block w-2 h-4 bg-white ml-0.5 animate-pulse" />
        )}
      </div>
    </motion.div>
  );
}
```

---

## 5. 验证面板组件 🆕

### 5.1 验证状态栏

```tsx
// components/Verify/VerificationBar.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/game';

export function VerificationBar() {
  const verification = useGameStore(s => s.verification);
  const [expanded, setExpanded] = useState(false);
  
  if (!verification) {
    return (
      <div className="bg-gray-800 p-2 rounded-lg text-center text-gray-500 text-sm">
        🔗 等待游戏结束后链上存证...
      </div>
    );
  }
  
  return (
    <motion.div
      layout
      className="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg border border-green-500/30 overflow-hidden"
    >
      {/* 简洁视图 */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-green-400">✅</span>
          <span className="text-white text-sm">
            Game #{verification.gameId.slice(0, 8)}... committed to Monad
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          <a 
            href={verification.explorerUrl}
            target="_blank"
            className="text-blue-400 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            View TX
          </a>
          <a 
            href={`https://w3s.link/ipfs/${verification.ipfsCid}`}
            target="_blank"
            className="text-purple-400 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            IPFS
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-yellow-400 hover:text-yellow-300"
          >
            🔍 Verify
          </button>
        </div>
      </div>
      
      {/* 展开的验证面板 */}
      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          className="border-t border-green-500/30 p-4"
        >
          <VerificationPanel verification={verification} />
        </motion.div>
      )}
    </motion.div>
  );
}
```

### 5.2 验证演示面板

```tsx
// components/Verify/VerificationPanel.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { keccak256, toUtf8Bytes } from 'ethers';

interface VerificationPanelProps {
  verification: {
    gameId: string;
    ipfsCid: string;
    onChainHash: string;
    explorerUrl: string;
  };
}

type VerifyStep = 'idle' | 'fetching' | 'computing' | 'comparing' | 'done';

export function VerificationPanel({ verification }: VerificationPanelProps) {
  const [step, setStep] = useState<VerifyStep>('idle');
  const [rawData, setRawData] = useState<string>('');
  const [computedHash, setComputedHash] = useState<string>('');
  const [isMatch, setIsMatch] = useState<boolean | null>(null);
  
  const runVerification = async () => {
    // Step 1: 从IPFS获取
    setStep('fetching');
    const response = await fetch(`https://w3s.link/ipfs/${verification.ipfsCid}`);
    const data = await response.text();
    setRawData(data.slice(0, 200) + '...');
    
    // Step 2: 计算哈希
    await sleep(600);
    setStep('computing');
    const hash = keccak256(toUtf8Bytes(data));
    setComputedHash(hash);
    
    // Step 3: 比对
    await sleep(600);
    setStep('comparing');
    const matched = hash.toLowerCase() === verification.onChainHash.toLowerCase();
    setIsMatch(matched);
    
    await sleep(400);
    setStep('done');
  };
  
  return (
    <div className="space-y-4">
      {step === 'idle' && (
        <button
          onClick={runVerification}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 
                     rounded-lg font-bold text-white
                     hover:from-blue-500 hover:to-purple-500"
        >
          🔍 开始验证数据完整性
        </button>
      )}
      
      {step !== 'idle' && (
        <div className="space-y-3">
          <StepIndicator 
            label="1. 从 IPFS 获取原始数据"
            status={step === 'fetching' ? 'loading' : 'done'}
          />
          
          <StepIndicator 
            label="2. 本地计算 keccak256 哈希"
            status={step === 'fetching' ? 'pending' : step === 'computing' ? 'loading' : 'done'}
          />
          
          <StepIndicator 
            label="3. 与链上哈希比对"
            status={['fetching', 'computing'].includes(step) ? 'pending' : step === 'comparing' ? 'loading' : 'done'}
          />
          
          {step === 'done' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`p-4 rounded-lg text-center ${
                isMatch 
                  ? 'bg-green-900/50 border border-green-500' 
                  : 'bg-red-900/50 border border-red-500'
              }`}
            >
              <div className="text-4xl mb-2">{isMatch ? '✅' : '❌'}</div>
              <div className={`font-bold ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
                {isMatch ? '验证通过！数据完整未篡改' : '验证失败！数据可能被篡改'}
              </div>
              
              <div className="mt-3 text-xs font-mono text-left space-y-1">
                <div>
                  <span className="text-gray-500">链上: </span>
                  <span className="text-blue-400 break-all">{verification.onChainHash}</span>
                </div>
                <div>
                  <span className="text-gray-500">计算: </span>
                  <span className={`break-all ${isMatch ? 'text-green-400' : 'text-red-400'}`}>
                    {computedHash}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ label, status }: { label: string; status: 'pending' | 'loading' | 'done' }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {status === 'pending' && <span className="text-gray-500">○</span>}
      {status === 'loading' && (
        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          ◐
        </motion.span>
      )}
      {status === 'done' && <span className="text-green-400">✓</span>}
      <span className={status === 'pending' ? 'text-gray-500' : 'text-white'}>{label}</span>
    </div>
  );
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
```

---

## 6. 状态管理（Zustand）

```typescript
// stores/game.ts
import { create } from 'zustand';

interface Player {
  id: string;
  name: string;
  avatar: string;
  holeCards: [string, string];
  stack: number;
  status: 'active' | 'allin' | 'folded' | 'eliminated';
}

interface DialogueMessage {
  name: string;
  avatar: string;
  speech: string;
  emotion: string;
  target?: string;
}

interface VerificationData {
  gameId: string;
  ipfsCid: string;
  onChainHash: string;
  explorerUrl: string;
  txHash: string;
}

interface GameState {
  // 游戏状态
  gameId: string | null;
  phase: 'waiting' | 'playing' | 'showdown' | 'ended';
  round: number;
  players: Player[];
  communityCards: string[];
  pot: number;
  activePlayerId: string | null;
  
  // 对话
  dialogue: DialogueMessage[];
  typingAgent: { name: string; avatar: string } | null;
  typingText: string;
  
  // 验证
  verification: VerificationData | null;
  
  // Actions
  setGameState: (state: Partial<GameState>) => void;
  addDialogue: (msg: DialogueMessage) => void;
  setTyping: (agent: { name: string; avatar: string } | null, text?: string) => void;
  appendTypingText: (chunk: string) => void;
  setVerification: (data: VerificationData) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  gameId: null,
  phase: 'waiting',
  round: 1,
  players: [],
  communityCards: [],
  pot: 0,
  activePlayerId: null,
  dialogue: [],
  typingAgent: null,
  typingText: '',
  verification: null,
  
  setGameState: (state) => set(state),
  
  addDialogue: (msg) => set(s => ({
    dialogue: [...s.dialogue.slice(-20), msg]  // 保留最近20条
  })),
  
  setTyping: (agent, text = '') => set({ typingAgent: agent, typingText: text }),
  
  appendTypingText: (chunk) => set(s => ({
    typingText: s.typingText + chunk
  })),
  
  setVerification: (data) => set({ verification: data }),
  
  reset: () => set({
    gameId: null,
    phase: 'waiting',
    round: 1,
    players: [],
    communityCards: [],
    pot: 0,
    activePlayerId: null,
    dialogue: [],
    typingAgent: null,
    typingText: '',
    verification: null,
  }),
}));
```

---

## 7. Socket.io 集成

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/stores/game';

let socket: Socket;

export function initSocket(serverUrl: string) {
  socket = io(serverUrl);
  
  // 游戏状态更新
  socket.on('game_state', (state) => {
    useGameStore.getState().setGameState(state);
  });
  
  // AI开始思考
  socket.on('ai_thinking', (data) => {
    useGameStore.getState().setTyping({
      name: data.agentName,
      avatar: data.avatar
    });
  });
  
  // AI对话流式输出
  socket.on('ai_speech_chunk', (data) => {
    useGameStore.getState().appendTypingText(data.chunk);
  });
  
  // AI决策完成
  socket.on('ai_decision', (data) => {
    const store = useGameStore.getState();
    
    // 完成打字
    store.setTyping(null);
    
    // 添加完整消息
    store.addDialogue({
      name: data.agentName,
      avatar: data.avatar,
      speech: data.speech,
      emotion: data.emotion,
      target: data.target
    });
  });
  
  // 链上验证完成
  socket.on('game_committed', (data) => {
    useGameStore.getState().setVerification(data);
  });
  
  return socket;
}

export function joinGame(gameId: string) {
  socket.emit('join_game', gameId);
}

export function placeBet(gameId: string, aiId: string, amount: number) {
  socket.emit('place_bet', { gameId, aiId, amount });
}
```

---

## 8. 目录结构

```
src/
├── components/
│   ├── Table/
│   │   ├── PokerTable.tsx
│   │   ├── PlayerSeat.tsx
│   │   ├── PlayingCard.tsx
│   │   ├── CommunityCards.tsx
│   │   └── PotDisplay.tsx
│   ├── Dialogue/
│   │   ├── DialogueStream.tsx
│   │   └── SpeechBubble.tsx
│   ├── Market/
│   │   ├── BettingPanel.tsx
│   │   └── LiveBetFeed.tsx
│   ├── Verify/
│   │   ├── VerificationBar.tsx
│   │   └── VerificationPanel.tsx
│   └── Layout/
│       ├── Header.tsx
│       └── GameRoom.tsx
├── stores/
│   └── game.ts
├── lib/
│   └── socket.ts
├── pages/
│   ├── index.tsx         # 首页/大厅
│   └── game/[id].tsx     # 游戏房间
└── styles/
    └── globals.css
```

---

## 9. 开发计划

| 任务 | 时间 | 优先级 |
|------|------|--------|
| PokerTable + PlayerSeat | 3h | P0 |
| PlayingCard + 动画 | 2h | P0 |
| DialogueStream 打字机 | 2h | P0 |
| VerificationPanel | 2h | P0 |
| BettingPanel | 2h | P1 |
| Socket.io 集成 | 1h | P0 |

**总计**: 12h

---

## 10. 演示话术

> "这是我们的观战界面——ESPN式的'上帝视角'。
>
> 你可以看到每个AI的底牌：火焰拿着A♠ K♥，冰山是一对Q...
>
> **[指向对话区]**
> 这里是AI之间的实时对话。注意看，火焰正在打字...
>
> '@ 冰山 又缩了？' —— 每条消息都是流式输出的，像真人在打字。
>
> **[指向验证栏]**
> 游戏结束后，所有数据会被上传到IPFS，哈希值写入Monad链。
>
> 点击'Verify'按钮，我们可以现场演示验证流程——
> 从IPFS下载数据，本地计算哈希，与链上比对...
>
> ✅ 验证通过！这证明了AI决策过程的不可篡改性。"
