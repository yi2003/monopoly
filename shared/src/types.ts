// ============================================================
// 家庭大富翁 — Core Type Definitions
// ============================================================

// ---- Enums ----

export type GamePhase =
  | 'lobby'
  | 'rolling'
  | 'buying'
  | 'stock'
  | 'wheel'
  | 'quiz'
  | 'debt'
  | 'awaitEnd'
  | 'ended';

export type ThemeId = 'classic' | 'shanghai' | 'tokyo';
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'extreme';

export type TileType =
  | 'property'
  | 'railway'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community_chest'
  | 'go'
  | 'jail'
  | 'goto_jail'
  | 'stock_market'
  | 'wheel'
  | 'inner_gate'
  | 'inner_square'
  | 'inner_cafe'
  | 'inner_chance'
  | 'inner_rest'
  | 'inner_fountain'
  | 'inner_shop'
  | 'inner_food'
  | 'inner_community';

export type ColorGroup =
  | 'brown'
  | 'lightblue'
  | 'teal'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'plum'
  | 'green'
  | 'blue'
  | 'railway'
  | 'utility';

export type CardType = 'chance' | 'community_chest';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'storm';

export type CameraMode = 'orbit' | 'thirdPerson' | 'roam';

export type QualityMode = 'performance' | 'balanced';

export type Direction = 'north' | 'south' | 'east' | 'west';

export type PlayerStatus = 'active' | 'jailed' | 'bankrupt';

// ---- Player ----

export interface StockHolding {
  symbol: string;
  shares: number;
  avgCost: number; // weighted average cost basis
}

export interface Player {
  id: string;
  name: string;
  color: string; // hex color
  isBot: boolean;
  isSpectator: boolean;
  autoPilot: boolean; // human player enabled auto-play

  cash: number;
  position: number; // tile index 0-71
  innerCityRing: number; // 0=ground, 1=outer, 2=middle, 3=inner
  innerCitySector: number; // 0-7

  properties: number[]; // tile indices owned
  houses: Record<number, number>; // tileIndex -> house count (0-5)
  stocks: StockHolding[];
  jailTurns: number; // turns spent in jail, 0=not jailed
  getOutOfJailCards: number;
  consecutiveDoubles: number;
  skipNextTurn: boolean;
  status: PlayerStatus;

  // Stats
  totalRentCollected: number;
  totalRentPaid: number;
  totalStockProfit: number;
  totalDividends: number;
  netWorthHistory: number[];
}

// ---- Tiles ----

export interface BaseTile {
  index: number;
  name: string;
  nameCN: string;
  type: TileType;
  ring: 'ground' | 'inner';
}

export interface PropertyTile extends BaseTile {
  type: 'property';
  group: ColorGroup;
  price: number;
  rent: number[]; // [0 houses, 1 house, 2 houses, 3 houses, 4 houses, 5 houses (hotel)]
  houseCost: number;
  mortgageValue: number;
}

export interface RailwayTile extends BaseTile {
  type: 'railway';
  price: number;
  mortgageValue: number;
}

export interface UtilityTile extends BaseTile {
  type: 'utility';
  price: number;
  mortgageValue: number;
}

export interface TaxTile extends BaseTile {
  type: 'tax';
  amount: number;
  isLuxury: boolean;
}

export interface CardTile extends BaseTile {
  type: 'chance' | 'community_chest';
}

export interface SpecialTile extends BaseTile {
  type: 'go' | 'jail' | 'goto_jail' | 'stock_market' | 'wheel';
}

export interface InnerTile extends BaseTile {
  type: 'inner_gate' | 'inner_square' | 'inner_cafe' | 'inner_chance' | 'inner_rest' | 'inner_fountain' | 'inner_shop' | 'inner_food' | 'inner_community';
  fee: number;
  ring: 'inner';
}

export type Tile = PropertyTile | RailwayTile | UtilityTile | TaxTile | CardTile | SpecialTile | InnerTile;

// ---- Cards ----

export interface Card {
  id: number;
  type: CardType;
  description: string;
  descriptionCN: string;
  effect: CardEffect;
}

