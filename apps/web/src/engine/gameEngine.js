import { drawCards, shuffleDeck } from './helpers';

const PHASE_FLOW = {
  PREFLOP: 'FLOP',
  FLOP_BETTING: 'TURN',
  TURN_BETTING: 'RIVER',
  RIVER_BETTING: 'SHOWDOWN',
};

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function getNextPlayerIndex(gameState, currentIndex) {
  const total = gameState.players.length;
  if (!total) return -1;
  let nextIndex = (currentIndex + 1 + total) % total;
  let guard = 0;
  while (
    gameState.players[nextIndex].status === 'folded' ||
    gameState.players[nextIndex].status === 'all-in'
  ) {
    nextIndex = (nextIndex + 1) % total;
    guard += 1;
    if (guard >= total) return -1;
  }
  return nextIndex;
}

export function startNewHand(gameState) {
  const playerCount = gameState.players.length || 4;
  const previousDealer = safeNumber(gameState.dealerIndex, -1);
  const dealerIndex = (previousDealer + 1 + playerCount) % playerCount;
  const bigBlindIndex = (dealerIndex + 1) % playerCount;
  const now = Date.now();

  const players = gameState.players.map((p, i) => {
    const isSmallBlind = i === dealerIndex;
    const isBigBlind = i === bigBlindIndex;
    const blind = isSmallBlind ? gameState.smallBlind : isBigBlind ? gameState.bigBlind : 0;
    return {
      ...p,
      cards: [],
      chips: Math.max(0, safeNumber(p.chips) - blind),
      bet: blind,
      totalBet: blind,
      status: 'waiting',
      isCurrent: false,
      isDealer: i === dealerIndex,
      hasActedThisRound: false,
      winProbability: Math.max(5, Math.min(95, Math.round(40 + Math.random() * 50))),
    };
  });

  const pot = safeNumber(gameState.smallBlind) + safeNumber(gameState.bigBlind);

  return {
    ...gameState,
    handNumber: safeNumber(gameState.handNumber) + 1,
    handId: safeNumber(gameState.handId) + 1,
    phase: 'DEALING',
    pot,
    currentBet: gameState.bigBlind,
    minRaise: gameState.bigBlind,
    communityCards: [],
    players,
    currentPlayerIndex: -1,
    dealerIndex,
    actionLog: [],
    animationTrigger: 'deal',
    deck: [],
    winnerId: null,
    winnerHandType: '',
    startedAt: now,
  };
}

export function enterPreflop(gameState) {
  let deck = shuffleDeck();
  const playersWithCards = gameState.players.map((p) => {
    const dealt = drawCards(deck, 2);
    deck = dealt.deck;
    return {
      ...p,
      cards: dealt.cards,
      status: p.status === 'folded' ? 'folded' : p.status === 'all-in' ? 'all-in' : 'waiting',
      hasActedThisRound: false,
      isCurrent: false,
    };
  });
  const firstPlayerIndex = getNextPlayerIndex(
    { players: playersWithCards },
    safeNumber(gameState.dealerIndex, 0) + 1
  );

  const playersWithCurrent = playersWithCards.map((p, i) => ({
    ...p,
    isCurrent: i === firstPlayerIndex,
  }));

  return {
    ...gameState,
    phase: 'PREFLOP',
    players: playersWithCurrent,
    currentPlayerIndex: firstPlayerIndex,
    animationTrigger: null,
    deck,
  };
}

