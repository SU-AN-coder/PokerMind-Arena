/**
 * PokerMind Arena - 游戏引擎核心
 * 
 * All-in or Fold 简化规则：
 * - 每轮只有两个选择：All-in 或 Fold
 * - 无边池计算，赢家拿走所有
 * - 使用 pokersolver 进行牌型评估
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { createDeck, shuffleDeck, drawCards } from './deck.js';
import { evaluateHand, determineWinners } from './evaluator.js';
import type {
  GameState,
  GameConfig,
  GamePhase,
  Player,
  PlayerInput,
  PlayerAction,
  CardString,
  GameEventMap,
  GameEventName
} from './types.js';

/**
 * 扑克游戏引擎
 * 
 * @example
 * ```ts
 * const engine = new PokerGameEngine();
 * 
 * engine.addPlayer({ id: '1', name: '火焰', avatar: '🔥' });
 * engine.addPlayer({ id: '2', name: '冰山', avatar: '🧊' });
 * 
 * engine.on('round_started', (data) => console.log('Round started', data));
 * engine.on('showdown', (data) => console.log('Showdown', data));
 * 
 * engine.startRound();
 * engine.executeAction({ playerId: '1', action: 'allin', ... });
 * ```
 */
export class PokerGameEngine extends EventEmitter {
  private state: GameState;
  private config: GameConfig;
  
  constructor(config: Partial<GameConfig> = {}) {
    super();
    this.config = {
      initialChips: config.initialChips ?? 100,
      roundCount: config.roundCount ?? 5
    };
    this.state = this.createInitialState();
  }
  
  // ============ 状态初始化 ============
  
  private createInitialState(): GameState {
    return {
      gameId: this.generateGameId(),
      phase: 'waiting',
      round: 0,
      players: [],
      communityCards: [],
      pot: 0,
      activePlayerIndex: 0,
      deck: [],
      actionHistory: []
    };
  }
  
