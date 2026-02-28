/**
 * Socket.IO 连接后端 (PokerMind-Arena)，订阅游戏事件并驱动 setGameState。
 * 后端地址：http://localhost:3001（与后端同源时可用相对 URL）
 * 使用模块级单例 socket，避免 React Strict Mode 在开发环境“挂载→卸载→再挂载”时
 * 把创建房间的 socket 在 cleanup 里断开，导致“房间创建成功但玩家已断开”的现象。
 */
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  gameStateFromBackend,
  applyBackendEvent,
} from '../api/backendAdapter';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let sharedSocket = null;
let disconnectTimeoutId = null;

export function useSocket(setGameState, options = {}) {
  const { onRoomCreated } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const socketRef = useRef(null);
  const setGameStateRef = useRef(setGameState);
  const onRoomCreatedRef = useRef(onRoomCreated);
  const pendingStartAfterCreateRef = useRef(false);
  onRoomCreatedRef.current = onRoomCreated;
  setGameStateRef.current = setGameState;

  useEffect(() => {
    if (disconnectTimeoutId) {
      clearTimeout(disconnectTimeoutId);
      disconnectTimeoutId = null;
    }
    if (!sharedSocket) {
      sharedSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
    }
    const socket = sharedSocket;
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      console.log('[Socket] Connected to', SOCKET_URL);
    };
    const onDisconnect = (reason) => {
      setIsConnected(false);
      setMyPlayerId(null);
      console.log('[Socket] Disconnected:', reason);
    };
    const onConnectError = (err) => {
      setIsConnected(false);
      setMyPlayerId(null);
      console.warn('[Socket] Connect error:', err.message);
    };
    const onError = (data) => {
      console.warn('[Socket] Error:', data?.message ?? data);
    };
    const onConnected = (data) => {
      const id = data?.playerId;
      if (id) setMyPlayerId(id);
      console.log('[Socket] Server acknowledged:', data?.playerId ?? data);
    };
    const onGameState = (data) => {
      const next = gameStateFromBackend(data);
      if (next) setGameStateRef.current(next);
    };
    const onRoomCreated = (data) => {
      console.log('[Socket] Room created:', data?.roomId);
      onRoomCreatedRef.current?.(data);
      if (pendingStartAfterCreateRef.current) {
        pendingStartAfterCreateRef.current = false;
        socket.emit('start_game');
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('error', onError);
    socket.on('connected', onConnected);
    socket.on('game_state', onGameState);
    socket.on('room_created', onRoomCreated);

    const onCurrentPlayer = (data) => {
      setGameStateRef.current((prev) => {
        const index =
          typeof data.playerIndex === 'number'
            ? data.playerIndex
            : (data.playerId && prev.players?.length
                ? prev.players.findIndex((p) => p.id === data.playerId)
                : -1);
        if (index < 0 || index >= (prev.players?.length ?? 0)) return prev;
        return {
          ...prev,
          currentPlayerIndex: index,
          players: prev.players.map((p, i) => ({ ...p, isCurrent: i === index })),
        };
      });
    };
    socket.on('current_player', onCurrentPlayer);

    const eventNames = [
      'round_started',
      'cards_dealt',
      'community_cards',
      'phase_changed',
      'player_allin',
      'player_fold',
      'showdown',
      'round_ended',
      'game_ended',
    ];
    const handlers = {};
    eventNames.forEach((eventName) => {
      handlers[eventName] = (data) => {
        setGameStateRef.current((prev) =>
          applyBackendEvent(prev, eventName, data)
        );
      };
      socket.on(eventName, handlers[eventName]);
    });

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      eventNames.forEach((eventName) => socket.off(eventName, handlers[eventName]));
      socket.off('connect', onConnect)
        .off('disconnect', onDisconnect)
        .off('connect_error', onConnectError)
        .off('error', onError)
        .off('connected', onConnected)
        .off('game_state', onGameState)
        .off('room_created', onRoomCreated)
        .off('current_player', onCurrentPlayer);
      socketRef.current = null;
      setIsConnected(false);
      // 延迟断开，避免 React Strict Mode 的“卸载”在开发环境把连接断开后立即又挂载
      disconnectTimeoutId = setTimeout(() => {
        disconnectTimeoutId = null;
        if (sharedSocket) {
          sharedSocket.disconnect();
          sharedSocket = null;
        }
      }, 500);
    };
  }, []);

  const emit = (event, data) => {
    if (socketRef.current?.connected) socketRef.current.emit(event, data);
  };

  const createRoom = (data) => emit('create_room', data);
  const createRoomAndStart = (data = { name: 'Demo' }) => {
    pendingStartAfterCreateRef.current = true;
    createRoom(data);
  };

  return {
    isConnected,
    myPlayerId,
    socket: socketRef.current,
    createRoom,
    createRoomAndStart,
    joinRoom: (data) => emit('join_room', data),
    joinAsSpectator: (data) => emit('join_as_spectator', data),
    startGame: () => emit('start_game'),
    playerAction: (data) => emit('player_action', data),
    nextRound: () => emit('next_round'),
    getRooms: () => emit('get_rooms'),
  };
}
