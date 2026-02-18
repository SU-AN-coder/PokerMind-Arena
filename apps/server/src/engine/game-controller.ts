/**
 * PokerMind Arena - 游戏流程控制器
 * 
 * 协调游戏引擎、AI 智能体、日志记录，执行完整的 AI 对战
 */

import type { Server as SocketIOServer } from 'socket.io';
import { PokerGameEngine } from './poker-engine.js';
import type { GameState, Player } from './types.js';
import { AIAgent } from '../agents/ai-agent.js';
import { 
  FIRE_PERSONALITY, 
  ICE_PERSONALITY, 
  SHADOW_PERSONALITY, 
  LOGIC_PERSONALITY 
} from '../agents/personalities/index.js';
import { GameLogger, gameLogger } from '../agents/logging/game-logger.js';
import { verificationService } from '../blockchain/services/verification-service.js';
import type { SimpleGameContext, AIDecision, GameLog } from '../agents/types.js';

interface GameControllerConfig {
  initialChips?: number;
  roundCount?: number;
  thinkingDelay?: number;  // AI 思考延迟（ms）
  onAIThinking?: (agentName: string) => void;
  onAISpeechChunk?: (agentName: string, chunk: string) => void;
  onAIDecision?: (agentName: string, decision: AIDecision) => void;
  onGameStateUpdate?: (state: GameState) => void;
  onRoundEnd?: (winnerName: string, pot: number) => void;
  onGameEnd?: (winnerName: string, totalPot: number) => void;
  onBlockchainCommit?: (result: { txHash: string; ipfsCid: string; explorerUrl: string }) => void;
}

interface AgentInfo {
  id: string;
  personality: {
    name: string;
    avatar: string;
  };
}

/**
 * 游戏控制器 - 管理完整的 AI 对战流程
 */
export class GameController {
  private engine: PokerGameEngine;
  private agents: Map<string, AIAgent> = new Map();
  private config: Required<Pick<GameControllerConfig, 'initialChips' | 'roundCount' | 'thinkingDelay'>>;
  private callbacks: Omit<GameControllerConfig, 'initialChips' | 'roundCount' | 'thinkingDelay'>;
  private dialogueHistory: string[] = [];
  private isRunning: boolean = false;
  private gameLog: GameLog | null = null;
  
  constructor(config: GameControllerConfig = {}) {
    this.config = {
      initialChips: config.initialChips ?? 100,
      roundCount: config.roundCount ?? 5,
      thinkingDelay: config.thinkingDelay ?? 1000
    };
    
    this.callbacks = {
      onAIThinking: config.onAIThinking,
      onAISpeechChunk: config.onAISpeechChunk,
      onAIDecision: config.onAIDecision,
      onGameStateUpdate: config.onGameStateUpdate,
      onRoundEnd: config.onRoundEnd,
      onGameEnd: config.onGameEnd,
      onBlockchainCommit: config.onBlockchainCommit
    };
    
    this.engine = new PokerGameEngine({
      initialChips: this.config.initialChips,
      roundCount: this.config.roundCount
    });
    
    this.setupAgents();
    this.setupEngineEvents();
  }
  
  /**
   * 初始化 4 个 AI 玩家
   */
  private setupAgents(): void {
    const personalities = [
      FIRE_PERSONALITY,
      ICE_PERSONALITY,
      SHADOW_PERSONALITY,
      LOGIC_PERSONALITY
    ];
    
    for (const personality of personalities) {
      const agent = new AIAgent(personality);
      this.agents.set(agent.id, agent);
      
      // 添加到游戏引擎
      this.engine.addPlayer({
        id: agent.id,
        name: personality.name,
        avatar: personality.avatar
      });
    }
    
    console.log(`🎮 创建了 ${this.agents.size} 个 AI 玩家`);
  }
  
