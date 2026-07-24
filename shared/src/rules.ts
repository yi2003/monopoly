// ============================================================
// 家庭大富翁 — Pure Game Rule Functions
// ============================================================

import type { Player, PropertyTile, Tile, ColorGroup, Stock } from './types';
import { PROPERTIES, RAILWAYS, UTILITIES, STOCKS } from './constants';

// ---- Helper: find property definition by tile index ----

export function getPropertyDef(tileIndex: number) {
  return PROPERTIES.find(p => p.index === tileIndex);
}

export function getRailwayDef(tileIndex: number) {
  return RAILWAYS.find(r => r.index === tileIndex);
}

export function getUtilityDef(tileIndex: number) {
  return UTILITIES.find(u => u.index === tileIndex);
}

export function isPropertyTile(tile: Tile): tile is PropertyTile {
  return tile.type === 'property';
}

// ---- Color Group Checks ----

export function getGroupTiles(group: ColorGroup): number[] {
  return PROPERTIES.filter(p => p.group === group).map(p => p.index);
}

export function ownsFullGroup(player: Player, group: ColorGroup): boolean {
  const groupTiles = getGroupTiles(group);
  return groupTiles.every(t => player.properties.includes(t));
}

export function getOwnedGroups(player: Player): ColorGroup[] {
  const groups = new Set(PROPERTIES.filter(p => player.properties.includes(p.index)).map(p => p.group));
  return Array.from(groups).filter(g => ownsFullGroup(player, g));
}

// ---- Rent Calculation ----

export function calcPropertyRent(
  tileIndex: number,
  houses: number,
  owner: Player,
  diceSum: number,
  rentMultiplier: number,
): number {
  const prop = getPropertyDef(tileIndex);
  if (!prop) return 0;

  let rent: number;

  if (houses > 0) {
    rent = prop.rent[Math.min(houses, 5)];
  } else {
    // No houses: base rent, doubled if owner has full color group
    rent = prop.rent[0];
    if (ownsFullGroup(owner, prop.group)) {
      rent *= 2;
    }
  }

  return Math.round(rent * rentMultiplier);
}

export function calcRailwayRent(
  owner: Player,
  railwayCount: number,
  theme: { railwayComboBonus: boolean },
): number {
  const baseTable = [25, 50, 100, 200];
  const idx = Math.min(railwayCount - 1, 3);
  let rent = baseTable[Math.max(0, idx)];

  // Shanghai bonus: ≥2 railways ×1.5
  if (theme.railwayComboBonus && railwayCount >= 2) {
    rent = Math.round(rent * 1.5);
  }

  return rent;
}

export function calcUtilityRent(utilityCount: number, diceValue: number): number {
  if (utilityCount === 1) return diceValue * 8;
  if (utilityCount >= 2) return diceValue * 20;
  return 0;
}

// ---- Build Validation ----

export function canBuildHouse(player: Player, tileIndex: number): boolean {
  const prop = getPropertyDef(tileIndex);
  if (!prop) return false;
  if (!ownsFullGroup(player, prop.group)) return false;

  const currentHouses = player.houses[tileIndex] || 0;
  if (currentHouses >= 5) return false; // max 5 (hotel)

  // Even building rule: no property in group can have more than 1 house difference
  const groupTiles = getGroupTiles(prop.group);
  for (const t of groupTiles) {
    if (t === tileIndex) continue;
    const otherHouses = player.houses[t] || 0;
    if (currentHouses + 1 - otherHouses > 1) return false;
  }

  // Check cash
  if (player.cash < prop.houseCost) return false;

  return true;
}

export function canSellHouse(player: Player, tileIndex: number): boolean {
  const prop = getPropertyDef(tileIndex);
  if (!prop) return false;

  const currentHouses = player.houses[tileIndex] || 0;
  if (currentHouses <= 0) return false;

  // Even selling: sell from highest first, can't create >1 gap
  const groupTiles = getGroupTiles(prop.group);
  for (const t of groupTiles) {
    if (t === tileIndex) continue;
    const otherHouses = player.houses[t] || 0;
    if (otherHouses > currentHouses) return false; // must sell from highest
    if (currentHouses - 1 - otherHouses < -1) return false;
  }

  return true;
}

export function getSellHouseValue(tileIndex: number): number {
  const prop = getPropertyDef(tileIndex);
  if (!prop) return 0;
  return Math.floor(prop.houseCost / 2);
}

// ---- Mortgage ----

export function canMortgage(player: Player, tileIndex: number): boolean {
  const prop = getPropertyDef(tileIndex);
  if (!prop) {
    // Check railway/utility
    const rail = getRailwayDef(tileIndex);
    if (rail) return (player.houses[tileIndex] || 0) === 0;
    const util = getUtilityDef(tileIndex);
    if (util) return true;
    return false;
  }
  // Can't mortgage if any house in the group
  const groupTiles = getGroupTiles(prop.group);
  for (const t of groupTiles) {
    if ((player.houses[t] || 0) > 0) return false;
  }
  return true;
}

