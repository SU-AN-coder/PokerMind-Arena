/**
 * PokerMind Arena - 游戏房间管理器
 * 
 * 管理多个游戏实例，处理玩家连接和房间分配
 */

import type { Server as SocketIOServer, Socket } from 'socket.io';
import { PokerGameEngine, GameState, PlayerInput } from '../engine/index.js';

export interface GameRoom {
  id: string;
  engine: PokerGameEngine;
  sockets: Map<string, Socket>;  // playerId -> socket
  spectators: Set<Socket>;
  createdAt: number;
  status: 'waiting' | 'playing' | 'finished';
}

export interface CreateRoomOptions {
  hostId: string;
  hostName: string;
  hostAvatar?: string;
}

/**
 * 游戏房间管理器
 */
export class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRoomMap: Map<string, string> = new Map();  // playerId -> roomId
  private io: SocketIOServer;
  
  constructor(io: SocketIOServer) {
    this.io = io;
  }
  
  /**
   * 创建新房间
   */
  createRoom(options: CreateRoomOptions): GameRoom {
    const engine = new PokerGameEngine();
    const roomId = engine.getGameId();
    
    const room: GameRoom = {
      id: roomId,
      engine,
      sockets: new Map(),
      spectators: new Set(),
      createdAt: Date.now(),
      status: 'waiting'
    };
    
    // 绑定引擎事件到 Socket.IO
    this.bindEngineEvents(room);
    
    // 房主自动加入
    engine.addPlayer({
      id: options.hostId,
      name: options.hostName,
      avatar: options.hostAvatar || '🎭'
    });
    
    this.rooms.set(roomId, room);
    this.playerRoomMap.set(options.hostId, roomId);
    
    return room;
  }
  
  /**
   * 加入房间
   */
  joinRoom(
    roomId: string, 
    socket: Socket, 
    playerInput: PlayerInput
  ): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return false;
    }
    
    if (room.status !== 'waiting') {
      socket.emit('error', { message: '游戏已开始' });
      return false;
    }
    
    try {
      room.engine.addPlayer(playerInput);
      room.sockets.set(playerInput.id, socket);
      this.playerRoomMap.set(playerInput.id, roomId);
      
      socket.join(roomId);
      
      // 广播玩家加入事件
      this.io.to(roomId).emit('player_joined', {
        id: playerInput.id,
        name: playerInput.name,
        avatar: playerInput.avatar
      });
      
      // 发送当前游戏状态
      socket.emit('game_state', this.getPublicState(room));
      
      return true;
    } catch (error) {
      socket.emit('error', { 
        message: error instanceof Error ? error.message : '加入失败' 
      });
      return false;
    }
  }
  
  /**
   * 作为观众加入房间
   */
  joinAsSpectator(roomId: string, socket: Socket): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return false;
    }
    
    room.spectators.add(socket);
    socket.join(roomId);
    socket.emit('game_state', this.getPublicState(room));
    
    return true;
  }
  
  /**
   * 开始游戏
   */
  startGame(roomId: string, requestPlayerId: string): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) return false;
    
    // 检查是否是房主（第一个加入的玩家）
    const state = room.engine.getState();
    if (state.players[0]?.id !== requestPlayerId) {
      return false;
    }
    
    try {
      room.status = 'playing';
      room.engine.startRound();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 执行玩家动作
   */
  executeAction(
    roomId: string, 
    playerId: string, 
    action: 'allin' | 'fold',
    speech?: string,
    decisionHash?: string
  ): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) return false;
    
    try {
      room.engine.executeAction({
        playerId,
        action,
        timestamp: Date.now(),
        speech,
        decisionHash
      });
      return true;
    } catch (error) {
      const socket = room.sockets.get(playerId);
      socket?.emit('error', { 
        message: error instanceof Error ? error.message : '动作执行失败' 
      });
      return false;
    }
  }
  
  /**
   * 开始下一轮
   */
  nextRound(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) return false;
    
    try {
      room.engine.startRound();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 获取房间
   */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }
  
  /**
   * 根据玩家ID获取房间
   */
  getRoomByPlayerId(playerId: string): GameRoom | undefined {
    const roomId = this.playerRoomMap.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }
  
  /**
   * 玩家断开连接
   */
  handleDisconnect(socket: Socket, playerId?: string): void {
    if (playerId) {
      const roomId = this.playerRoomMap.get(playerId);
      if (roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
          room.sockets.delete(playerId);
          // 在实际应用中，可能需要处理断线重连逻辑
        }
      }
    }
    
    // 移除观众
    for (const room of this.rooms.values()) {
      room.spectators.delete(socket);
    }
  }
  
  /**
   * 绑定引擎事件到 Socket.IO
   */
  private bindEngineEvents(room: GameRoom): void {
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
    
    for (const event of events) {
      room.engine.on(event as any, (data: any) => {
        // 广播到房间内所有人
        this.io.to(room.id).emit(event, data);
        
        // 更新房间状态
        if (event === 'game_ended') {
          room.status = 'finished';
        }
      });
    }
  }
  
  /**
   * 获取公开状态（隐藏其他玩家手牌）
   */
  private getPublicState(room: GameRoom): PublicGameState {
    const state = room.engine.getState();
    
    return {
      gameId: state.gameId,
      phase: state.phase,
      round: state.round,
      pot: state.pot,
      communityCards: state.communityCards,
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        chips: p.chips,
        status: p.status,
        // 手牌在公开状态中不暴露
        hasCards: p.holeCards[0] !== ''
      }))
    };
  }
  
  /**
   * 清理过期房间（超过2小时未活动）
   */
  cleanupStaleRooms(): void {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    
    for (const [roomId, room] of this.rooms) {
      if (room.createdAt < twoHoursAgo && room.status === 'finished') {
        // 清理玩家映射
        for (const playerId of room.sockets.keys()) {
          this.playerRoomMap.delete(playerId);
        }
        this.rooms.delete(roomId);
      }
    }
  }
  
  /**
   * 获取所有等待中的房间（用于大厅展示）
   */
  getWaitingRooms(): Array<{
    id: string;
    playerCount: number;
    createdAt: number;
  }> {
    const waitingRooms = [];
    
    for (const room of this.rooms.values()) {
      if (room.status === 'waiting') {
        waitingRooms.push({
          id: room.id,
          playerCount: room.engine.getState().players.length,
          createdAt: room.createdAt
        });
      }
    }
    
    return waitingRooms;
  }
}

// ============ 类型定义 ============

interface PublicGameState {
  gameId: string;
  phase: string;
  round: number;
  pot: number;
  communityCards: string[];
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    chips: number;
    status: string;
    hasCards: boolean;
  }>;
}
