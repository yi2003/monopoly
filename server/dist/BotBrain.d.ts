import type { GameState, Player } from '@monopoly/shared';
export interface BotDecision {
    action: 'roll' | 'buy' | 'pass' | 'build' | 'sellHouse' | 'endTurn' | 'payJail' | 'useCard' | 'tryDoubles' | 'spinWheel' | 'answerQuiz';
    tileIndex?: number;
    quizAnswer?: number;
    stockAction?: {
        symbol: string;
        shares: number;
        action: 'buy' | 'sell';
    };
    delay: number;
}
export declare function decideBotAction(state: GameState, player: Player): BotDecision;
//# sourceMappingURL=BotBrain.d.ts.map