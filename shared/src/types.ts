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
  | 'cardChoice'
  | 'rentChoice'
  | 'god' // transient: god-pickup landing, consumed within the same turn step
  | 'debt'
  | 'awaitEnd'
  | 'ended';

export type ThemeId = 'classic' | 'shanghai' | 'tokyo';
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'extreme';
export type EraId = '1945' | '1985' | '2025' | '2055';

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
  // Outer ring groups
  | 'outer_amber'
  | 'outer_mint'
  | 'outer_coral'
  | 'outer_lime'
  | 'outer_violet'
  | 'outer_rose'
  | 'outer_sky'
  | 'outer_ruby'
  | 'outer_copper'
  | 'outer_navy'
  | 'railway'
  | 'utility';

export type CardType = 'chance' | 'community_chest';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'storm';

export type CameraMode = 'orbit' | 'thirdPerson' | 'roam';

export type QualityMode = 'performance' | 'balanced';

export type Direction = 'north' | 'south' | 'east' | 'west';

export type PlayerStatus = 'active' | 'jailed' | 'bankrupt';

export type GodKind = 'wealth' | 'misfortune';

export type AvatarId = 'tycoon' | 'chef' | 'explorer' | 'athlete' | 'royal' | 'cowboy' | 'artist' | 'wizard';

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
  avatar: AvatarId; // character appearance
  isBot: boolean;
  isSpectator: boolean;
  autoPilot: boolean; // human player enabled auto-play

  cash: number;
  position: number; // tile index 0-119
  innerCityRing: number; // 0=on ground ring, 1=outer, 2=middle, 3=inner
  innerCitySector: number; // 0-7
  groundRing: 'inner' | 'outer'; // which ground ring (when innerCityRing === 0)

  properties: number[]; // tile indices owned
  houses: Record<number, number>; // tileIndex -> house count (0-5)
  stocks: StockHolding[];
  jailTurns: number; // turns spent in jail, 0=not jailed
  getOutOfJailCards: number;
  heldCards: number[]; // ids of held action cards (rentFree / doubleRent / rob / dismissGod / summonGod)
  god: { kind: GodKind; turnsLeft: number } | null; // attached god spirit
  consecutiveDoubles: number;
  skipNextTurn: boolean;
  freeBuildPending: boolean; // 免费建屋卡已激活 — next house build costs nothing
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
  ring: 'ground-inner' | 'ground-outer' | 'inner';
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
  hold?: boolean; // if true, drawing adds the card to the player's hand instead of resolving immediately
}

export type CardEffect =
  | { kind: 'move'; target: number; collectGo: boolean }
  | { kind: 'moveToNearest'; tileType: 'railway' | 'utility'; payMultiplier?: number }
  | { kind: 'cash'; amount: number } // positive = receive, negative = pay
  | { kind: 'cashPerPlayer'; amount: number } // collect from / pay to each player
  | { kind: 'jail' }
  | { kind: 'getOutOfJail' }
  | { kind: 'repairs'; perHouse: number; perHotel: number }
  | { kind: 'moveBack'; spaces: number }
  // Held action cards (played later, not resolved on draw)
  | { kind: 'rentFree' } // skip the next rent you owe
  | { kind: 'doubleRent' } // charge 2× rent when an opponent lands on your property
  | { kind: 'rob'; amount: number } // steal from a target player on your turn
  | { kind: 'dismissGod' } // 送神卡 — dismiss the god attached to you
  | { kind: 'summonGod' } // 请神卡 — summon the nearest god within view onto yourself
  | { kind: 'skipTurn' } // 跳回合卡 — make a target player skip their next turn
  | { kind: 'buildFree' } // 免费建屋卡 — your next house build is free
  | { kind: 'stealProperty' } // 强征地产卡 — steal one unimproved property from a target
  | { kind: 'swapPositions' }; // 移形换位卡 — swap board positions with a target

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
  era: EraId;
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
  messageEN?: string;
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

