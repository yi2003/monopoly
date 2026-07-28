import type { GameState, GameEvent } from '@monopoly/shared';
export declare function updateStockPrices(state: GameState): void;
export declare function processDividends(state: GameState): GameEvent[];
export declare function executeBuyStock(state: GameState, playerId: string, symbol: string, shares: number): string | null;
export declare function executeSellStock(state: GameState, playerId: string, symbol: string, shares: number): string | null;
//# sourceMappingURL=StockMarket.d.ts.map