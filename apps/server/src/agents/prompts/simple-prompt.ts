/**
 * PokerMind Arena - Prompt 构建器
 * 
 * 为 All-in or Fold 规则构建简化 Prompt
 */

import type { SimpleGameContext } from '../types.js';

/**
 * 构建简化游戏 Prompt
 */
export function buildSimplePrompt(ctx: SimpleGameContext): string {
  return `
# 扑克牌局 - 第${ctx.round}轮

## 你是：${ctx.yourName}
## 底池：$${ctx.potSize}

## 你的手牌：${ctx.holeCards}
## 公共牌：${ctx.communityCards || '（还没发）'}

## 存活玩家
${ctx.survivingPlayers.map(p => 
  `- ${p.name}: $${p.stack} ${p.lastAction}`
).join('\n')}

## 最近对话
${ctx.recentDialogue.length > 0 ? ctx.recentDialogue.join('\n') : '（暂无）'}

---

## 你的选择（只能二选一）

**All-in** - 全押 $${ctx.yourStack} 进入底池
**Fold** - 弃牌认输

请直接返回JSON：
\`\`\`json
{
  "action": "allin" | "fold",
  "speech": "你的垃圾话（30字以内，可@其他玩家名字）",
  "emotion": "confident" | "angry" | "mocking" | "nervous" | "neutral",
  "target": "被@的玩家名，没有则null"
}
\`\`\`
`;
}

/**
 * 将游戏状态转换为 SimpleGameContext
 */
export function buildContextFromGameState(
  gameState: {
    round: number;
    pot: number;
    communityCards: string[];
    players: {
      id: string;
      name: string;
      chips: number;
      holeCards: string[];
      status: string;
    }[];
  },
  currentPlayerId: string,
  recentDialogue: string[]
): SimpleGameContext {
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  
  if (!currentPlayer) {
    throw new Error(`Player ${currentPlayerId} not found`);
  }
  
  return {
    yourName: currentPlayer.name,
    holeCards: currentPlayer.holeCards.join(' '),
    communityCards: gameState.communityCards.join(' ') || '-',
    yourStack: currentPlayer.chips,
    potSize: gameState.pot,
    survivingPlayers: gameState.players
      .filter(p => p.status === 'active' || p.status === 'allin')
      .map(p => ({
        name: p.name,
        stack: p.chips,
        lastAction: p.status === 'allin' ? '(All-in)' : ''
      })),
    recentDialogue: recentDialogue.slice(-5),
    round: gameState.round
  };
}
