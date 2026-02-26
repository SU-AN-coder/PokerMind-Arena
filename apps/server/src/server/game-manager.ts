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
  /** 观战模式：房主不参战，仅观战；开局由 4 个 AI 对战 */
  ownerId?: string;
  createdAt: number;
  status: 'waiting' | 'playing' | 'finished';
}

export interface CreateRoomOptions {
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  /** false = 观战模式：不把房主加入牌局，开局时由 4 个 AI 对战 */
  addHostAsPlayer?: boolean;
}

/**
 * 游戏房间管理器
 */
/** 观战模式默认 4 个 AI 的名称与头像 */
const AI_NAMES = ['AI 北', 'AI 东', 'AI 南', 'AI 西'];
const AI_AVATARS = ['🤖', '🎭', '👾', '🃏'];

export class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRoomMap: Map<string, string> = new Map();  // playerId -> roomId
  private ownerRoomMap: Map<string, string> = new Map();  // ownerId -> roomId（观战房主）
  private io: SocketIOServer;
  
  constructor(io: SocketIOServer) {
    this.io = io;
  }
  
  /**
   * 创建新房间
   * addHostAsPlayer === false 时为观战模式：房主不加入牌局，仅作为观众；开局时由 4 个 AI 对战
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
    
    this.bindEngineEvents(room);
    
    if (options.addHostAsPlayer !== false) {
      // 旧逻辑：房主作为玩家加入
      engine.addPlayer({
        id: options.hostId,
        name: options.hostName,
        avatar: options.hostAvatar || '🎭'
      });
      this.playerRoomMap.set(options.hostId, roomId);
    } else {
      // 观战模式：房主不加入引擎，仅记录为房主，由 socket 层加入 spectators
      room.ownerId = options.hostId;
      this.ownerRoomMap.set(options.hostId, roomId);
    }
    
    this.rooms.set(roomId, room);
    return room;
  }
  
  /**
   * 观战模式：为房间添加 4 个 AI 玩家（未接真实 AI API 时占位，后续可替换）
   */
  addFourBots(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return;
    const state = room.engine.getState();
    if (state.players.length > 0) return;
    for (let i = 0; i < 4; i++) {
      room.engine.addPlayer({
        id: `bot_${roomId}_${i}`,
        name: AI_NAMES[i] ?? `AI ${i + 1}`,
        avatar: AI_AVATARS[i] ?? '🤖',
      });
    }
  }

  /**
   * 将房间内玩家数补足到 totalCount（用于有人类玩家时补 AI）
   */
  addBotsUpTo(roomId: string, totalCount: number): void {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return;
    const state = room.engine.getState();
    const need = totalCount - state.players.length;
    for (let i = 0; i < need; i++) {
      const idx = state.players.length + i;
      room.engine.addPlayer({
        id: `bot_${roomId}_${idx}`,
        name: AI_NAMES[idx % AI_NAMES.length] ?? `AI ${idx + 1}`,
        avatar: AI_AVATARS[idx % AI_AVATARS.length] ?? '🤖',
      });
    }
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
   * @returns { success: boolean, error?: string } 失败时返回错误信息供前端展示
   */
  startGame(roomId: string, requestPlayerId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) return { success: false, error: '房间不存在' };
    
    // 检查是否是房主（第一个加入的玩家）
    const state = room.engine.getState();
    if (state.players[0]?.id !== requestPlayerId) {
      return { success: false, error: '只有房主可以开始游戏' };
    }
    
    if (state.players.length < 2) {
      return { success: false, error: '需要至少2名玩家才能开始，请等待其他玩家加入或使用「创建房间并开始」' };
    }
    
    try {
      room.status = 'playing';
      room.engine.startRound();
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : '开始游戏失败';
      return { success: false, error: msg };
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
   * 根据观战房主 ID 获取房间（房主未加入牌局时）
   */
  getRoomByOwnerId(ownerId: string): GameRoom | undefined {
    const roomId = this.ownerRoomMap.get(ownerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }
  
  /**
   * 观战模式开局：房间内 0 个真人玩家，由房主触发，添加 4 个 AI 并开始
   */
  startGameAsSpectatorRoom(roomId: string, ownerId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.ownerId !== ownerId) return { success: false, error: '只有房主可以开始游戏' };
    const state = room.engine.getState();
    if (state.players.length > 0) return { success: false, error: '该房间已有人加入，无法使用观战开局' };
    this.addFourBots(roomId);
    try {
      room.status = 'playing';
      room.engine.startRound();
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '开始游戏失败';
      return { success: false, error: msg };
    }
  }
  
  /**
   * 玩家断开连接
   */
  handleDisconnect(socket: Socket, playerId?: string): void {
    if (playerId) {
      const roomId = this.playerRoomMap.get(playerId);
      if (roomId) {
        const room = this.rooms.get(roomId);
        if (room) room.sockets.delete(playerId);
      }
      this.ownerRoomMap.delete(playerId);
    }
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
        // 通知前端当前行动玩家，否则界面不知道轮到谁、无法开始下注
        this.emitCurrentPlayer(room);
        // 若当前轮到占位 bot，自动替其出牌（未接真实 AI 时随机 allin/fold）
        this.scheduleBotTurnIfNeeded(room);
      });
    }
  }
  
  /**
   * 向房间广播「当前行动玩家」，前端据此显示轮到谁并允许操作
   */
  private emitCurrentPlayer(room: GameRoom): void {
    const current = room.engine.getCurrentPlayer();
    if (!current) return;
    const state = room.engine.getState();
    const playerIndex = state.players.findIndex((p) => p.id === current.id);
    if (playerIndex < 0) return;
    this.io.to(room.id).emit('current_player', {
      playerId: current.id,
      playerIndex,
    });
  }
  
  /**
   * 若当前行动者是 bot_ 开头且无真人 socket，则延迟后替其执行一次 allin（占位简化）
   */
  private scheduleBotTurnIfNeeded(room: GameRoom): void {
    const current = room.engine.getCurrentPlayer();
    if (!current || !current.id.startsWith('bot_')) return;
    if (room.sockets.has(current.id)) return; // 有真人 socket 则不代发
    setTimeout(() => {
      this.executeAction(room.id, current.id, 'allin');
    }, 1500);
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
      dealerIndex: state.dealerIndex ?? 0,
      smallBlind: room.engine.getConfig().smallBlind ?? 10,
      bigBlind: room.engine.getConfig().bigBlind ?? 20,
      communityCards: state.communityCards,
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        chips: p.chips,
        status: p.status,
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
  dealerIndex?: number;
  smallBlind?: number;
  bigBlind?: number;
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
