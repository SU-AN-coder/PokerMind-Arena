/**
 * PokerMind Arena - 服务器入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createGameServer } from './server/socket-handlers/game.js';

// 模块导出
export * from './engine/index.js';
export * from './agents/index.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  // 创建 Fastify 实例
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    }
  });
  
  // 注册 CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });
  
  // 健康检查接口
  app.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });
  
  // API 信息接口
  app.get('/api', async () => {
    return {
      name: 'PokerMind Arena Server',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        websocket: `ws://localhost:${PORT}`
      }
    };
  });
  
  // 获取 HTTP Server
  await app.ready();
  const httpServer = app.server;
  
  // 创建游戏 Socket.IO 服务器
  const { io, roomManager } = createGameServer(httpServer);
  
  // 启动服务器
  await app.listen({ port: PORT, host: HOST });
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🃏 PokerMind Arena Server                               ║
║                                                           ║
║   HTTP:      http://${HOST}:${PORT}                          ║
║   WebSocket: ws://${HOST}:${PORT}                            ║
║                                                           ║
║   Ready to accept connections...                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // 优雅关闭
  const shutdown = async () => {
    console.log('\nShutting down server...');
    io.close();
    await app.close();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
