/**
 * 后端 (PokerMind-Arena) 状态与事件 → 前端 gameState 的适配
 * 后端：All-in/Fold，phase = waiting | preflop | flop | turn | river | showdown | ended
 * 牌面：pokersolver 格式 "Ah","Kd","Tc" (T=10, 小写花色)
 * 前端：phase = IDLE | DEALING | PREFLOP | FLOP | ... | SHOWDOWN | ENDED，牌面 "AH","KD","10C"
 */

const POSITIONS = ['bottom', 'left', 'top', 'right'];

/** 后端牌 "Ah" -> 前端 "AH"，"Tc" -> "10C" */
function backendCardToFrontend(card) {
  if (!card || typeof card !== 'string') return card;
  const suit = card.slice(-1).toUpperCase();
  let rank = card.slice(0, -1).toUpperCase();
  if (rank === 'T') rank = '10';
  return rank + suit;
}

/** 后端 phase 转前端 phase（仅阶段名） */
function backendPhaseToFrontend(phase) {
  const map = {
    waiting: 'IDLE',
    preflop: 'PREFLOP',
    flop: 'FLOP',
    turn: 'TURN',
    river: 'RIVER',
    showdown: 'SHOWDOWN',
    ended: 'ENDED',
  };
  return map[phase] ?? phase?.toUpperCase?.() ?? 'IDLE';
}

/** 后端玩家状态 -> 前端 */
function backendStatusToFrontend(status) {
  const map = { active: 'waiting', allin: 'all-in', folded: 'folded', eliminated: 'folded' };
  return map[status] ?? 'waiting';
}

/**
 * 从后端 game_state（getPublicState）或事件中的 players 构建前端 players 数组
 * @param {Array} backendPlayers - 后端 players（可能含 holeCards 或仅 hasCards）
 * @param {Object} options - { holeCardsMap: { [playerId]: [card1, card2] }, round }
 */
export function mapBackendPlayersToFrontend(backendPlayers, options = {}) {
  const { holeCardsMap = {}, dealerIndex = 0 } = options;
  if (!Array.isArray(backendPlayers)) return [];

  return backendPlayers.map((p, index) => {
    const holeCards = holeCardsMap[p.id] ?? (p.holeCards || []);
    const cards = holeCards.map(backendCardToFrontend);

    return {
      id: p.id,
      name: p.name ?? `Player ${p.id}`,
      avatar: p.avatar ?? String((p.name || 'P')[0]).toUpperCase(),
      chips: Number(p.chips) ?? 0,
      bet: 0,
      totalBet: 0,
      cards,
      status: backendStatusToFrontend(p.status),
      isDealer: index === dealerIndex,
      isCurrent: false,
      position: POSITIONS[index % 4],
      hasActedThisRound: false,
      winProbability: 0,
    };
  });
}

/**
 * 从后端 game_state 生成一帧前端 gameState（用于加入房间/观众时收到的那次全量状态）
 */
export function gameStateFromBackend(backendState) {
  if (!backendState) return null;

  const phase = backendPhaseToFrontend(backendState.phase);
  const dealerIndex = typeof backendState.dealerIndex === 'number' ? backendState.dealerIndex : 0;
  const players = mapBackendPlayersToFrontend(backendState.players || [], {
    dealerIndex,
  });

  const smallBlind = typeof backendState.smallBlind === 'number' ? backendState.smallBlind : 10;
  const bigBlind = typeof backendState.bigBlind === 'number' ? backendState.bigBlind : 20;
  return {
    handNumber: backendState.round ?? 0,
    handId: backendState.round ?? 0,
    phase: phase === 'PREFLOP' && (backendState.players?.length > 0) ? 'IDLE' : phase,
    pot: Number(backendState.pot) ?? 0,
    smallBlind,
    bigBlind,
    currentBet: 0,
    minRaise: 20,
    currentPlayerIndex: -1,
    dealerIndex,
    communityCards: (backendState.communityCards || []).map(backendCardToFrontend),
    actionLog: [],
    animationTrigger: null,
    deck: [],
    winnerId: null,
    winnerHandType: '',
    players,
    gameId: backendState.gameId,
  };
}

/**
 * 根据后端事件增量更新前端 state（返回 partial 或 full state 供 setState 使用）
 * 用于 round_started / cards_dealt / community_cards / phase_changed / showdown / round_ended / game_ended
 */