export function advanceToNextPhase(gameState) {
  const activePlayers = gameState.players.filter((p) => p.status !== 'folded');
  if (activePlayers.length <= 1) {
    return {
      ...gameState,
      phase: 'SHOWDOWN',
      animationTrigger: 'showdown',
      currentPlayerIndex: -1,
      winnerId: activePlayers[0]?.id ?? null,
    };
  }

  const nextPhase = PHASE_FLOW[gameState.phase];
  if (!nextPhase) return gameState;

  let deck = gameState.deck?.length ? gameState.deck : shuffleDeck();
  let animationTrigger = null;
  let communityCards = gameState.communityCards || [];

  const resetPlayers = gameState.players.map((p) => {
    if (p.status === 'folded' || p.status === 'all-in') {
      return { ...p, isCurrent: false, hasActedThisRound: true, bet: 0 };
    }
    return {
      ...p,
      bet: 0,
      status: 'waiting',
      isCurrent: false,
      hasActedThisRound: false,
    };
  });
  let nextIndex = -1;
  let winnerId = null;

  if (nextPhase === 'FLOP') {
    const dealt = drawCards(deck, 3);
    deck = dealt.deck;
    communityCards = dealt.cards;
    animationTrigger = 'flop';
  } else if (nextPhase === 'TURN') {
    const dealt = drawCards(deck, 1);
    deck = dealt.deck;
    communityCards = [...communityCards, ...dealt.cards];
    animationTrigger = 'turn';
  } else if (nextPhase === 'RIVER') {
    const dealt = drawCards(deck, 1);
    deck = dealt.deck;
    communityCards = [...communityCards, ...dealt.cards];
    animationTrigger = 'river';
  } else if (nextPhase === 'SHOWDOWN') {
    animationTrigger = 'showdown';
    winnerId = activePlayers[Math.floor(Math.random() * activePlayers.length)]?.id ?? null;
  }

  if (nextPhase.endsWith('BETTING')) {
    nextIndex = getNextPlayerIndex(
      { players: resetPlayers },
      safeNumber(gameState.dealerIndex, 0) - 1
    );
  }

  return {
    ...gameState,
    phase: nextPhase,
    communityCards,
    currentBet: 0,
    players: resetPlayers,
    currentPlayerIndex: nextIndex,
    animationTrigger,
    deck,
    winnerId,
  };
}

export const advancePhase = advanceToNextPhase;

export function processPlayerAction(gameState, playerId, action, amount = 0) {
  const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
  if (playerIndex < 0) return gameState;

  const player = gameState.players[playerIndex];
  const baseBet = safeNumber(player.bet);
  const baseChips = safeNumber(player.chips);
  const callAmount = Math.max(0, safeNumber(gameState.currentBet) - baseBet);

  let newPot = safeNumber(gameState.pot);
  let newCurrentBet = safeNumber(gameState.currentBet);
  let newBet = baseBet;
  let newChips = baseChips;
  let newStatus = player.status;
  let resolvedAction = action;
  const openingBet = newCurrentBet === 0;
  const isAggressiveAction = action === 'raise' || action === 'bet' || action === 'all-in';

  if (action === 'fold') {
    newStatus = 'folded';
  } else if (action === 'check' || (action === 'call' && callAmount === 0)) {
    resolvedAction = 'check';
  } else if (action === 'call') {
    const commit = Math.min(callAmount, newChips);
    newBet = baseBet + commit;
    newChips = baseChips - commit;
    newPot += commit;
    if (commit < callAmount) {
      newStatus = 'all-in';
      resolvedAction = 'all-in';
    }
  } else if (action === 'raise' || action === 'bet') {
    const desired = safeNumber(amount, 0);
    const target = Math.max(desired, newCurrentBet);
    const cappedTarget = Math.min(target, baseBet + baseChips);
    const commit = Math.max(0, cappedTarget - baseBet);
    if (commit <= 0) {
      resolvedAction = callAmount === 0 ? 'check' : 'call';
      const commitCall = Math.min(callAmount, newChips);
      newBet = baseBet + commitCall;
      newChips = baseChips - commitCall;
      newPot += commitCall;
      if (commitCall < callAmount) {
        newStatus = 'all-in';
        resolvedAction = 'all-in';
      }
    } else {
      newBet = cappedTarget;
      newChips = baseChips - commit;
      newPot += commit;
      newCurrentBet = Math.max(newCurrentBet, cappedTarget);
      if (newChips === 0) {
        newStatus = 'all-in';
        resolvedAction = 'all-in';
      } else {
        resolvedAction = openingBet ? 'bet' : 'raise';
      }
    }
  } else if (action === 'all-in') {
    const commit = newChips;
    newBet = baseBet + commit;
    newChips = 0;
    newPot += commit;
    newCurrentBet = Math.max(newCurrentBet, newBet);
    newStatus = 'all-in';
    resolvedAction = 'all-in';
  }

  const updatedPlayers = gameState.players.map((p, i) => {
    if (i === playerIndex) {
      return {
        ...p,
        chips: newChips,
        bet: newBet,
        totalBet: safeNumber(p.totalBet) + Math.max(0, newBet - baseBet),
        status: newStatus === 'folded' ? 'folded' : newStatus === 'all-in' ? 'all-in' : 'waiting',
        hasActedThisRound: true,
        isCurrent: false,
      };
    }
    if (
      isAggressiveAction &&
      p.status !== 'folded' &&
      p.status !== 'all-in' &&
      i !== playerIndex
    ) {
      return {
        ...p,
        status: p.status === 'thinking' ? 'waiting' : p.status,
        hasActedThisRound: false,
        isCurrent: false,
      };
    }
    return {
      ...p,
      status: p.status === 'thinking' ? 'waiting' : p.status,
      isCurrent: false,
    };
  });

  const nextIndex = getNextPlayerIndex({ players: updatedPlayers }, playerIndex);

  const playersWithCurrent = updatedPlayers.map((p, i) => {
    if (i !== nextIndex) return p;
    if (p.status === 'folded') return p;
    return { ...p, isCurrent: true };
  });

  const logAmount =
    resolvedAction === 'raise' ||
    resolvedAction === 'bet' ||
    resolvedAction === 'call' ||
    resolvedAction === 'all-in'
      ? newBet
      : 0;

  const newLog = {
    id: Date.now(),
    phase: gameState.phase,
    player: player.name,
    action: resolvedAction,
    amount: logAmount,
    pot: newPot,
    timestamp: '刚刚',
  };

  return {
    ...gameState,
    players: playersWithCurrent,
    pot: newPot,
    currentBet: newCurrentBet,
    actionLog: [...(gameState.actionLog || []), newLog],
    currentPlayerIndex: nextIndex,
  };
}

