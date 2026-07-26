import type { Player, GameConfig, ThemeId, DifficultyId } from '@monopoly/shared';
export interface RoomState {
    code: string;
    players: Player[];
    config: GameConfig;
    createdAt: number;
    started: boolean;
}
export declare function createRoom(code: string, hostName: string, hostColor: string, theme: ThemeId, difficulty: DifficultyId): RoomState;
export declare function joinRoom(code: string, name: string, color: string, asSpectator: boolean): {
    room: RoomState;
    player: Player;
} | {
    error: string;
};
export declare function leaveRoom(code: string, playerId: string): Player | null;
export declare function getRoom(code: string): RoomState | undefined;
export declare function getAllRooms(): Map<string, RoomState>;
export declare function canStartGame(room: RoomState): boolean;
export declare function cleanupStaleRooms(maxAgeMs?: number): void;
//# sourceMappingURL=GameRoom.d.ts.map