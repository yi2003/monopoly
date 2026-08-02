// ============================================================
// dicePreview — Compute the tile each dice result (1-6) lands on,
// mirroring the server's authoritative movement logic.
// ============================================================

import type { GameState, Player, Tile } from '@monopoly/shared';
import {
  OUTER_RING_OFFSET,
  GROUND_INNER_RING_SIZE,
  GROUP_COLORS,
  calcPropertyRent, calcRailwayRent, calcUtilityRent,
  getEffectiveConfig, THEMES,
} from '@monopoly/shared';

export interface DicePreviewEntry {
  roll: number;          // dice result 1-6
  tileIndex: number;
  tileName: string;      // localized
  icon: string;
  action: string;        // localized short outcome
  accent: string;        // tile accent color
  passedGo: boolean;     // wraps past GO (collects salary)
}

// Position after `steps` on the player's current ring — same math as
// RuleEngine.processDiceResult (which uses shared advancePosition).
function targetPosition(player: Player, steps: number): number {
  if (player.innerCityRing > 0) {
    // Inner city: circular within the current 8-tile ring
    const ringOffset = GROUND_INNER_RING_SIZE + (player.innerCityRing - 1) * 8;
    const local = (player.position - ringOffset + steps) % 8;
    return ringOffset + (local < 0 ? local + 8 : local);
  }
  // Ground ring: wrap at ring size tiles
  const ringStart = player.groundRing === 'inner' ? 0 : OUTER_RING_OFFSET;
  const ringSize = GROUND_INNER_RING_SIZE;
  return ringStart + (((player.position - ringStart) + steps) % ringSize);
}

function passesGo(player: Player, steps: number): boolean {
  if (player.innerCityRing > 0) return false;
  const ringStart = player.groundRing === 'inner' ? 0 : OUTER_RING_OFFSET;
  const ringSize = GROUND_INNER_RING_SIZE;
  return (player.position - ringStart) + steps >= ringSize;
}

function tileName(tile: Tile, lang: 'zh' | 'en'): string {
  return lang === 'zh' ? tile.nameCN : tile.name;
}

export function computeDicePreview(
  player: Player,
  gameState: GameState,
  lang: 'zh' | 'en',
): DicePreviewEntry[] {
  const eff = getEffectiveConfig(gameState.config.theme, gameState.config.difficulty);
  const entries: DicePreviewEntry[] = [];

  for (let roll = 1; roll <= 6; roll++) {
    const tileIndex = targetPosition(player, roll);
    const tile = gameState.tiles[tileIndex];
    const pg = passesGo(player, roll);
    const entry: DicePreviewEntry = {
      roll,
      tileIndex,
      tileName: tileName(tile, lang),
      icon: '⬜',
      action: '',
      accent: '#9e9e9e',
      passedGo: pg,
    };
    describeTile(entry, tile, player, gameState, roll, eff, lang);
    entries.push(entry);
  }
  return entries;
}

function describeTile(
  e: DicePreviewEntry,
  tile: Tile,
  player: Player,
  gameState: GameState,
  roll: number,
  eff: ReturnType<typeof getEffectiveConfig>,
  lang: 'zh' | 'en',
): void {
  const owner = gameState.players.find(p => p.properties.includes(tile.index));
  const zh = lang === 'zh';

  switch (tile.type) {
    case 'property': {
      e.accent = GROUP_COLORS[tile.group];
      if (owner && owner.id !== player.id) {
        const rent = calcPropertyRent(tile.index, owner.houses[tile.index] || 0, owner, roll, eff.rentMultiplier);
        e.icon = '💸';
        e.action = zh ? `租金$${rent}→${owner.name}` : `Rent $${rent}→${owner.name}`;
      } else if (owner && owner.id === player.id) {
        e.icon = '🏠';
        e.action = zh ? '你的地产' : 'Yours';
      } else {
        e.icon = '💰';
        e.action = zh ? `购买$${tile.price}` : `Buy $${tile.price}`;
      }
      break;
    }
    case 'railway': {
      e.accent = GROUP_COLORS.railway;
      if (owner && owner.id !== player.id) {
        const count = owner.properties.filter(p => gameState.tiles[p]?.type === 'railway').length;
        const rent = Math.round(calcRailwayRent(owner, count, THEMES[gameState.config.theme]));
        e.icon = '🚂';
        e.action = zh ? `铁路费$${rent}` : `Rail $${rent}`;
      } else if (owner && owner.id === player.id) {
        e.icon = '🚂';
        e.action = zh ? '你的铁路' : 'Yours';
      } else {
        e.icon = '🚂';
        e.action = zh ? `购买$${tile.price}` : `Buy $${tile.price}`;
      }
      break;
    }
    case 'utility': {
      e.accent = GROUP_COLORS.utility;
      if (owner && owner.id !== player.id) {
        const count = owner.properties.filter(p => gameState.tiles[p]?.type === 'utility').length;
        const rent = calcUtilityRent(count, roll);
        e.icon = '🔌';
        e.action = zh ? `费$${rent}(骰${roll})` : `Fee $${rent}`;
      } else if (owner && owner.id === player.id) {
        e.icon = '🔌';
        e.action = zh ? '你的公共事业' : 'Yours';
      } else {
        e.icon = '🔌';
        e.action = zh ? `购买$${tile.price}` : `Buy $${tile.price}`;
      }
      break;
    }
    case 'tax': {
      e.icon = '🏦';
      e.accent = '#d32f2f';
      e.action = zh ? `缴税$${tile.amount}` : `Tax $${tile.amount}`;
      break;
    }
    case 'chance':
    case 'inner_chance': {
      e.icon = '🎴';
      e.accent = '#e91e63';
      e.action = zh ? '机会卡' : 'Chance';
      break;
    }
    case 'community_chest':
    case 'inner_community': {
      e.icon = '🎁';
      e.accent = '#2196f3';
      e.action = zh ? '公益金' : 'Chest';
      break;
    }
    case 'go': {
      e.icon = '🏁';
      e.accent = '#4caf50';
      e.action = zh ? `工资+$${eff.goSalary}` : `+$${eff.goSalary}`;
      break;
    }
    case 'jail': {
      e.icon = '🚔';
      e.accent = '#37474f';
      e.action = zh ? '探访监狱' : 'Jail';
      break;
    }
    case 'goto_jail': {
      e.icon = '⛓️';
      e.accent = '#212121';
      e.action = zh ? '进监狱！' : 'To Jail';
      break;
    }
    case 'stock_market': {
      e.icon = '📈';
      e.accent = '#00bcd4';
      e.action = zh ? '股市' : 'Stocks';
      break;
    }
    case 'wheel': {
      e.icon = '🎡';
      e.accent = '#ff9800';
      e.action = zh ? '大转盘' : 'Wheel';
      break;
    }
    case 'inner_gate': {
      e.icon = '🚪';
      e.accent = '#607d8b';
      e.action = zh ? '内城入口' : 'Gate';
      break;
    }
    case 'inner_square':
    case 'inner_cafe':
    case 'inner_fountain':
    case 'inner_shop':
    case 'inner_food':
    case 'inner_rest': {
      e.accent = '#8bc34a';
      if (tile.fee > 0) {
        e.icon = '🪙';
        e.action = zh ? `获得$${tile.fee}` : `+$${tile.fee}`;
      } else if (tile.fee < 0) {
        e.icon = '💸';
        e.action = zh ? `支付$${Math.abs(tile.fee)}` : `−$${Math.abs(tile.fee)}`;
      } else {
        e.icon = '🌿';
        e.action = zh ? '休息' : 'Rest';
      }
      break;
    }
  }
}