// ---- God spirits (财神 / 衰神) ----

export interface GodEntity {
  id: number;
  kind: GodKind;
  tileIndex: number; // ground tile (0-47 inner ring, 72-119 outer ring)
}

// ---- Held action card prompt (rent decision) ----

export interface ActionCardPrompt {
  kind: 'rentFree' | 'doubleRent';
  actorId: string; // who must decide (owner for doubleRent, payer for rentFree)
  payerId: string; // the current player who owes rent
  ownerId: string;
  baseRent: number; // rent computed by processLanding (before the double-rent ×2)
  tileIndex: number;
  tileName: string;
  tileNameCN: string;
}

// ---- Game Event Notification (for card popups) ----

export type GameEvent =
  | { kind: 'rent'; playerId: string; targetId: string; amount: number; tileIndex: number; tileName: string; tileNameCN: string }
  | { kind: 'tax'; playerId: string; amount: number; isLuxury: boolean }
  | { kind: 'go_salary'; playerId: string; amount: number }
  | { kind: 'jail_in'; playerId: string; reason: 'goto_jail' | 'three_doubles' | 'wheel' | 'card' }
  | { kind: 'jail_out'; playerId: string; method: 'pay_fine' | 'use_card' | 'doubles' | 'forced' }
  | { kind: 'dividend'; playerId: string; symbol: string; stockName: string; stockNameCN: string; shares: number; amount: number }
  | { kind: 'card'; playerId: string; cardType: 'chance' | 'community_chest'; description: string; descriptionCN: string }
  | { kind: 'cardUsed'; playerId: string; cardId: number; description: string; descriptionCN: string; targetId?: string; amount?: number }
  | { kind: 'rob'; actorId: string; targetId: string; amount: number }
  | { kind: 'god_attach'; playerId: string; god: GodKind }
  | { kind: 'god_dismiss'; playerId: string; god: GodKind }
  | { kind: 'god_wealth_collect'; playerId: string; amountPer: number; targetIds: string[]; total: number }
  | { kind: 'god_card_lost'; playerId: string; lost: number }
  | { kind: 'weather'; from: string; to: string }
  | { kind: 'maintenance'; playerId: string; amount: number; rate: number }
  | { kind: 'game_over'; winnerId: string; winnerName: string };

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
  wheelResult: number | null; // sector index
  cardChoice: { type: 'chance' | 'community_chest'; options: { idx: number }[] } | null; // face-down cards offered to current player
  actionCardPrompt: ActionCardPrompt | null; // pending rent decision (rentFree / doubleRent)
  gods: GodEntity[]; // god spirits floating on the board
  lastCardDrawn: { type: CardType; card: Card } | null;
  gameEvent: GameEvent | null;
  ringTransferred: boolean; // prevent double-transfer spam
  createdAt: number;
}

// ---- Socket Events (client -> server) ----

export interface ClientToServerEvents {
  createRoom: (data: { playerName: string; playerColor: string; avatar: AvatarId; theme: ThemeId; era: EraId; difficulty: DifficultyId }) => void;
  joinRoom: (data: { roomCode: string; playerName: string; playerColor: string; avatar: AvatarId; asSpectator?: boolean }) => void;
  leaveRoom: () => void;
  addBot: (data: { name: string; color: string; avatar?: AvatarId }) => void;
  removeBot: (botId: string) => void;
  toggleAutoPilot: (playerId: string) => void;
  startGame: () => void;
  rollDice: (data: { die1: number; die2: number }) => void;
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
  takeHighSpeedRail: (targetTheme: ThemeId) => void;
  enterInnerCity: (sector: number) => void;
  exitInnerCity: () => void;
  transferRing: (toRing: 'inner' | 'outer') => void;
  pickCard: (data: { choiceIndex: number }) => void;
  useHeldCard: (data: { cardId: number; targetId?: string }) => void;
  payRentNow: () => void;
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
