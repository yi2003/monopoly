// ============================================================
// BotBrain — Heuristic AI decision-making
// ============================================================
import { getPropertyDef, getRailwayDef, getUtilityDef, canBuildHouse } from '@monopoly/shared';
const REGULAR_DELAY = 1000;
const POST_DICE_DELAY = 2800;
export function decideBotAction(state, player) {
    const phase = state.phase;
    switch (phase) {
        case 'rolling':
            return decideRollingAction(state, player);
        case 'buying':
            return decideBuyingAction(state, player);
        case 'debt':
            return decideDebtAction(state, player);
        case 'awaitEnd':
            return decideAwaitEndAction(state, player);
        case 'stock':
            return decideStockAction(state, player);
        default:
            return { action: 'pass', delay: REGULAR_DELAY };
    }
}
function decideRollingAction(state, player) {
    // If in jail, decide jail strategy
    if (player.status === 'jailed') {
        if (player.jailTurns >= 3) {
            return { action: 'payJail', delay: REGULAR_DELAY };
        }
        if (player.getOutOfJailCards > 0) {
            return { action: 'useCard', delay: REGULAR_DELAY };
        }
        // Try doubles
        return { action: 'roll', delay: REGULAR_DELAY };
    }
    // Consider building before rolling
    const buildTarget = findBestBuild(state, player);
    if (buildTarget !== null && Math.random() < 0.6) {
        return { action: 'build', tileIndex: buildTarget, delay: REGULAR_DELAY };
    }
    return { action: 'roll', delay: REGULAR_DELAY };
}
function decideBuyingAction(state, player) {
    const tile = state.tiles[player.position];
    let price = 0;
    const prop = getPropertyDef(player.position);
    if (prop)
        price = prop.price;
    else {
        const rail = getRailwayDef(player.position);
        if (rail)
            price = rail.price;
        else {
            const util = getUtilityDef(player.position);
            if (util)
                price = util.price;
        }
    }
    // Buy if affordable and leaves decent cash reserve (>30%)
    const minReserve = player.cash * 0.3;
    if (player.cash - price >= minReserve) {
        return { action: 'buy', delay: REGULAR_DELAY };
    }
    // Buy anyway if cheap
    if (price <= player.cash * 0.15) {
        return { action: 'buy', delay: REGULAR_DELAY };
    }
    return { action: 'pass', delay: REGULAR_DELAY };
}
function decideDebtAction(state, player) {
    // Sell houses to raise funds
    const houseEntry = Object.entries(player.houses).find(([, count]) => count > 0);
    if (houseEntry) {
        return { action: 'sellHouse', tileIndex: Number(houseEntry[0]), delay: REGULAR_DELAY };
    }
    // No more options → declare bankruptcy
    return { action: 'endTurn', delay: REGULAR_DELAY }; // will trigger bankruptcy
}
function decideAwaitEndAction(state, player) {
    // Try to build
    const buildTarget = findBestBuild(state, player);
    if (buildTarget !== null && Math.random() < 0.5) {
        return { action: 'build', tileIndex: buildTarget, delay: REGULAR_DELAY };
    }
    return { action: 'endTurn', delay: REGULAR_DELAY };
}
function decideStockAction(state, player) {
    // Simple momentum strategy
    const affordable = state.stocks
        .filter(s => s.price <= player.cash * 0.3)
        .sort(() => Math.random() - 0.5);
    if (affordable.length > 0 && Math.random() < 0.5) {
        const stock = affordable[0];
        const maxShares = Math.floor(player.cash * 0.2 / stock.price);
        if (maxShares > 0) {
            const shares = Math.max(1, Math.floor(maxShares * Math.random()));
            return {
                action: 'pass',
                stockAction: { symbol: stock.symbol, shares, action: 'buy' },
                delay: REGULAR_DELAY,
            };
        }
    }
    return { action: 'endTurn', delay: REGULAR_DELAY };
}
function findBestBuild(state, player) {
    const buildable = [];
    for (const idx of player.properties) {
        const prop = getPropertyDef(idx);
        if (!prop)
            continue;
        if (canBuildHouse(player, idx) && player.cash >= prop.houseCost * 2) {
            buildable.push(idx);
        }
    }
    if (buildable.length === 0)
        return null;
    // Prefer building on more expensive properties
    buildable.sort((a, b) => {
        const pa = getPropertyDef(a).price;
        const pb = getPropertyDef(b).price;
        return pb - pa;
    });
    return buildable[0];
}
//# sourceMappingURL=BotBrain.js.map