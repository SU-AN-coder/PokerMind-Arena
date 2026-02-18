/**
 * PokerMind Arena - 预测市场模块入口
 */

// 类型导出
export type {
  MarketStatus,
  MarketOption,
  PredictionMarket,
  UserBet,
  SimulatedBet,
  SimulatedBetConfig,
  SettlementResult,
  OddsInfo,
  MarketSnapshot
} from './types.js';

// 核心服务导出
export { MarketManager, marketManager } from './market-manager.js';
export { SimulatedAudienceGenerator, simulatedAudienceGenerator } from './simulated-audience.js';
export { MarketService, marketService } from './market-service.js';

// Socket 处理器导出
export { 
  registerMarketSocketHandlers,
  broadcastMarketCreated,
  broadcastMarketLocked,
  broadcastMarketResolved
} from './socket/market-socket-handlers.js';

// 路由导出
export { marketRoutes } from './routes/market-routes.js';