export function getAIDecision(player, gameState) {
  const currentBet = safeNumber(gameState.currentBet);
  const pot = safeNumber(gameState.pot);
  const callAmount = Math.max(0, currentBet - safeNumber(player.bet));

  if (callAmount === 0) {
    const roll = Math.random();
    if (roll < 0.75) {
      return { action: 'check' };
    }
    const base = Math.max(gameState.bigBlind, Math.floor(pot * 0.3));
    const raiseTo = currentBet + base;
    return { action: 'bet', amount: raiseTo };
  }

  const roll = Math.random();
  if (roll < 0.2) {
    return { action: 'fold' };
  }
  if (roll < 0.85) {
    return { action: 'call' };
  }
  const base = Math.max(gameState.bigBlind, Math.floor(pot * 0.3));
  const raiseTo = currentBet + base;
  return { action: 'raise', amount: raiseTo };
}

export function shouldAdvancePhase(gameState) {
  return isBettingRoundComplete(gameState);
}

export function isBettingRoundComplete(gameState) {
  const activePlayers = gameState.players.filter((p) => p.status !== 'folded');
  if (activePlayers.length <= 1) {
    console.log('[isBettingRoundComplete] <=1 active player, complete');
    return true;
  }

  const betActivePlayers = gameState.players.filter(
    (p) => p.status !== 'folded' && p.status !== 'all-in'
  );
  if (betActivePlayers.length <= 1) {
    console.log('[isBettingRoundComplete] <=1 bet-active player, complete');
    return true;
  }

  const allActed = betActivePlayers.every((p) => p.hasActedThisRound === true);
  const allMatched = betActivePlayers.every(
    (p) => safeNumber(p.bet) === safeNumber(gameState.currentBet)
  );
  const complete = allActed && allMatched;

  console.log('[isBettingRoundComplete]', {
    phase: gameState.phase,
    currentBet: gameState.currentBet,
    players: betActivePlayers.map((p) => ({
      name: p.name,
      bet: p.bet,
      hasActed: p.hasActedThisRound,
    })),
    allActed,
    allMatched,
    complete,
  });

  return complete;
}
