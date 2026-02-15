/**
 * PokerMind Arena - 验证相关 Socket.io 事件处理
 */

import type { Server as SocketServer, Socket } from 'socket.io';
import { verificationService } from '../services/verification-service.js';
import { chainService } from '../services/chain-service.js';
import type { GameLog, VerificationPanelData } from '../types.js';

/**
 * 注册验证相关的 Socket 事件
 */
export function registerVerifySocketHandlers(io: SocketServer, socket: Socket): void {
  
  /**
   * 提交游戏到链上
   */
  socket.on('commit_game', async (
    gameLog: GameLog,
    callback: (result: { success: boolean; data?: VerificationPanelData; error?: string }) => void
  ) => {
    try {
      const { panelData } = await verificationService.commitGame(gameLog);
      
      // 广播给所有观众
      io.emit('game_committed', panelData);
      
      callback({ success: true, data: panelData });
    } catch (error) {
      callback({ success: false, error: (error as Error).message });
    }
  });
  
  /**
   * 实时验证流程（带进度推送）
   */
  socket.on('verify_game', async (
    data: { gameId: string; ipfsCid: string },
    callback: (result: { success: boolean; error?: string }) => void
  ) => {
    try {
      await verificationService.performVerification(
        data.gameId,
        data.ipfsCid,
        (step, stepData) => {
          // 推送验证进度
          socket.emit('verify_progress', {
            gameId: data.gameId,
            step,
            data: stepData
          });
        }
      );
      
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: (error as Error).message });
    }
  });
  
  /**
   * 获取游戏链上记录
   */
  socket.on('get_game_record', async (
    gameId: string,
    callback: (result: { success: boolean; data?: unknown; error?: string }) => void
  ) => {
    try {
      const record = await chainService.getGameRecord(gameId);
      
      if (!record) {
        callback({ success: false, error: 'Game not found' });
        return;
      }
      
      callback({ success: true, data: record });
    } catch (error) {
      callback({ success: false, error: (error as Error).message });
    }
  });
}
