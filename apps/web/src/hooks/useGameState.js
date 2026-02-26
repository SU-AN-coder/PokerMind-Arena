/**
 * useGameState：Day 1 直接读取 mock 数据；后续在此处替换为 WebSocket 订阅。
 */
import { useState } from 'react';
import { mockGameState } from '../mock/gameState';

export const getInitialGameState = () => structuredClone(mockGameState);

export const getInitialAnimState = () => ({
  dealPhase: 'idle', // idle | dealing | done
  dealIndex: -1,
  dealOrder: {},
  dealConfig: {},
  dealRunId: 0,
  flipPhase: 'idle', // idle | flipping | done
  flipTargets: [0, 1, 2],
  flipRunId: 0,
  betPhase: 'idle', // idle | betting | done
  betAmount: 0,
  foldTarget: null, // null | playerId
  showdownPhase: 'idle', // idle | revealing | winner
  showdownRunId: 0,
  showdownReward: 0,
  winnerId: null,
});

export function useGameState() {
  const [gameState, setGameState] = useState(getInitialGameState());
  const [animState, setAnimState] = useState(getInitialAnimState());

  // TODO: Day 9（联调时）替换为 WebSocket 订阅
  // useEffect(() => {
  //   const ws = new WebSocket(WS_URL);
  //   ws.onmessage = (e) => setGameState(JSON.parse(e.data));
  // }, []);

  return { gameState, setGameState, animState, setAnimState };
}