export function applyBackendEvent(prevState, eventName, data) {
  const next = { ...prevState };

  switch (eventName) {
    case 'round_started': {
      const dealerIdx = typeof data.dealerIndex === 'number' ? data.dealerIndex : 0;
      const activeIdx = typeof data.activePlayerIndex === 'number' ? data.activePlayerIndex : 0;
      const playersMapped = mapBackendPlayersToFrontend(data.players || [], { dealerIndex: dealerIdx });
      next.phase = 'DEALING';
      next.animationTrigger = 'deal';
      next.pot = Number(data.pot) ?? 0;
      next.dealerIndex = dealerIdx;
      next.smallBlind = typeof data.smallBlind === 'number' ? data.smallBlind : 10;
      next.bigBlind = typeof data.bigBlind === 'number' ? data.bigBlind : 20;
      next.handNumber = data.round ?? prevState.handNumber;
      next.handId = data.round ?? prevState.handId;
      next.communityCards = [];
      next.players = playersMapped.map((p, i) => ({ ...p, isCurrent: i === activeIdx }));
      next.currentPlayerIndex = activeIdx >= 0 && activeIdx < playersMapped.length ? activeIdx : 0;
      next.actionLog = [];
      next.winnerId = null;
      return next;
    }

    case 'cards_dealt': {
      const holeCardsMap = {};
      (data.players || []).forEach((p) => {
        if (p.holeCards && p.holeCards.length) holeCardsMap[p.id] = p.holeCards;
      });
      next.players = mapBackendPlayersToFrontend(prevState.players || [], {
        holeCardsMap,
        dealerIndex: prevState.dealerIndex ?? 0,
      });
      return next;
    }

    case 'community_cards': {
      next.communityCards = (data.cards || []).map(backendCardToFrontend);
      const phase = (data.phase || '').toLowerCase();
      if (phase === 'flop') {
        next.phase = 'FLOP';
        next.animationTrigger = 'flop';
      } else if (phase === 'turn') {
        next.phase = 'TURN';
        next.animationTrigger = 'turn';
      } else if (phase === 'river') {
        next.phase = 'RIVER';
        next.animationTrigger = 'river';
      }
      return next;
    }

    case 'phase_changed': {
      const phase = backendPhaseToFrontend(data.phase);
      next.phase = phase;
      // 连接后端时事件顺序可能 phase_changed 先于 community_cards，显式设置翻牌 trigger 保证 Flop/Turn/River 能推进
      if (phase === 'FLOP') next.animationTrigger = 'flop';
      else if (phase === 'TURN') next.animationTrigger = 'turn';
      else if (phase === 'RIVER') next.animationTrigger = 'river';
      else next.animationTrigger = null;
      return next;
    }

    case 'player_allin': {
      const pid = data.player?.id;
      const p = data.player;
      const newPot = Number(data.pot) ?? prevState.pot;
      if (pid) {
        next.players = (next.players || prevState.players).map((pl) =>
          pl.id === pid ? { ...pl, status: 'all-in', chips: 0 } : pl
        );
        next.pot = newPot;
      }
      const amount = newPot - (prevState.pot ?? 0);
      next.actionLog = [...(prevState.actionLog || []), {
        id: Date.now(),
        phase: prevState.phase || 'PREFLOP',
        player: p?.name ?? pid ?? '',
        action: 'all-in',
        amount,
        pot: newPot,
        timestamp: '刚刚',
      }];
      return next;
    }

    case 'player_fold': {
      const pid = data.player?.id;
      const p = data.player;
      if (pid) {
        next.players = (next.players || prevState.players).map((pl) =>
          pl.id === pid ? { ...pl, status: 'folded' } : pl
        );
      }
      next.actionLog = [...(prevState.actionLog || []), {
        id: Date.now(),
        phase: prevState.phase || 'PREFLOP',
        player: p?.name ?? pid ?? '',
        action: 'fold',
        amount: 0,
        pot: prevState.pot ?? 0,
        timestamp: '刚刚',
      }];
      return next;
    }

    case 'showdown': {
      next.phase = 'SHOWDOWN';
      next.animationTrigger = 'showdown';
      next.communityCards = (data.communityCards || []).map(backendCardToFrontend);
      return next;
    }

    case 'round_ended': {
      const winners = data.winners || [];
      next.phase = 'ENDED';
      next.animationTrigger = null;
      next.winnerId = winners[0]?.id ?? null;
      next.pot = Number(data.pot) ?? prevState.pot;
      return next;
    }

    case 'game_ended': {
      next.phase = 'ENDED';
      next.animationTrigger = null;
      next.winnerId = data.winner?.id ?? null;
      return next;
    }

    default:
      return prevState;
  }
}