  /**
   * 监听引擎事件
   */
  private setupEngineEvents(): void {
    this.engine.on('round_started', (data) => {
      console.log(`\n🃏 === 第 ${data.round} 轮开始 ===`);
      console.log(`   底池: $${data.pot}`);
      this.notifyStateUpdate();
    });
    
    this.engine.on('cards_dealt', (data) => {
      console.log('📤 发牌完成:');
      for (const p of data.players) {
        console.log(`   ${p.name}: ${p.holeCards.join(' ')}`);
      }
      this.notifyStateUpdate();
    });
    
    this.engine.on('community_cards', (data) => {
      console.log(`🎴 公共牌 (${data.phase}): ${data.cards.join(' ')}`);
      
      // 更新日志中的公共牌
      gameLogger.setCommunityCards(data.cards);
      this.notifyStateUpdate();
    });
    
    this.engine.on('player_allin', (data) => {
      console.log(`💰 ${data.player.name} ALL-IN! 底池: $${data.pot}`);
    });
    
    this.engine.on('player_fold', (data) => {
      console.log(`🏳️ ${data.player.name} FOLD`);
    });
    
    this.engine.on('phase_changed', (data) => {
      console.log(`📍 阶段变更: ${data.phase}`);
    });
    
    this.engine.on('showdown', (data) => {
      console.log('\n🎰 === 摊牌 ===');
      for (const p of data.players) {
        console.log(`   ${p.name}: ${p.holeCards.join(' ')} → ${p.hand}`);
      }
    });
    
    this.engine.on('round_ended', (data) => {
      const winnerNames = data.winners.map(w => w.name).join(', ');
      console.log(`\n🏆 本轮获胜: ${winnerNames} (+$${data.winners[0].winAmount})`);
      this.callbacks.onRoundEnd?.(winnerNames, data.pot);
    });
    
    this.engine.on('game_ended', (data) => {
      console.log(`\n🎊 === 游戏结束 ===`);
      console.log(`   最终获胜者: ${data.winner.name}`);
      console.log(`   总计 ${data.totalRounds} 轮`);
    });
  }
  
  /**
   * 通知状态更新
   */
  private notifyStateUpdate(): void {
    const state = this.engine.getState();
    this.callbacks.onGameStateUpdate?.(state);
  }
  
  /**
   * 构建 AI 决策上下文
   */
  private buildGameContext(agent: AIAgent): SimpleGameContext {
    const state = this.engine.getState();
    const player = state.players.find(p => p.id === agent.id)!;
    
    return {
      yourName: agent.personality.name,
      holeCards: player.holeCards?.join(' ') || '',
      communityCards: state.communityCards.join(' ') || '(未发牌)',
      yourStack: player.chips,
      potSize: state.pot,
      round: state.round,
      survivingPlayers: state.players
        .filter(p => p.status === 'active' || p.status === 'allin')
        .map(p => ({
          name: state.players.find(pl => pl.id === p.id)?.name || p.id,
          stack: p.chips,
          lastAction: p.status === 'allin' ? '(All-in)' : ''
        })),
      recentDialogue: this.dialogueHistory.slice(-5)
    };
  }
  
  /**
   * 执行单个 AI 的回合
   */
  private async executeAITurn(agent: AIAgent): Promise<AIDecision> {
    const context = this.buildGameContext(agent);
    
    // 通知：AI 开始思考
    this.callbacks.onAIThinking?.(agent.personality.name);
    console.log(`\n🤔 ${agent.personality.name} 正在思考...`);
    
    // 添加思考延迟（更自然）
    await this.delay(300 + Math.random() * 300);
    
    // 调用 AI 决策（带流式输出）
    let speechAccum = '';
    const decision = await agent.makeDecision(context, (chunk) => {
      speechAccum += chunk;
      this.callbacks.onAISpeechChunk?.(agent.personality.name, chunk);
    });
    
    console.log(`\n   💬 "${decision.speech}"`);
    console.log(`   🎯 动作: ${decision.action.toUpperCase()}`);
    console.log(`   😤 情绪: ${decision.emotion}`);
    if (decision.target) {
      console.log(`   🎯 目标: @${decision.target}`);
    }
    
    // 记录对话历史
    const dialogue = decision.target 
      ? `${agent.personality.name}: @${decision.target} ${decision.speech}`
      : `${agent.personality.name}: ${decision.speech}`;
    this.dialogueHistory.push(dialogue);
    
    // 处理 @提及，更新被提及者的情绪
    if (decision.target) {
      for (const [, otherAgent] of this.agents) {
        if (otherAgent.personality.name === decision.target) {
          otherAgent.addRecentTaunt({
            from: agent.personality.name,
            content: decision.speech,
            timestamp: Date.now()
          });
          otherAgent.triggerEmotion('taunted');
        }
      }
    }
    
    // 执行动作
    this.engine.executeAction({
      playerId: agent.id,
      action: decision.action,
      timestamp: Date.now(),
      speech: decision.speech
    });
    
    // 更新情绪状态
    agent.triggerEmotion(decision.action === 'allin' ? 'aggressive_action' : 'passive_action');
    
    // 记录决策日志
    gameLogger.logDecision(
      { id: agent.id, personality: agent.personality },
      {
        holeCards: context.holeCards,
        communityCards: context.communityCards,
        potSize: context.potSize
      },
      decision
    );
    
    // 通知回调
    this.callbacks.onAIDecision?.(agent.personality.name, decision);
    
    return decision;
  }
  
