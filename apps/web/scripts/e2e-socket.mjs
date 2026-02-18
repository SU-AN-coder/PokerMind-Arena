import { io } from 'socket.io-client';

const SERVER = 'http://localhost:3001';

const host = io(SERVER);
let roomId = null;

function log(prefix, data) {
  const payload = data ? JSON.stringify(data) : '';
  console.log(`${prefix} ${payload}`.trim());
}

function attachListeners(socket, label) {
  const events = [
    'connected',
    'room_created',
    'room_joined',
    'player_joined',
    'game_state',
    'round_started',
    'cards_dealt',
    'community_cards',
    'player_allin',
    'player_fold',
    'phase_changed',
    'showdown',
    'round_ended',
    'game_ended',
    'error'
  ];

  for (const evt of events) {
    socket.on(evt, (data) => log(`[${label}] ${evt}:`, data));
  }
}

attachListeners(host, 'HOST');

host.on('connected', () => {
  host.emit('create_room', { name: 'Host', avatar: '🔥' });
});

host.on('room_created', (data) => {
  roomId = data.roomId;
  log('[SYS] room ready', { roomId });

  const guest = io(SERVER);
  attachListeners(guest, 'GUEST');

  guest.on('connected', () => {
    guest.emit('join_room', { roomId, name: 'Guest', avatar: '🧊' });
  });

  guest.on('room_joined', () => {
    setTimeout(() => host.emit('start_game'), 500);
  });

  host.on('cards_dealt', () => {
    setTimeout(() => host.emit('player_action', { action: 'allin', speech: 'All in!' }), 300);
    setTimeout(() => guest.emit('player_action', { action: 'allin', speech: 'Call.' }), 800);
  });

  host.on('game_ended', () => {
    setTimeout(() => {
      host.disconnect();
      guest.disconnect();
      console.log('[SYS] demo completed');
      process.exit(0);
    }, 500);
  });
});

host.on('connect_error', (err) => {
  console.error('connect_error', err);
  process.exit(1);
});
