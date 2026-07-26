import type { GameState, Player } from '@monopoly/shared';
export declare class RuleEngine {
    private state;
    constructor(state: GameState);
    get currentPlayer(): Player;
    get effConfig(): import("@monopoly/shared").EffectiveConfig;
    validateRollDice(): string | null;
    processDiceResult(dice: {
        die1: number;
        die2: number;
        total: number;
        isDoubles: boolean;
    }): {
        passedGo: boolean;
        newPosition: number;
        extraRoll: boolean;
    };
    processLanding(position: number, extraRentMultiplier?: number): {
        phase: 'buying' | 'stock' | 'wheel' | 'debt' | 'awaitEnd';
        rentAmount: number;
        rentTarget: string | null;
        cardType: 'chance' | 'community_chest' | null;
    };
    validateBuyProperty(): string | null;
    executeBuyProperty(): void;
    validateBuildHouse(tileIndex: number): string | null;
    executeBuildHouse(tileIndex: number): void;
    validateSellHouse(tileIndex: number): string | null;
    executeSellHouse(tileIndex: number): void;
    declareBankruptcy(): {
        creditor: Player | null;
    };
    findOwner(tileIndex: number): Player | undefined;
    findCreditor(): Player | null;
    checkWinner(): Player | null;
    private calcNetWorth;
    private addLog;
}
//# sourceMappingURL=RuleEngine.d.ts.map