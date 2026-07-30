import type { GameState, GameConfig, Player, ThemeId } from '@monopoly/shared';
import { RuleEngine } from './RuleEngine';
export declare class GameManager {
    state: GameState;
    private botTimers;
    private onStateChange;
    private logIdCounter;
    constructor(config: GameConfig, onStateChange: (roomCode: string, state: GameState) => void);
    get engine(): RuleEngine;
    addPlayer(name: string, color?: string, isBot?: boolean): Player;
    removePlayer(playerId: string): void;
    startGame(): void;
    get currentPlayer(): Player;
    rollDice(): {
        dice: {
            die1: number;
            die2: number;
            total: number;
            isDoubles: boolean;
        };
        result: any;
    };
    buyProperty(): {
        success: boolean;
        error?: string;
    };
    passBuyProperty(): {
        success: boolean;
    };
    buildHouse(tileIndex: number): {
        success: boolean;
        error?: string;
    };
    sellHouse(tileIndex: number): {
        success: boolean;
        error?: string;
    };
    endTurn(): void;
    private advanceTurn;
    private playerInJail;
    payJailFine(): {
        success: boolean;
    };
    useJailCard(): {
        success: boolean;
    };
    tryJailDice(): {
        success: boolean;
    };
    drawCard(type: 'chance' | 'community_chest'): void;
    private applyCardEffect;
    spinWheel(): number;
    buyStock(symbol: string, shares: number): {
        success: boolean;
        error?: string;
    };
    sellStock(symbol: string, shares: number): {
        success: boolean;
        error?: string;
    };
    takeHighSpeedRail(targetTheme: ThemeId): {
        success: boolean;
        error?: string;
    };
    enterInnerCity(sector: number): {
        success: boolean;
    };
    exitInnerCity(): {
        success: boolean;
    };
    transferRing(toRing: 'inner' | 'outer'): {
        success: boolean;
        error?: string;
    };
    private scheduleBotTurn;
    private executeBotAction;
    clearBotTimers(): void;
    private emitChange;
    private addLog;
    private emitEvent;
    private rollWeather;
}
//# sourceMappingURL=GameManager.d.ts.map