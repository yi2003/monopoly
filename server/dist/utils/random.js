// Seeded random (for deterministic bot decisions if needed)
export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
export function generatePlayerId() {
    return 'p_' + Math.random().toString(36).substring(2, 10);
}
//# sourceMappingURL=random.js.map