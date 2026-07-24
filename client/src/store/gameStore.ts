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

  // Game state (mirror from server)
  gameState: GameState | null;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: Player[];
  dice: { die1: number; die2: number; total: number; isDoubles: boolean } | null;
  diceRolled: boolean;
  winner: string | null;
  logs: { id: number; message: string; type: string; timestamp: number }[];

  // UI state
  cameraMode: CameraMode;
  qualityMode: QualityMode;
  showStockPanel: boolean;
  showPortfolio: boolean;
  showBuildPanel: boolean;
  selectedTile: number | null;
  roamFov: number;
  phaseDelayUntil: number; // suppress action modals until character finishes walking

  // Actions
  setConnected: (connected: boolean) => void;
  setRoomInfo: (code: string, playerId: string) => void;
  setGameState: (state: GameState) => void;
  setCameraMode: (mode: CameraMode) => void;
  setQualityMode: (mode: QualityMode) => void;
  setRoamFov: (fov: number) => void;
  toggleStockPanel: () => void;
  togglePortfolio: () => void;
  toggleBuildPanel: () => void;
  selectTile: (index: number | null) => void;
  reset: () => void;
}

const defaultGameState: GameState = {
  config: { theme: 'classic', difficulty: 'normal', maxPlayers: 6, turnLimit: 0, roomCode: '' },
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
  quizActive: false,
  quizQuestion: null,
  wheelResult: null,
  lastCardDrawn: null,
  createdAt: Date.now(),
};

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  roomCode: null,
  playerId: null,

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

    set({
      gameState: state,
      phase: state.phase,
      round: state.round,
      currentPlayerIndex: state.currentPlayerIndex,
      players: [...state.players],
      dice: state.dice,
      diceRolled: state.diceRolled,
      winner: state.winner,
      logs: [...state.logs],
      phaseDelayUntil: delayUntil,
    });
  },

  setCameraMode: (mode) => set({ cameraMode: mode }),
  setQualityMode: (mode) => set({ qualityMode: mode }),
  setRoamFov: (fov) => set({ roamFov: Math.max(65, Math.min(90, fov)) }),
  toggleStockPanel: () => set(s => ({ showStockPanel: !s.showStockPanel })),
  togglePortfolio: () => set(s => ({ showPortfolio: !s.showPortfolio })),
  toggleBuildPanel: () => set(s => ({ showBuildPanel: !s.showBuildPanel })),
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
    selectedTile: null,
  }),
}));