export type CardEffect =
  | { kind: 'move'; target: number; collectGo: boolean }
  | { kind: 'moveToNearest'; tileType: 'railway' | 'utility'; payMultiplier?: number }
  | { kind: 'cash'; amount: number } // positive = receive, negative = pay
  | { kind: 'cashPerPlayer'; amount: number } // collect from / pay to each player
  | { kind: 'jail' }
  | { kind: 'getOutOfJail' }
  | { kind: 'repairs'; perHouse: number; perHotel: number }
  | { kind: 'moveBack'; spaces: number };

// ---- Stocks ----

export interface Stock {
  symbol: string;
  name: string;
  nameCN: string;
  sector: string;
  initialPrice: number;
  price: number; // current
  priceHistory: number[]; // last 20 rounds
  drift: number; // mean reversion target
  volatility: number;
}

// ---- Game State ----

export interface GameConfig {
  theme: ThemeId;
  difficulty: DifficultyId;
  maxPlayers: number;
  turnLimit: number; // 0 = unlimited
  roomCode: string;
}

export interface TradeRecord {
  round: number;
  playerId: string;
  symbol: string;
  shares: number;
  price: number;
  type: 'buy' | 'sell';
  fee: number;
}

export interface LogEntry {
  id: number;
  round: number;
  timestamp: number;
  message: string;
  type: 'info' | 'rent' | 'card' | 'buy' | 'sell' | 'dividend' | 'bankrupt' | 'victory' | 'jail';
}

export interface WheelSector {
  index: number;
  label: string;
  effect: WheelEffect;
  color: string;
}

export type WheelEffect =
  | { kind: 'cash'; amount: number }
  | { kind: 'jail' }
  | { kind: 'moveToGO' }
  | { kind: 'cashPerPlayer'; amount: number }
  | { kind: 'getOutOfJail' }
  | { kind: 'freeHouse' }
  | { kind: 'freeStock'; symbol: string; shares: number };

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
}

export interface GameState {
  config: GameConfig;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: Player[];
  tiles: Tile[];
  cards: { chance: Card[]; community_chest: Card[] };
  chanceDeck: number[]; // indices into cards.chance
  communityDeck: number[]; // indices into cards.community_chest
  stocks: Stock[];
  trades: TradeRecord[];
  logs: LogEntry[];
  dice: { die1: number; die2: number; total: number; isDoubles: boolean } | null;
  diceRolled: boolean;
  winner: string | null;
  weather: WeatherType;
  weatherTimer: number;
  dayTime: number; // 0-1, position in day/night cycle
  quizActive: boolean;
  quizQuestion: QuizQuestion | null;
  wheelResult: number | null; // sector index
  lastCardDrawn: { type: CardType; card: Card } | null;
  createdAt: number;
}

// ---- Socket Events (client -> server) ----

export interface ClientToServerEvents {
  createRoom: (data: { playerName: string; playerColor: string; theme: ThemeId; difficulty: DifficultyId }) => void;
  joinRoom: (data: { roomCode: string; playerName: string; playerColor: string; asSpectator?: boolean }) => void;
  leaveRoom: () => void;
  addBot: (data: { name: string; color: string }) => void;
  removeBot: (botId: string) => void;
  toggleAutoPilot: (playerId: string) => void;
  startGame: () => void;
  rollDice: () => void;
  buyProperty: (accept: boolean) => void;
  buildHouse: (tileIndex: number) => void;
  sellHouse: (tileIndex: number) => void;
  mortgageProperty: (tileIndex: number) => void;
  unmortgageProperty: (tileIndex: number) => void;
  endTurn: () => void;
  declareBankruptcy: () => void;
  payJailFine: () => void;
  useJailCard: () => void;
  tryJailDoubles: () => void;
  buyStock: (data: { symbol: string; shares: number }) => void;
  sellStock: (data: { symbol: string; shares: number }) => void;
  spinWheel: () => void;
  answerQuiz: (optionIndex: number) => void;
  takeHighSpeedRail: (targetTheme: ThemeId) => void;
  enterInnerCity: (sector: number) => void;
  exitInnerCity: () => void;
  drawChanceCard: () => void;
  drawCommunityCard: () => void;
  chat: (message: string) => void;
  ping: () => void;
}

// ---- Socket Events (server -> client) ----

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  stateDelta: (delta: Partial<GameState> & { playerId?: string }) => void;
  roomInfo: (info: { code: string; players: Player[]; config: GameConfig; playerId?: string }) => void;
  error: (message: string) => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  chatMessage: (data: { playerId: string; playerName: string; message: string }) => void;
  pong: () => void;
}
