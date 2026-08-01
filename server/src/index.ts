// ============================================================
// 家庭大富翁 — Server Entry Point (v1.4)
// ============================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Player } from '@monopoly/shared';
import { THEMES, DIFFICULTIES, PLAYER_COLORS, AVATAR_IDS, DEFAULT_AVATAR } from '@monopoly/shared';
import { createRoom, joinRoom, leaveRoom, getRoom, canStartGame } from './GameRoom';
import { GameManager } from './GameManager';
import { generatePlayerId, generateRoomCode } from './utils/random';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.up\.railway\.app$/,
];

const app = express();
app.use(cors({ origin: allowedOrigins }));

// Health check for Railway
app.get('/health', (_req, res) => res.send('OK'));

// Serve static client files if they exist (production)
const possibleDirs = [
  path.resolve('../client/dist'),  // Railway monorepo: CWD is /app/server
  path.resolve('client/dist'),    // local dev
  path.resolve('dist'),
];
let clientDist = '';
for (const d of possibleDirs) {
  const testPath = path.join(d, 'index.html');
  if (fs.existsSync(testPath)) { clientDist = d; break; }
}
console.log(`CLIENT_DIST: ${clientDist || 'NOT FOUND, tried: ' + possibleDirs.join(', ')}`);
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    // Missing static asset files (e.g. stale hashed .js/.css referenced by an
    // old cached index.html) should 404, not get index.html back as HTML —
    // a browser would try to execute it as a script and blank out. Any path
    // with a file extension that express.static couldn't serve → 404.
    if (path.extname(req.path)) return next();
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else next();
  });
}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Map room code → GameManager
const games = new Map<string, GameManager>();

