/**
 * PokerMind Arena - Socket 事件处理器
 * 
 * 处理客户端 Socket.IO 连接和游戏事件
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { GameRoomManager } from '../game-manager.js';

interface ClientToServerEvents {
  // 房间管理
  create_room: (data: { name: string; avatar?: string }) => void;
  join_room: (data: { roomId: string; name: string; avatar?: string }) => void;
  join_as_spectator: (data: { roomId: string }) => void;
  leave_room: () => void;
  
  // 游戏控制
  start_game: () => void;
  player_action: (data: { action: 'allin' | 'fold'; speech?: string; decisionHash?: string }) => void;
  next_round: () => void;
  
  // 大厅
  get_rooms: () => void;
}

interface ServerToClientEvents {
  // 连接
  connected: (data: { playerId: string }) => void;
  error: (data: { message: string }) => void;
  
  // 房间
  room_created: (data: { roomId: string }) => void;
  room_joined: (data: { roomId: string }) => void;
  rooms_list: (data: Array<{ id: string; playerCount: number }>) => void;
  
  // 游戏事件（由引擎触发）
  player_joined: (data: any) => void;
  game_state: (data: any) => void;
  round_started: (data: any) => void;
  cards_dealt: (data: any) => void;
  community_cards: (data: any) => void;
  player_allin: (data: any) => void;
  player_fold: (data: any) => void;
  phase_changed: (data: any) => void;
  showdown: (data: any) => void;
  round_ended: (data: any) => void;
  game_ended: (data: any) => void;
}

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

/**
 * 设置游戏 Socket 处理器
 */
export function setupGameSocketHandlers(
  io: TypedServer, 
  roomManager: GameRoomManager
): void {
  // 玩家ID映射（简化实现，实际应用中应该用JWT等）
  const socketPlayerMap = new Map<string, string>();
  
  io.on('connection', (socket: TypedSocket) => {
    // 生成玩家ID
    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    socketPlayerMap.set(socket.id, playerId);
    
    socket.emit('connected', { playerId });
    
    console.log(`[Socket] Player connected: ${playerId}`);
    
    // ============ 房间管理 ============
    
    socket.on('create_room', (data: { name: string; avatar?: string }) => {
      const room = roomManager.createRoom({
        hostId: playerId,
        hostName: data.name,
        hostAvatar: data.avatar
      });
      
      room.sockets.set(playerId, socket);
      socket.join(room.id);
      
      socket.emit('room_created', { roomId: room.id });
      console.log(`[Socket] Room created: ${room.id} by ${playerId}`);
    });
    
    socket.on('join_room', (data: { roomId: string; name: string; avatar?: string }) => {
      const success = roomManager.joinRoom(data.roomId, socket, {
        id: playerId,
        name: data.name,
        avatar: data.avatar || '🎭'
      });
      
      if (success) {
        socket.emit('room_joined', { roomId: data.roomId });
        console.log(`[Socket] Player ${playerId} joined room ${data.roomId}`);
      }
    });
    
    socket.on('join_as_spectator', (data: { roomId: string }) => {
      roomManager.joinAsSpectator(data.roomId, socket);
      console.log(`[Socket] Spectator joined room ${data.roomId}`);
    });
    
    socket.on('leave_room', () => {
      const room = roomManager.getRoomByPlayerId(playerId);
      if (room) {
        socket.leave(room.id);
        console.log(`[Socket] Player ${playerId} left room ${room.id}`);
      }
    });
    
    // ============ 游戏控制 ============
    
    socket.on('start_game', () => {
      const room = roomManager.getRoomByPlayerId(playerId);
      if (room) {
        const success = roomManager.startGame(room.id, playerId);
        if (success) {
          console.log(`[Socket] Game started in room ${room.id}`);
        } else {
          socket.emit('error', { message: '只有房主可以开始游戏' });
        }
      }
    });
    
    socket.on('player_action', (data: { action: 'allin' | 'fold'; speech?: string; decisionHash?: string }) => {
      const room = roomManager.getRoomByPlayerId(playerId);
      if (room) {
        roomManager.executeAction(
          room.id, 
          playerId, 
          data.action, 
          data.speech,
          data.decisionHash
        );
        console.log(`[Socket] Player ${playerId} action: ${data.action}`);
      }
    });
    
    socket.on('next_round', () => {
      const room = roomManager.getRoomByPlayerId(playerId);
      if (room) {
        roomManager.nextRound(room.id);
        console.log(`[Socket] Next round in room ${room.id}`);
      }
    });
    
    // ============ 大厅 ============
    
    socket.on('get_rooms', () => {
      const rooms = roomManager.getWaitingRooms();
      socket.emit('rooms_list', rooms);
    });
    
    // ============ 断开连接 ============
    
    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket, playerId);
      socketPlayerMap.delete(socket.id);
      console.log(`[Socket] Player disconnected: ${playerId}`);
    });
  });
}

/**
 * 创建游戏 Socket.IO 服务器
 */
export function createGameServer(httpServer: HttpServer): {
  io: TypedServer;
  roomManager: GameRoomManager;
} {
  const io: TypedServer = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',  // 开发环境允许所有来源
      methods: ['GET', 'POST']
    }
  });
  
  const roomManager = new GameRoomManager(io);
  setupGameSocketHandlers(io, roomManager);
  
  // 定期清理过期房间
  setInterval(() => {
    roomManager.cleanupStaleRooms();
  }, 30 * 60 * 1000);  // 每30分钟
  
  return { io, roomManager };
}
