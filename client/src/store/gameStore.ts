// ============================================================
// gameStore — Zustand store mirroring server game state
// ============================================================

import { create } from 'zustand';
import type { GameState, Player, GamePhase, CameraMode, QualityMode, ThemeId, DifficultyId } from '@monopoly/shared';
import { createTiles, initStocks } from '@monopoly/shared';

interface GameStore {
  // Connection
  connected: boolean;
  roomCode: string | null;
  playerId: string | null;
  isSpectator: boolean;

  // Game state (mirror from server)
  gameState: GameState | null;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: Player[];
  dice: { die1: number; die2: number; total: number; isDoubles: boolean } | null;
  diceRolled: boolean;
  winner: string | null;
  logs: { id: number; round: number; message: string; messageEN?: string; type: string; timestamp: number }[];

  // UI state
  cameraMode: CameraMode;
  qualityMode: QualityMode;
  showStockPanel: boolean;
  showPortfolio: boolean;
  showBuildPanel: boolean;
  selectedTile: number | null;
  roamFov: number;
  phaseDelayUntil: number; // suppress action modals until character finishes walking
  logCutoffId: number; // hide logs with id <= this after clear
  diceSpinning: boolean; // whether dice are in manual-stop spinning mode

  // Actions
  setConnected: (connected: boolean) => void;
  setRoomInfo: (code: string, playerId: string) => void;
  setGameState: (state: GameState) => void;
  setCameraMode: (mode: CameraMode) => void;
  setQualityMode: (mode: QualityMode) => void;
  setRoamFov: (fov: number) => void;
  setDiceSpinning: (spinning: boolean) => void;
  toggleStockPanel: () => void;
  togglePortfolio: () => void;
  toggleBuildPanel: () => void;
  clearLogs: () => void;
  selectTile: (index: number | null) => void;
  reset: () => void;
}

const defaultGameState: GameState = {
  config: { theme: 'classic', era: '2025', difficulty: 'normal', maxPlayers: 6, turnLimit: 0, roomCode: '' },
  phase: 'lobby',
  round: 0,
  currentPlayerIndex: 0,
  players: [],
  tiles: createTiles(),
  cards: { chance: [], community_chest: [] },
  chanceDeck: [],
  communityDeck: [],
  stocks: initStocks(),
  trades: [],
  logs: [],
  dice: null,
  diceRolled: false,
  winner: null,
  weather: 'clear',
  weatherTimer: 30,
  dayTime: 0.3,
  wheelResult: null,
  cardChoice: null,
  actionCardPrompt: null,
  gods: [],
  lastCardDrawn: null,
  gameEvent: null,
  ringTransferred: false,
  createdAt: Date.now(),
};

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  roomCode: null,
  playerId: null,
  isSpectator: false,

  gameState: null,
  phase: 'lobby',
  round: 0,
  currentPlayerIndex: 0,
  players: [],
  dice: null as { die1: number; die2: number; total: number; isDoubles: boolean } | null,
  diceRolled: false,
  winner: null,
  logs: [],

  cameraMode: 'orbit',
  qualityMode: 'balanced',
  showStockPanel: false,
  showPortfolio: false,
  showBuildPanel: false,
  selectedTile: null,
  roamFov: 75,
  phaseDelayUntil: 0,
  logCutoffId: 0,
  diceSpinning: false,

  setConnected: (connected) => set({ connected }),

  setRoomInfo: (code, playerId) => set({ roomCode: code, playerId }),

  setGameState: (state) => {
    const prev = get();
    let delayUntil = prev.phaseDelayUntil;

    // When new dice appear, calculate walk delay (compare by value, not reference)
    const diceChanged = state.dice && prev.dice
      ? state.dice.die1 !== prev.dice.die1 || state.dice.die2 !== prev.dice.die2
      : state.dice !== prev.dice;
    if (state.dice && diceChanged) {
      const steps = state.dice.total;
      const walkTimeSec = steps / 5.5; // WALK_SPEED tiles/sec
      delayUntil = Date.now() + walkTimeSec * 1000 + 1200; // +1.2s buffer for waypoint settling
    }

    // Clear delay if returning to rolling (new turn)
    if (state.phase === 'rolling' && !state.diceRolled) {
      delayUntil = 0;
    }

    // Determine diceSpinning: true when human player's turn in rolling phase, no dice yet
    const cp = state.players[state.currentPlayerIndex];
    const myId = prev.playerId;
    const shouldSpin = state.phase === 'rolling'
      && !state.diceRolled
      && !state.dice
      && cp
      && !cp.isBot
      && cp.id === myId;

    set({
      gameState: state,
      phase: state.phase,
      round: state.round,
      currentPlayerIndex: state.currentPlayerIndex,
      players: [...state.players],
      dice: state.dice,
      diceRolled: state.diceRolled,
      winner: state.winner,
      logs: state.logs.filter(l => l.id > prev.logCutoffId),
      phaseDelayUntil: delayUntil,
      diceSpinning: shouldSpin,
    });
  },

  setCameraMode: (mode) => set({ cameraMode: mode }),
  setQualityMode: (mode) => set({ qualityMode: mode }),
  setRoamFov: (fov) => set({ roamFov: Math.max(65, Math.min(90, fov)) }),
  setDiceSpinning: (spinning) => set({ diceSpinning: spinning }),
  toggleStockPanel: () => set(s => ({ showStockPanel: !s.showStockPanel })),
  togglePortfolio: () => set(s => ({ showPortfolio: !s.showPortfolio })),
  toggleBuildPanel: () => set(s => ({ showBuildPanel: !s.showBuildPanel })),
  clearLogs: () => {
    const { logs } = get();
    const maxId = logs.length > 0 ? Math.max(...logs.map(l => l.id)) : 0;
    set({ logs: [], logCutoffId: maxId });
  },
  selectTile: (index) => set({ selectedTile: index }),

  reset: () => set({
    gameState: null,
    phase: 'lobby',
    round: 0,
    currentPlayerIndex: 0,
    players: [],
    dice: null as { die1: number; die2: number; total: number; isDoubles: boolean } | null,
    diceRolled: false,
    winner: null,
    logs: [],
    showStockPanel: false,
    showPortfolio: false,
    showBuildPanel: false,
    logCutoffId: 0,
    selectedTile: null,
    isSpectator: false,
    diceSpinning: false,
  }),
}));
