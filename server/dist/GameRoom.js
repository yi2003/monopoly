// ============================================================
// GameRoom — Room lifecycle management
// ============================================================
import { PLAYER_COLORS, MAX_PLAYERS, MIN_PLAYERS_TO_START } from '@monopoly/shared';
import { generatePlayerId } from './utils/random';
const rooms = new Map();
export function createRoom(code, hostName, hostColor, theme, era, difficulty) {
    const host = {
        id: generatePlayerId(),
        name: hostName,
        color: hostColor || PLAYER_COLORS[0],
        isBot: false,
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
    const room = {
        code,
        players: [host],
        config: {
            theme,
            era,
            difficulty,
            maxPlayers: MAX_PLAYERS,
            turnLimit: 0,
            roomCode: code,
        },
        createdAt: Date.now(),
        started: false,
    };
    rooms.set(code, room);
    return room;
}
export function joinRoom(code, name, color, asSpectator) {
    const room = rooms.get(code);
    if (!room)
        return { error: '房间不存在' };
    if (room.started && !asSpectator)
        return { error: '游戏已开始，只能以旁观者身份加入' };
    const activePlayers = room.players.filter(p => !p.isSpectator);
    if (!asSpectator && activePlayers.length >= room.config.maxPlayers) {
        return { error: '房间已满' };
    }
    const player = {
        id: generatePlayerId(),
        name,
        color: color || PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
        isBot: false,
        isSpectator: asSpectator,
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
    room.players.push(player);
    return { room, player };
}
export function leaveRoom(code, playerId) {
    const room = rooms.get(code);
    if (!room)
        return null;
    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx === -1)
        return null;
    const [removed] = room.players.splice(idx, 1);
    // Cleanup empty rooms
    if (room.players.length === 0) {
        rooms.delete(code);
    }
    return removed;
}
export function getRoom(code) {
    return rooms.get(code);
}
export function getAllRooms() {
    return rooms;
}
export function canStartGame(room) {
    const activePlayers = room.players.filter(p => !p.isSpectator);
    return activePlayers.length >= MIN_PLAYERS_TO_START;
}
export function cleanupStaleRooms(maxAgeMs = 3600000) {
    const now = Date.now();
    for (const [code, room] of rooms) {
        if (!room.started && now - room.createdAt > maxAgeMs) {
            rooms.delete(code);
        }
    }
}
//# sourceMappingURL=GameRoom.js.map