  /**
   * 执行一轮游戏
   */
  private async executeRound(): Promise<void> {
    // 开始新一轮
    this.engine.startRound();
    
    // 等待状态广播
    await this.delay(500);
    
    // 依次执行 AI 决策直到本轮结束
    while (this.engine.getPhase() !== 'ended' && this.engine.getPhase() !== 'showdown') {
      // 获取当前应行动的玩家
      const currentPlayer = this.engine.getCurrentPlayer();
      
      if (!currentPlayer) {
        // 没有需要行动的玩家了
        break;
      }
      
      const agent = this.agents.get(currentPlayer.id);
      if (!agent) continue;
      
      await this.executeAITurn(agent);
      
      // 决策间隔
      await this.delay(this.config.thinkingDelay);
    }
    
    // 轮次结束，重置 agent 情绪计时
    for (const agent of this.agents.values()) {
      agent.endRound();
    }
  }
  
  /**
   * 开始完整游戏
   */
  async startGame(): Promise<{ winner: Player; gameLog: GameLog }> {
    if (this.isRunning) {
      throw new Error('游戏已在运行中');
    }
    
    this.isRunning = true;
    const gameId = this.engine.getGameId();
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🃏 PokerMind Arena - AI 对战开始！                      ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`\n📋 游戏ID: ${gameId}`);
    console.log(`📊 初始筹码: $${this.config.initialChips}`);
    console.log(`🔄 最大轮数: ${this.config.roundCount}`);
    
    // 显示玩家
    console.log('\n👥 参赛选手:');
    for (const agent of this.agents.values()) {
      console.log(`   ${agent.personality.avatar} ${agent.personality.name} - ${agent.personality.style}`);
    }
    
    // 初始化日志
    const agentInfos: AgentInfo[] = Array.from(this.agents.values()).map(a => ({
      id: a.id,
      personality: { name: a.personality.name, avatar: a.personality.avatar }
    }));
    gameLogger.startGame(gameId, agentInfos);
    
    // 执行多轮游戏
    const totalRounds = this.config.roundCount;
    
    for (let round = 1; round <= totalRounds; round++) {
      const state = this.engine.getState();
      
      // 检查是否只剩一个玩家有筹码
      const playersWithChips = state.players.filter(p => p.chips > 0);
      
      if (playersWithChips.length <= 1) {
        console.log('\n🏆 只剩一位选手，游戏结束！');
        break;
      }
      
      await this.executeRound();
      
      // 显示当前筹码状态
      const currentState = this.engine.getState();
      console.log('\n📊 当前筹码:');
      for (const p of currentState.players) {
        const status = p.chips > 0 ? `$${p.chips}` : '❌ 出局';
        console.log(`   ${p.name}: ${status}`);
      }
      
      // 轮间休息
      if (round < totalRounds) {
        await this.delay(1500);
      }
    }
    
    // 游戏结束
    const result = await this.endGame();
    
    this.isRunning = false;
    return result;
  }
  
  /**
   * 结束游戏并提交链上
   */
  private async endGame(): Promise<{ winner: Player; gameLog: GameLog }> {
    const state = this.engine.getState();
    
    // 找出获胜者（筹码最多）
    const winner = state.players.reduce((prev, curr) => 
      curr.chips > prev.chips ? curr : prev
    );
    
    // 完成日志记录
    const log = gameLogger.endGame(
      { id: winner.id, name: winner.name },
      state.pot
    );
    
    if (!log) {
      throw new Error('Failed to generate game log');
    }
    
    this.gameLog = log;
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎊 最终结果:');
    console.log(`   🏆 冠军: ${winner.name} (${winner.avatar})`);
    console.log(`   💰 最终筹码: $${winner.chips}`);
    
    // 通知回调
    this.callbacks.onGameEnd?.(winner.name, winner.chips);
    
    // 提交到链上
    console.log('\n📤 正在提交到区块链...');
    
    try {
      const { result, panelData } = await verificationService.commitGame(log);
      
      console.log(`   ✅ 交易哈希: ${result.txHash}`);
      console.log(`   ✅ IPFS CID: ${result.ipfsCid}`);
      console.log(`   🔗 Explorer: ${result.explorerUrl}`);
      
      this.callbacks.onBlockchainCommit?.(result);
      
    } catch (error) {
      console.log(`   ⚠️ 链上提交失败 (使用 Mock 模式): ${error}`);
    }
    
    return { winner, gameLog: log };
  }
  
  /**
   * 获取游戏 ID
   */
  getGameId(): string {
    return this.engine.getGameId();
  }
  
  /**
   * 检查游戏是否在运行
   */
  isGameRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * 获取当前状态
   */
  getState(): GameState {
    return this.engine.getState();
  }
  
  /**
   * 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