  private generateGameId(): string {
    return `game_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }
  
  // ============ 玩家管理 ============
  
  /**
   * 添加玩家
   */
  addPlayer(input: PlayerInput): void {
    if (this.state.phase !== 'waiting') {
      throw new Error('Cannot add player after game started');
    }
    
    if (this.state.players.length >= 4) {
      throw new Error('Maximum 4 players allowed');
    }
    
    const player: Player = {
      ...input,
      chips: this.config.initialChips,
      holeCards: ['', ''] as [CardString, CardString],
      status: 'active'
    };
    
    this.state.players.push(player);
    
    this.emit('player_joined', {
      id: player.id,
      name: player.name,
      avatar: player.avatar
    });
  }
  
  /**
   * 获取存活玩家
   */
  private getActivePlayers(): Player[] {
    return this.state.players.filter(
      p => p.status === 'active' || p.status === 'allin'
    );
  }
  
  /**
   * 获取当前应该行动的玩家
   */
  getCurrentPlayer(): Player | null {
    const activePlayers = this.state.players.filter(
      p => p.status === 'active' && !this.hasActedThisPhase(p.id)
    );
    
    return activePlayers[0] || null;
  }
  
  private hasActedThisPhase(playerId: string): boolean {
    return this.state.actionHistory.some(a => a.playerId === playerId);
  }
  
  // ============ 轮次管理 ============
  
  /**
   * 开始新一轮
   */
  startRound(): void {
    if (this.state.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }
    
    this.state.round++;
    this.state.phase = 'preflop';
    
    // 重置存活玩家状态
    for (const player of this.state.players) {
      if (player.chips > 0) {
        player.status = 'active';
      } else {
        player.status = 'eliminated';
      }
    }
    
    // 洗牌
    this.state.deck = shuffleDeck(createDeck());
    
    // 发手牌
    this.dealHoleCards();
    
    // 收集 ante（每人投入20%）
    const ante = Math.ceil(this.config.initialChips * 0.2);
    this.state.pot = 0;
    
    for (const player of this.state.players) {
      if (player.status === 'active') {
        const contribution = Math.min(ante, player.chips);
        player.chips -= contribution;
        this.state.pot += contribution;
      }
    }
    
    // 重置状态
    this.state.activePlayerIndex = 0;
    this.state.communityCards = [];
    this.state.actionHistory = [];
    this.state.winner = undefined;
    
    this.emit('round_started', {
      round: this.state.round,
      pot: this.state.pot,
      players: this.state.players
    });
  }
  
  /**
   * 发手牌
   */
  private dealHoleCards(): void {
    const activePlayers = this.getActivePlayers();
    
    for (const player of activePlayers) {
      const cards = drawCards(this.state.deck, 2);
      player.holeCards = cards as [CardString, CardString];
    }
    
    this.emit('cards_dealt', {
      players: activePlayers.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.holeCards
      }))
    });
  }
  
  /**
   * 发公共牌
   */
  private dealCommunityCards(count: number): void {
    const cards = drawCards(this.state.deck, count);
    this.state.communityCards.push(...cards);
    
    this.emit('community_cards', {
      phase: this.state.phase,
      cards: this.state.communityCards
    });
  }
  
  // ============ 动作执行 ============
  
  /**
   * 执行玩家动作
   */
  executeAction(action: PlayerAction): void {
    const player = this.state.players.find(p => p.id === action.playerId);
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    if (player.status !== 'active') {
      throw new Error('Player is not active');
    }
    
    // 记录动作
    this.state.actionHistory.push({
      ...action,
      timestamp: action.timestamp || Date.now()
    });
    
    if (action.action === 'allin') {
      // All-in：把所有筹码投入
      this.state.pot += player.chips;
      player.chips = 0;
      player.status = 'allin';
      
      this.emit('player_allin', {
        player,
        pot: this.state.pot,
        speech: action.speech
      });
    } else {
      // Fold：弃牌
      player.status = 'folded';
      
      this.emit('player_fold', {
        player,
        speech: action.speech
      });
    }
    
    // 检查阶段是否完成
    this.checkPhaseCompletion();
  }
  
  // ============ 阶段流转 ============
  
  /**
   * 检查阶段是否完成
   */
  private checkPhaseCompletion(): void {
    const activePlayers = this.getActivePlayers();
    
    // 只剩1人 → 直接获胜
    if (activePlayers.length === 1) {
      this.resolveWinner([activePlayers[0]]);
      return;
    }
    
    // 检查是否所有人都已行动
    const allActed = activePlayers.every(p => 
      p.status === 'allin' || this.hasActedThisPhase(p.id)
    );
    
    if (allActed) {
      this.advancePhase();
    }
  }
  
  /**
   * 进入下一阶段
   */
  private advancePhase(): void {
    // 清空本轮行动记录
    this.state.actionHistory = [];
    
    switch (this.state.phase) {
      case 'preflop':
        this.state.phase = 'flop';
        this.dealCommunityCards(3);
        break;
      case 'flop':
        this.state.phase = 'turn';
        this.dealCommunityCards(1);
        break;
      case 'turn':
        this.state.phase = 'river';
        this.dealCommunityCards(1);
        break;
      case 'river':
        this.state.phase = 'showdown';
        this.showdown();
        return;  // showdown 会处理后续
    }
    
    this.emit('phase_changed', { phase: this.state.phase });
  }
  
  // ============ 摊牌与结算 ============
  
  /**
   * 摊牌
   */
  private showdown(): void {
    const contenders = this.state.players.filter(p => p.status === 'allin');
    
    if (contenders.length === 0) {
      // 没人All-in，最后一个active玩家获胜
      const lastActive = this.state.players.find(p => p.status === 'active');
      if (lastActive) {
        this.resolveWinner([lastActive]);
      }
      return;
    }
    
    // 使用 pokersolver 比较
    const winners = determineWinners(contenders, this.state.communityCards);
    
    this.emit('showdown', {
      players: contenders.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.holeCards,
        hand: evaluateHand(p.holeCards, this.state.communityCards).description
      })),
      communityCards: this.state.communityCards
    });
    
    this.resolveWinner(winners.map(w => w.player));
  }
  
  /**
   * 结算获胜者
   */
  private resolveWinner(winners: Player[]): void {
    const winAmount = Math.floor(this.state.pot / winners.length);
    
    for (const winner of winners) {
      winner.chips += winAmount;
    }
    
    this.state.phase = 'ended';
    this.state.winner = winners[0];
    
    this.emit('round_ended', {
      winners: winners.map(w => ({
        id: w.id,
        name: w.name,
        avatar: w.avatar,
        winAmount
      })),
      pot: this.state.pot
    });
    
    // 检查游戏是否完全结束
    this.checkGameEnd();
  }
  
  /**
   * 检查游戏是否结束
   */
  private checkGameEnd(): void {
    const playersWithChips = this.state.players.filter(p => p.chips > 0);
    
    // 只剩1人有筹码，或者已达最大轮数
    if (playersWithChips.length === 1 || this.state.round >= this.config.roundCount) {
      const finalWinner = playersWithChips.reduce(
        (max, p) => p.chips > max.chips ? p : max
      );
      
      this.emit('game_ended', {
        winner: finalWinner,
        players: this.state.players,
        totalRounds: this.state.round
      });
    }
  }
  
  // ============ 状态查询 ============
  
  /**
   * 获取当前游戏状态（深拷贝）
   */
  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  /**
   * 获取游戏ID
   */
  getGameId(): string {
    return this.state.gameId;
  }
  
  /**
   * 获取当前阶段
   */
  getPhase(): GamePhase {
    return this.state.phase;
  }
  
  /**
   * 获取当前轮数
   */
  getRound(): number {
    return this.state.round;
  }
  
  /**
   * 获取底池
   */
  getPot(): number {
    return this.state.pot;
  }
  
  // ============ 类型安全的事件发射 ============
  
  emit<K extends GameEventName>(event: K, data: GameEventMap[K]): boolean {
    return super.emit(event, data);
  }
  
  on<K extends GameEventName>(
    event: K, 
    listener: (data: GameEventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }
}
