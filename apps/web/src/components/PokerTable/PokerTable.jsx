/**
 * PokerTable：牌桌主容器（椭圆桌面、木质边框、座位布局、中央公共牌/底池）。
 */
import { motion } from 'framer-motion';
import CommunityCards from '../CommunityCards/CommunityCards.jsx';
import PlayerSeat from '../PlayerSeat/PlayerSeat.jsx';
import ChipStack from '../ChipStack/ChipStack.jsx';
import PlayingCard from '../PlayingCard/PlayingCard.jsx';

const POS_STYLE = {
  bottom: 'bottom-[-70px] left-1/2 -translate-x-1/2',
  top: 'top-[-70px] left-1/2 -translate-x-1/2',
  left: 'left-[-130px] top-1/2 -translate-y-1/2',
  right: 'right-[-130px] top-1/2 -translate-y-1/2',
};

const BET_STYLE = {
  top: { style: { top: '24px', left: '500px' }, className: '' },
  bottom: { style: { bottom: '24px', left: '250px' }, className: '' },
  left: { style: { top: '50%', left: '48px' }, className: '-translate-y-1/2' },
  right: { style: { top: '39%', right: '60px' }, className: '-translate-y-1/2' },
};

export default function PokerTable({ gameState, animState, animationRefs }) {
  const lastActionByPlayer = (gameState.actionLog || []).reduce((acc, log) => {
    acc[log.player] = log;
    return acc;
  }, {});
  const { deckRef, registerCardRef } = animationRefs || {};

  return (
    <motion.div className="relative w-full h-full flex-1 min-h-0">
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[999px] p-6"
        style={{
          width: '70vw',
          maxWidth: '900px',
          height: '55vh',
          maxHeight: '500px',
          background:
            'linear-gradient(135deg, rgba(60,34,18,0.95) 0%, rgba(25,14,8,0.95) 45%, rgba(70,40,20,0.95) 100%)',
          boxShadow:
            '0 30px 120px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(201,168,76,0.18)',
        }}
      >
        <motion.div
          className="relative h-full w-full rounded-[999px]"
          style={{
            background:
              'radial-gradient(ellipse, #1a5c35 0%, #0d3320 70%, #071a10 100%)',
            boxShadow:
              'inset 0 0 40px rgba(201,168,76,0.10), inset 0 0 0 1px rgba(0,0,0,0.5)',
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-[999px] pointer-events-none"
            style={{ boxShadow: 'inset 0 0 140px rgba(0,0,0,0.55)' }}
          />

          <motion.div
            ref={deckRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ transform: 'translate(-50%, -50%) translateX(240px)' }}
          >
            {Array.from({ length: 3 }).map((_, idx) => (
              <motion.div
                key={`deck-${idx}`}
                className="absolute"
                style={{ top: `${idx * -3}px`, left: `${idx * 5}px` }}
              >
                <PlayingCard card="??" faceDown size="sm" />
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <CommunityCards
              phase={gameState.phase}
              pot={gameState.pot}
              communityCards={gameState.communityCards}
              animState={animState}
            />
          </motion.div>

          {gameState.players.map((player) => {
            if (!player.bet) return null;
            const betPos = BET_STYLE[player.position];
            if (!betPos) return null;
            return (
              <motion.div
                key={`bet-${player.id}`}
                className={`absolute z-10 ${betPos.className}`}
                style={betPos.style}
              >
                <ChipStack amount={player.bet} />
              </motion.div>
            );
          })}

          {gameState.players.map((player) => (
            <motion.div
              key={player.id}
              className={`absolute transform ${POS_STYLE[player.position]}`}
            >
              <PlayerSeat
                player={{
                  ...player,
                  lastAction: lastActionByPlayer[player.name],
                }}
                position={player.position}
                animState={animState}
                registerCardRef={registerCardRef}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