// ---- Socket.IO Connection Handling ----

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  let currentRoom: string | null = null;
  let currentPlayerId: string | null = null;

  // ---- Room Management ----

  socket.on('createRoom', (data) => {
    const { playerName, playerColor, avatar, theme, era, difficulty } = data;
    const code = generateRoomCode();

    const room = createRoom(code, playerName, playerColor, avatar || DEFAULT_AVATAR, theme, era || '2025', difficulty);
    const player = room.players[0];

    socket.join(code);
    currentRoom = code;
    currentPlayerId = player.id;

    console.log(`[room] ${code} created by ${playerName}`);

    socket.emit('roomInfo', {
      code,
      players: room.players,
      config: room.config,
      playerId: player.id,
    });
  });

  socket.on('joinRoom', (data) => {
    const { roomCode, playerName, playerColor, avatar, asSpectator } = data;
    const result = joinRoom(roomCode, playerName, playerColor, avatar || DEFAULT_AVATAR, asSpectator || false);

    if ('error' in result) {
      socket.emit('error', result.error);
      return;
    }

    const { room, player } = result;
    socket.join(roomCode);
    currentRoom = roomCode;
    currentPlayerId = player.id;

    console.log(`[room] ${playerName} joined ${roomCode}${asSpectator ? ' (spectator)' : ''}`);

    // Tell the joining player their ID
    socket.emit('roomInfo', {
      code: roomCode,
      players: room.players,
      config: room.config,
      playerId: player.id,
    });

    // Notify other players in room
    socket.to(roomCode).emit('playerJoined', player);
    socket.to(roomCode).emit('roomInfo', {
      code: roomCode,
      players: room.players,
      config: room.config,
    });

    // If game already started, send current state
    const game = games.get(roomCode);
    if (game) {
      socket.emit('gameState', game.state);
    }
  });

  socket.on('leaveRoom', () => {
    if (!currentRoom) return;
    const player = leaveRoom(currentRoom, currentPlayerId || '');
    if (player) {
      socket.leave(currentRoom);
      io.to(currentRoom).emit('playerLeft', player.id);
      console.log(`[room] ${player.name} left ${currentRoom}`);

      // Notify remaining players
      const room = getRoom(currentRoom);
      if (room) {
        io.to(currentRoom).emit('roomInfo', {
          code: currentRoom,
          players: room.players,
          config: room.config,
        });
      }
    }
    currentRoom = null;
    currentPlayerId = null;
  });

  // ---- Bot Management ----

  socket.on('addBot', (data) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    // Check if game already started
    const game = games.get(currentRoom);
    if (game && game.state.phase !== 'lobby') return;

    // Pick random avatar for bot, avoid duplicates with existing players
    const usedAvatars = new Set(room.players.map(p => p.avatar));
    const available = AVATAR_IDS.filter(a => !usedAvatars.has(a));
    const botAvatar = data.avatar || (available.length > 0 ? available[Math.floor(Math.random() * available.length)] : AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]);

    // Create bot player
    const bot: Player = {
      id: `bot_${generatePlayerId()}`,
      name: data.name,
      color: data.color || PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
      avatar: botAvatar,
      isBot: true,
      isSpectator: false,
      autoPilot: false,
      cash: 0,
      position: 0,
      innerCityRing: 0,
      innerCitySector: 0,
      groundRing: 'inner',
      properties: [],
      houses: {},
      stocks: [],
      jailTurns: 0,
      getOutOfJailCards: 0,
      consecutiveDoubles: 0,
      skipNextTurn: false,
      status: 'active',
      totalRentCollected: 0,
      totalRentPaid: 0,
      totalStockProfit: 0,
      totalDividends: 0,
      netWorthHistory: [],
    };

    // Add to room player list
    room.players.push(bot);

    // Also add to game if started
    if (game) {
      game.state.players.push(bot);
    }

    io.to(currentRoom).emit('playerJoined', bot);
    io.to(currentRoom).emit('roomInfo', { code: currentRoom, players: room.players, config: room.config });
    console.log(`[bot] ${bot.name} added to room ${currentRoom}`);
  });

  socket.on('removeBot', (botId) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    const game = games.get(currentRoom);
    if (game && game.state.phase !== 'lobby') return;

    room.players = room.players.filter(p => p.id !== botId);

    if (game) {
      game.state.players = game.state.players.filter(p => p.id !== botId);
    }

    io.to(currentRoom).emit('playerLeft', botId);
    io.to(currentRoom).emit('roomInfo', { code: currentRoom, players: room.players, config: room.config });
    console.log(`[bot] ${botId} removed from room ${currentRoom}`);
  });

  socket.on('toggleAutoPilot', (playerId) => {
    if (!currentRoom) return;
    const game = games.get(currentRoom);
    if (!game) return;
    const player = game.state.players.find(p => p.id === playerId);
    if (player) {
      player.autoPilot = !player.autoPilot;
      io.to(currentRoom).emit('stateDelta', { players: game.state.players });
    }
  });

  // ---- Game Flow ----

  socket.on('startGame', () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || !canStartGame(room)) {
      socket.emit('error', '需要至少2名玩家');
      return;
    }

    const game = new GameManager(room.config, (code, state) => {
      io.to(code).emit('gameState', state);
    });

    // Transfer room players to game — reuse existing player objects so IDs match
    // Copy each player to avoid mutating the room's copy, but preserve the ID
    for (const p of room.players) {
      if (!p.isSpectator) {
        const gamePlayer = { ...p };
        gamePlayer.cash = 0;
        gamePlayer.position = 0;
        gamePlayer.properties = [];
        gamePlayer.houses = {};
        gamePlayer.stocks = [];
        gamePlayer.jailTurns = 0;
        gamePlayer.getOutOfJailCards = 0;
        gamePlayer.consecutiveDoubles = 0;
        gamePlayer.skipNextTurn = false;
        gamePlayer.status = 'active';
        game.state.players.push(gamePlayer);
      }
    }

    games.set(currentRoom, game);
    room.started = true;
    game.startGame();
  });

  socket.on('rollDice', (data) => {
    const game = getGame();
    if (!game) return;
    game.rollDice(data.die1, data.die2);
  });

  socket.on('buyProperty', (accept) => {
    const game = getGame();
    if (!game) return;
    if (accept) game.buyProperty();
    else game.passBuyProperty();
  });

  socket.on('buildHouse', (tileIndex) => {
    const game = getGame();
    if (!game) return;
    game.buildHouse(tileIndex);
  });

  socket.on('sellHouse', (tileIndex) => {
    const game = getGame();
    if (!game) return;
    game.sellHouse(tileIndex);
  });

  socket.on('endTurn', () => {
    const game = getGame();
    if (!game) return;
    game.endTurn();
  });

  socket.on('declareBankruptcy', () => {
    const game = getGame();
    if (!game) return;
    game.endTurn(); // endTurn handles debt phase as bankruptcy
  });

  socket.on('payJailFine', () => {
    const game = getGame();
    if (!game) return;
    game.payJailFine();
  });

  socket.on('useJailCard', () => {
    const game = getGame();
    if (!game) return;
    game.useJailCard();
  });

  socket.on('tryJailDoubles', () => {
    const game = getGame();
    if (!game) return;
    game.tryJailDice();
  });

  socket.on('buyStock', (data) => {
    const game = getGame();
    if (!game) return;
    game.buyStock(data.symbol, data.shares);
  });

  socket.on('sellStock', (data) => {
    const game = getGame();
    if (!game) return;
    game.sellStock(data.symbol, data.shares);
  });

  socket.on('spinWheel', () => {
    const game = getGame();
    if (!game) return;
    game.spinWheel();
  });

  socket.on('takeHighSpeedRail', (targetTheme) => {
    const game = getGame();
    if (!game) return;
    game.takeHighSpeedRail(targetTheme);
  });

  socket.on('enterInnerCity', (sector) => {
    const game = getGame();
    if (!game) return;
    game.enterInnerCity(sector);
  });

  socket.on('exitInnerCity', () => {
    const game = getGame();
    if (!game) return;
    game.exitInnerCity();
  });

  socket.on('transferRing', (toRing: 'inner' | 'outer') => {
    const game = getGame();
    if (!game) return;
    game.transferRing(toRing);
  });

  socket.on('drawChanceCard', () => {
    const game = getGame();
    if (!game) return;
    game.drawCard('chance');
  });

  socket.on('drawCommunityCard', () => {
    const game = getGame();
    if (!game) return;
    game.drawCard('community_chest');
  });

  socket.on('chat', (message) => {
    if (!currentRoom) return;
    const game = games.get(currentRoom);
    const gamePlayer = game?.state.players.find(p => p.id === currentPlayerId);
    const room = getRoom(currentRoom);
    const roomPlayer = room?.players.find(p => p.id === currentPlayerId);
    const playerName = gamePlayer?.name || roomPlayer?.name || 'Unknown';
    io.to(currentRoom).emit('chatMessage', {
      playerId: currentPlayerId || '',
      playerName,
      message,
    });
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  // ---- Disconnect ----

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    if (currentRoom && currentPlayerId) {
      const player = leaveRoom(currentRoom, currentPlayerId);
      if (player) {
        io.to(currentRoom).emit('playerLeft', currentPlayerId);
        const room = getRoom(currentRoom);
        if (room) {
          io.to(currentRoom).emit('roomInfo', {
            code: currentRoom,
            players: room.players,
            config: room.config,
          });
        }
      }
    }
  });

  // Helper — returns the game for the current room. Blocks
  // spectators from performing any game action.
  function getGame(): GameManager | undefined {
    if (!currentRoom || !currentPlayerId) return undefined;
    const room = getRoom(currentRoom);
    if (!room) return undefined;
    const me = room.players.find(p => p.id === currentPlayerId);
    if (me?.isSpectator) return undefined;
    return games.get(currentRoom);
  }
});

// ---- Health Check ----

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', games: games.size, uptime: process.uptime() });
});

// ---- Start ----

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`🏠 家庭大富翁 Server running on port ${PORT}`);
  console.log(`   Socket.IO ready for connections`);
});
