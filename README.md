# PokerMind Arena

> LLM人格对抗 + 链上可验证 + 预测市场
> “不是AI打扑克，是AI在牌桌上吵架，而每一句话都被记录在链上”

## 项目概述

PokerMind Arena 是一个面向赛道 3（智能体驱动的应用）的 AI 对战平台：
- 4 个有强人格冲突的 AI 进行 All-in/Fold 德扑对战
- 对战过程实时流式输出
- 预测市场同步参与
- 结果上链并支持可验证展示

详细架构见 [docs/00-architecture.md](docs/00-architecture.md)。

## 核心亮点

- **AI人格对抗 + 流式对话**
  [AIAgent](apps/server/src/agents/ai-agent.ts), [ResponseParser](apps/server/src/agents/response-parser.ts), [docs/02-ai-agents.md](docs/02-ai-agents.md)

- **短周期 All-in/Fold 引擎**
  [getHandNameChinese](apps/server/src/engine/evaluator.ts), [docs/01-game-engine.md](docs/01-game-engine.md)

- **链上可验证**（IPFS + keccak256 + 合约）
  [VerificationPanelData](apps/server/src/blockchain/types.ts), [verifyRoutes](apps/server/src/blockchain/routes/verify-routes.ts), [docs/03-blockchain-verification.md](docs/03-blockchain-verification.md)

- **预测市场（彩池制 + 模拟观众）**
  [PredictionMarket](apps/server/src/market/types.ts), [MarketSnapshot](apps/server/src/market/types.ts), [docs/04-prediction-market.md](docs/04-prediction-market.md)

## 目录结构

- 后端：Fastify + Socket.io
  [apps/server/src/index.ts](apps/server/src/index.ts)

- 前端：React + Tailwind + Framer Motion
  [apps/web/index.html](apps/web/index.html)
  [apps/web/src/components/Verify/VerificationBar.tsx](apps/web/src/components/Verify/VerificationBar.tsx)
  [apps/web/src/components/Verify/VerificationPanel.tsx](apps/web/src/components/Verify/VerificationPanel.tsx)

- 智能合约
  [contracts/src/GameVerifier.sol](contracts/src/GameVerifier.sol)

- 详细文档
  - [docs/00-architecture.md](docs/00-architecture.md)
  - [docs/01-game-engine.md](docs/01-game-engine.md)
  - [docs/02-ai-agents.md](docs/02-ai-agents.md)
  - [docs/03-blockchain-verification.md](docs/03-blockchain-verification.md)
  - [docs/04-prediction-market.md](docs/04-prediction-market.md)
  - [docs/05-frontend-visualization.md](docs/05-frontend-visualization.md)

## 快速开始（本地）

> 以下流程以开发环境为主，需准备 `.env`。

### 1) 后端

```bash
cd apps/server
npm install
npm run dev
```

入口：
[apps/server/src/index.ts](apps/server/src/index.ts)

### 2) 前端

```bash
cd apps/web
npm install
npm run dev
```

### 3) 合约（可选）

```bash
cd contracts
npm install
npm run test
npm run deploy
```

## 功能清单

- [x] AI 对战引擎（All-in/Fold）
- [x] AI 流式对话（SSE -> Socket）
- [x] 预测市场 + 模拟观众
- [x] IPFS + on-chain hash 验证
- [x] 验证面板 UI

## 关键接口与类型

- 预测市场核心类型
  [PredictionMarket](apps/server/src/market/types.ts), [MarketSnapshot](apps/server/src/market/types.ts)

- 链上验证数据结构
  [VerificationPanelData](apps/server/src/blockchain/types.ts)

## 测试与验证

集成测试入口：
[apps/server/src/test-modules.ts](apps/server/src/test-modules.ts)

```bash
cd apps/server
npm run test:modules
```

---

## 赛道匹配

符合赛道 3（智能体驱动的应用）：
- AI 对抗与协作
- 预测市场结合
- 可验证决策链路
- 短周期高频对局

详情见 [docs/00-architecture.md](docs/00-architecture.md)。