export function getMortgageValue(tileIndex: number): number {
  const prop = getPropertyDef(tileIndex);
  if (prop) return prop.mortgageValue;
  const rail = getRailwayDef(tileIndex);
  if (rail) return rail.mortgageValue;
  const util = getUtilityDef(tileIndex);
  if (util) return util.mortgageValue;
  return 0;
}

export function getUnmortgageCost(tileIndex: number): number {
  const mv = getMortgageValue(tileIndex);
  return Math.round(mv * 1.1); // 10% interest
}

// ---- Net Worth ----

export function calcNetWorth(player: Player, stockPrices: Map<string, number>): number {
  let worth = player.cash;

  // Property original prices
  for (const idx of player.properties) {
    const prop = getPropertyDef(idx);
    if (prop) {
      worth += prop.price;
    } else {
      const rail = getRailwayDef(idx);
      if (rail) worth += rail.price;
      const util = getUtilityDef(idx);
      if (util) worth += util.price;
    }
  }

  // Houses at half price
  for (const [idx, count] of Object.entries(player.houses)) {
    const houseCost = getPropertyDef(Number(idx))?.houseCost || 0;
    worth += Math.floor(houseCost * count / 2);
  }

  // Stock market value
  for (const holding of player.stocks) {
    const price = stockPrices.get(holding.symbol) || holding.avgCost;
    worth += price * holding.shares;
  }

  return worth;
}

// ---- Bankruptcy ----

export function getTotalDebt(player: Player): number {
  // If player has negative cash, that's their debt
  return Math.max(0, -player.cash);
}

export function canRaiseFunds(player: Player): boolean {
  // Check if player can sell houses to raise cash
  for (const [idx, count] of Object.entries(player.houses)) {
    if (count > 0) return true;
  }
  // Check if player has properties to mortgage
  for (const idx of player.properties) {
    if (canMortgage(player, idx)) return true;
  }
  // Check if player has stocks to sell
  if (player.stocks.length > 0) return true;
  return false;
}

// ---- Movement ----

export function advancePosition(
  currentPos: number,
  steps: number,
  innerCityRing: number,
  innerCitySector: number,
): { position: number; passedGo: boolean; ring: number; sector: number } {
  let passedGo = false;

  if (innerCityRing === 0) {
    // On ground ring
    let newPos = currentPos + steps;
    if (newPos >= 48) {
      passedGo = true;
      newPos = newPos % 48;
    }
    return { position: newPos, passedGo, ring: 0, sector: 0 };
  } else {
    // In inner city: circular within ring
    const ringOffset = 48 + (innerCityRing - 1) * 8;
    const localPos = currentPos - ringOffset;
    let newLocalPos = localPos + steps;
    if (newLocalPos >= 8) {
      newLocalPos = newLocalPos % 8;
    }
    return {
      position: ringOffset + newLocalPos,
      passedGo: false,
      ring: innerCityRing,
      sector: innerCitySector,
    };
  }
}

// ---- Move player to a specific tile index (for card effects) ----

export function moveToTile(
  targetIndex: number,
  currentPos: number,
): { position: number; passedGo: boolean } {
  let passedGo = false;
  if (targetIndex < currentPos) {
    passedGo = true;
  }
  return { position: targetIndex, passedGo };
}

// ---- Find nearest tile of type ----

export function findNearestTile(
  currentPos: number,
  tileType: 'railway' | 'utility',
): number {
  const candidates = tileType === 'railway'
    ? RAILWAYS.map(r => r.index)
    : UTILITIES.map(u => u.index);

  // Find next one clockwise
  const sorted = candidates.sort((a, b) => a - b);
  for (const idx of sorted) {
    if (idx > currentPos) return idx;
  }
  return sorted[0]; // wrap around
}

// ---- Stock Cost Basis (weighted average) ----

export function calcNewAvgCost(
  existingShares: number,
  existingAvgCost: number,
  buyShares: number,
  buyPrice: number,
): number {
  const totalCost = existingShares * existingAvgCost + buyShares * buyPrice;
  const totalShares = existingShares + buyShares;
  return totalCost / totalShares;
}

export function calcStockTradeFee(amount: number): number {
  const fee = Math.round(amount * 0.03);
  return Math.max(5, fee);
}

// ---- Dice ----

export interface DiceResult {
  die1: number;
  die2: number;
  total: number;
  isDoubles: boolean;
}

export function rollDice(): DiceResult {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return {
    die1,
    die2,
    total: die1 + die2,
    isDoubles: die1 === die2,
  };
}

// ---- Weather probabilities ----

export function rollWeather(): string {
  const r = Math.random();
  if (r < 0.55) return 'clear';
  if (r < 0.72) return 'rain';
  if (r < 0.85) return 'snow';
  if (r < 0.95) return 'fog';
  return 'storm';
}

// ---- Initialize stocks ----

export function initStocks(): Stock[] {
  return STOCKS.map(s => ({
    symbol: s.symbol,
    name: s.name,
    nameCN: s.nameCN,
    sector: s.sector,
    initialPrice: s.initialPrice,
    price: s.initialPrice,
    priceHistory: Array(20).fill(s.initialPrice),
    drift: s.initialPrice,
    volatility: s.volatility,
  }));
}
