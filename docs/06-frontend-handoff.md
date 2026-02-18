# 前端交接说明（PokerMind Arena）

这份文档给前端同学快速了解当前前端已接入的功能、数据流与可改动的地方。

## 我已经完成的内容

- **前后端 Socket 事件接入**
  前端已通过 Socket.io 监听游戏、对话、市场、验证相关事件，并写入 Zustand store。

- **基础 UI 布局**
  已有简单版页面结构：Poker 桌面 + AI 对话 + 预测市场 + 验证栏。

- **核心功能串通**
  包含：AI 对话流式显示、牌局变化、实时下注流、链上验证面板（IPFS 拉取 + hash 比对）。

## 运行方式

```bash
cd apps/web
npm install
npm run dev
```

环境变量（可选）：
```
VITE_SERVER_URL=http://localhost:3001
```

默认会读取 `gameId`：
- URL query 参数 `gameId`
- 没有参数时使用 `demo-game-001`

## 当前数据流（关键）

入口：`App` -> `initSocket()` + `joinGame(gameId)`

Socket 事件与作用（见 `src/lib/socket.ts`）：
- `game_state`：全量状态初始化
- `round_started`：更新回合、底池、玩家
- `cards_dealt`：发手牌
- `community_cards`：公共牌
- `player_allin` / `player_fold`：更新玩家状态
- `ai_thinking`：进入打字态
- `ai_speech_chunk`：流式更新文本
- `ai_decision`：落地一条完整对话
- `market_snapshot` / `market_update`：预测市场快照/更新
- `new_bet`：实时下注流
- `game_committed`：链上存证信息

下注事件：
- 前端调用 `placeBet(gameId, aiId, amount)`
- 会发 `place_bet`，并存一个 `odUserId` 到 `localStorage`

## 主要组件说明

布局入口：
- `App`：初始化 socket + 读取 gameId
- `GameRoom`：组合桌面/对话/市场/验证

对话区：
- `DialogueStream`：展示最近 10 条 AI 发言 + 打字流
- `SpeechBubble`：根据 emotion 做边框颜色

牌桌区：
- `PokerTable`：固定 4 人座位布局
- `PlayerSeat`：玩家头像 + 手牌 + 筹码
- `CommunityCards`：公共牌
- `PlayingCard`：卡牌渲染

市场区：
- `BettingPanel`：下注按钮 + 赔率
- `LiveBetFeed`：滚动下注流

验证区：
- `VerificationBar`：是否已上链
- `VerificationPanel`：从 IPFS 拉取文本 -> 本地 keccak256 -> 与链上 hash 对比

## 状态存储（Zustand）

Store 统一在 `src/stores/game.ts`：
- `players`, `pot`, `communityCards`, `round`
- `dialogue`, `typingAgent`, `typingText`
- `market`, `liveBets`
- `verification`

## 样式与主题

- 当前是 Tailwind + 极简灰绿风格
- `panel` 公共容器样式在 `src/styles/globals.css`

可以直接替换：
- 背景层级（桌面、对话、市场、验证）
- 卡牌 UI（建议使用统一卡牌素材或 SVG）
- 动画节奏（对话流、下注流、牌面翻转）

## 你可以怎么改（建议方向）

1. **整体视觉升级**
   - 增强舞台感：桌面、灯光、围观氛围
   - 强化品牌：Logo、标题区、主视觉色

2. **信息层级优化**
   - 对话区可以支持情绪 icon / 头像光效
   - 下注区可以显示胜率趋势 / 资金热度

3. **观赛体验**
   - 新增时间轴或回合状态条
   - 增加“高潮时刻”提示（All-in/Showdown）

4. **验证流程 UI**
   - 验证步骤加入进度条和状态 icon
   - 增加“打开区块浏览器”按钮

5. **移动端适配**
   - 牌桌 + 对话 + 市场可折叠
   - 下方固定操作栏

## 重要注意事项

- 目前前端完全依赖 socket 推送，没有 REST 拉取
- UI 还很“工程样板”，所有视觉方向可自由重做
- 若要改数据结构，请先看 `src/types/game.ts`

---

如果你需要我补充接口文档或设计草图，我可以继续整理。
