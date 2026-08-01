// ============================================================
// RuleEngine — Server-side validation of all player actions
// ============================================================

import type { GameState, Player, PropertyTile, RailwayTile, UtilityTile, GameEvent } from '@monopoly/shared';
import {
  getPropertyDef, getRailwayDef, getUtilityDef,
  calcPropertyRent, calcRailwayRent, calcUtilityRent,
  canBuildHouse, canSellHouse, getSellHouseValue,
  canMortgage, getMortgageValue, getUnmortgageCost,
  ownsFullGroup,
  playerHasHeldCardKind,
  CORNER_GO, CORNER_JAIL, CORNER_GOTO_JAIL,
  JAIL_FINE, MAX_JAIL_TURNS,
  advancePosition,
} from '@monopoly/shared';
import { getEffectiveConfig, THEMES } from '@monopoly/shared';

export class RuleEngine {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  get currentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  get effConfig() {
    return getEffectiveConfig(this.state.config.theme, this.state.config.difficulty);
  }

  // ---- Dice & Movement ----

  validateRollDice(): string | null {
    if (this.state.phase !== 'rolling') return '现在不能掷骰子';
    if (this.state.diceRolled) return '已经掷过骰子了';
    if (this.currentPlayer.isBot) return null; // bots always allowed
    return null;
  }

  processDiceResult(dice: { die1: number; die2: number; total: number; isDoubles: boolean }): {
    passedGo: boolean;
    newPosition: number;
    extraRoll: boolean;
  } {
    const player = this.currentPlayer;
    let passedGo = false;
    const extraRoll = dice.isDoubles;

    // If in jail, doubles can escape — must pay or use card
    if (player.status === 'jailed') {
      player.jailTurns++;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        player.cash -= JAIL_FINE;
        player.jailTurns = 0;
        player.status = 'active';
      }
      return { passedGo: false, newPosition: player.position, extraRoll: false };
    }

    // Advance on the current ring (ground rings wrap at 48, inner-city rings
    // wrap circularly at 8 tiles per ring).
    const steps = dice.total;
    const moved = advancePosition(
      player.position, steps,
      player.innerCityRing, player.innerCitySector, player.groundRing,
    );
    if (moved.passedGo) {
      passedGo = true;
      player.cash += this.effConfig.goSalary;
    }
    if (moved.ring !== 0) {
      player.innerCityRing = moved.ring;
      player.innerCitySector = moved.sector;
    }

    return { passedGo, newPosition: moved.position, extraRoll };
  }

  // ---- Landing on tile ----

  processLanding(position: number, extraRentMultiplier = 1, ignoreGod = false): {
    phase: 'buying' | 'stock' | 'wheel' | 'debt' | 'rentChoice' | 'god' | 'awaitEnd';
    rentAmount: number;
    rentTarget: string | null;
    cardType: 'chance' | 'community_chest' | null;
    gameEvent?: GameEvent;
    holdPrompt?: { kind: 'rentFree' | 'doubleRent'; actorId: string };
    godPickup?: import('@monopoly/shared').GodEntity;
  } {
    const tile = this.state.tiles[position];
    const player = this.currentPlayer;
    let rentAmount = 0;
    let rentTarget: string | null = null;
    let cardType: 'chance' | 'community_chest' | null = null;

    // A god spirit occupies this tile — landing on it attaches it (replaces the tile's normal effect).
    // `ignoreGod` lets GameManager re-run normal landing when the player already has a god.
    const god = this.state.gods.find(g => g.tileIndex === position);
    if (god && !ignoreGod) {
      return { phase: 'god', rentAmount: 0, rentTarget: null, cardType: null, godPickup: god };
    }

    switch (tile.type) {
      case 'property': {
        const owner = this.findOwner(position);
        if (owner && owner.id !== player.id) {
          rentAmount = calcPropertyRent(
            position, owner.houses[position] || 0, owner,
            0, this.effConfig.rentMultiplier,
          );
          rentTarget = owner.id;
          // 财神附身 → 免付租金(覆盖双倍租金卡,不进 rentChoice)
          if (player.god?.kind === 'wealth') {
            this.addLog(`${player.name} 受财神庇佑，免付 ${owner.name} 的租金`, 'info', `${player.name} exempt from rent (Wealth God)`);
            return { phase: 'awaitEnd', rentAmount: 0, rentTarget: owner.id, cardType: null };
          }
          // Defer the transfer if the payer holds a rent-free card or the owner a
          // double-rent card — the decision happens in the rentChoice phase.
          const payerHasFree = playerHasHeldCardKind(player, this.state.cards, 'rentFree');
          const ownerHasDouble = playerHasHeldCardKind(owner, this.state.cards, 'doubleRent');
          if (rentAmount > 0 && (payerHasFree || ownerHasDouble)) {
            const kind = ownerHasDouble ? 'doubleRent' : 'rentFree';
            return {
              phase: 'rentChoice', rentAmount, rentTarget: owner.id, cardType: null,
              holdPrompt: { kind, actorId: kind === 'doubleRent' ? owner.id : player.id },
            };
          }
          player.cash -= rentAmount;
          owner.cash += rentAmount;
          this.addLog(`💸 ${player.name} → ${owner.name} 租金 $${rentAmount}`, 'rent', `💸 ${player.name} → ${owner.name} rent $${rentAmount}`);
          return {
            phase: 'awaitEnd', rentAmount, rentTarget, cardType: null,
            gameEvent: { kind: 'rent', playerId: player.id, targetId: owner.id, amount: rentAmount, tileIndex: position, tileName: tile.name, tileNameCN: tile.nameCN },
          };
        } else if (!owner) {
          if (player.cash >= (tile as PropertyTile).price) {
            return { phase: 'buying', rentAmount: 0, rentTarget: null, cardType: null };
          }
        }
        break;
      }

      case 'railway': {
        const owner = this.findOwner(position);
        if (owner && owner.id !== player.id) {
          const railwayCount = owner.properties.filter(p => getRailwayDef(p) !== undefined).length;
          const theme = THEMES[this.state.config.theme];
          rentAmount = Math.round(calcRailwayRent(owner, railwayCount, theme) * extraRentMultiplier);
          rentTarget = owner.id;
          if (player.god?.kind === 'wealth') {
            this.addLog(`${player.name} 受财神庇佑，免付 ${owner.name} 的过路费`, 'info', `${player.name} exempt from fee (Wealth God)`);
            return { phase: 'awaitEnd', rentAmount: 0, rentTarget: owner.id, cardType: null };
          }
          const payerHasFreeR = playerHasHeldCardKind(player, this.state.cards, 'rentFree');
          const ownerHasDoubleR = playerHasHeldCardKind(owner, this.state.cards, 'doubleRent');
          if (rentAmount > 0 && (payerHasFreeR || ownerHasDoubleR)) {
            const kind = ownerHasDoubleR ? 'doubleRent' : 'rentFree';
            return {
              phase: 'rentChoice', rentAmount, rentTarget: owner.id, cardType: null,
              holdPrompt: { kind, actorId: kind === 'doubleRent' ? owner.id : player.id },
            };
          }
          player.cash -= rentAmount;
          owner.cash += rentAmount;
          this.addLog(`🚂 ${player.name} → ${owner.name} 铁路费 $${rentAmount}（${railwayCount}条铁路）`, 'rent', `🚂 ${player.name} → ${owner.name} railway fee $${rentAmount} (${railwayCount} railways)`);
          return {
            phase: 'awaitEnd', rentAmount, rentTarget, cardType: null,
            gameEvent: { kind: 'rent', playerId: player.id, targetId: owner.id, amount: rentAmount, tileIndex: position, tileName: tile.name, tileNameCN: tile.nameCN },
          };
        } else if (!owner && player.cash >= (tile as RailwayTile).price) {
          return { phase: 'buying', rentAmount: 0, rentTarget: null, cardType: null };
        }
        break;
      }

      case 'utility': {
        const owner = this.findOwner(position);
        if (owner && owner.id !== player.id) {
          const utilityCount = owner.properties.filter(p => getUtilityDef(p) !== undefined).length;
          const diceSum = this.state.dice?.total || 0;
          rentAmount = Math.round(calcUtilityRent(utilityCount, diceSum) * extraRentMultiplier);
          rentTarget = owner.id;
          if (player.god?.kind === 'wealth') {
            this.addLog(`${player.name} 受财神庇佑，免付 ${owner.name} 的公用事业费`, 'info', `${player.name} exempt from fee (Wealth God)`);
            return { phase: 'awaitEnd', rentAmount: 0, rentTarget: owner.id, cardType: null };
          }
          const payerHasFreeU = playerHasHeldCardKind(player, this.state.cards, 'rentFree');
          const ownerHasDoubleU = playerHasHeldCardKind(owner, this.state.cards, 'doubleRent');
          if (rentAmount > 0 && (payerHasFreeU || ownerHasDoubleU)) {
            const kind = ownerHasDoubleU ? 'doubleRent' : 'rentFree';
            return {
              phase: 'rentChoice', rentAmount, rentTarget: owner.id, cardType: null,
              holdPrompt: { kind, actorId: kind === 'doubleRent' ? owner.id : player.id },
            };
          }
          player.cash -= rentAmount;
          owner.cash += rentAmount;
          this.addLog(`🔌 ${player.name} → ${owner.name} 公共事业费 $${rentAmount}（骰子${diceSum}×${utilityCount}处）`, 'rent', `🔌 ${player.name} → ${owner.name} utility fee $${rentAmount} (dice ${diceSum}×${utilityCount})`);
          return {
            phase: 'awaitEnd', rentAmount, rentTarget, cardType: null,
            gameEvent: { kind: 'rent', playerId: player.id, targetId: owner.id, amount: rentAmount, tileIndex: position, tileName: tile.name, tileNameCN: tile.nameCN },
          };
        } else if (!owner && player.cash >= (tile as UtilityTile).price) {
          return { phase: 'buying', rentAmount: 0, rentTarget: null, cardType: null };
        }
        break;
      }

      case 'tax': {
        const taxAmount = Math.round(tile.amount * this.effConfig.taxMultiplier);
        player.cash -= taxAmount;
        this.addLog(`🏛️ ${player.name} → 银行 缴纳税费 $${taxAmount}`, 'info', `🏛️ ${player.name} → Bank tax $${taxAmount}`);
        return {
          phase: 'awaitEnd', rentAmount: taxAmount, rentTarget: null, cardType: null,
          gameEvent: { kind: 'tax', playerId: player.id, amount: taxAmount, isLuxury: tile.isLuxury },
        };
      }

      case 'chance': {
        cardType = 'chance';
        break;
      }

      case 'community_chest': {
        cardType = 'community_chest';
        break;
      }

      case 'stock_market': {
        return { phase: 'stock', rentAmount: 0, rentTarget: null, cardType: null };
      }

      case 'wheel': {
        return { phase: 'wheel', rentAmount: 0, rentTarget: null, cardType: null };
      }

      case 'goto_jail': {
        player.position = CORNER_JAIL;
        player.jailTurns = 1;
        player.status = 'jailed';
        this.addLog(`${player.name} 被送进监狱！`, 'jail', `${player.name} sent to jail!`);
        return {
          phase: 'awaitEnd', rentAmount: 0, rentTarget: null, cardType: null,
          gameEvent: { kind: 'jail_in', playerId: player.id, reason: 'goto_jail' },
        };
      }

      // Inner city tiles
      case 'inner_gate': {
        // Pay entry fee to enter inner city — handled by enterInnerCity action
        break;
      }
      case 'inner_square':
      case 'inner_cafe':
      case 'inner_fountain':
      case 'inner_shop':
      case 'inner_food': {
        player.cash += tile.fee;
        if (tile.fee > 0) {
          const verb = tile.fee > 0 ? '获得' : '支付给银行';
          const verbEN = tile.fee > 0 ? 'earns' : 'pays bank';
          this.addLog(`${player.name} 在${tile.nameCN} ${verb} $${Math.abs(tile.fee)}`, 'info', `${player.name} ${verbEN} $${Math.abs(tile.fee)} at ${tile.name}`);
        }
        break;
      }
      case 'inner_chance': {
        cardType = 'chance';
        break;
      }
      case 'inner_community': {
        cardType = 'community_chest';
        break;
      }
    }

    // Check if player can't pay
    if (player.cash < 0) {
      return { phase: 'debt', rentAmount, rentTarget, cardType: null };
    }

    return { phase: 'awaitEnd', rentAmount, rentTarget, cardType };
  }

  // ---- Property Purchase ----

  validateBuyProperty(): string | null {
    if (this.state.phase !== 'buying') return '现在不能购买地产';
    const tile = this.state.tiles[this.currentPlayer.position];
    if (tile.type !== 'property' && tile.type !== 'railway' && tile.type !== 'utility') {
      return '当前位置不是地产';
    }
    if (this.currentPlayer.cash < (tile as PropertyTile).price) {
      return '现金不足';
    }
    return null;
  }

  executeBuyProperty(): void {
    const player = this.currentPlayer;
    const tile = this.state.tiles[player.position];
    const prop = getPropertyDef(player.position) || getRailwayDef(player.position) || getUtilityDef(player.position);
    if (!prop) return;

    player.cash -= prop.price;
    player.properties.push(player.position);
    this.addLog(`${player.name} 购买了 ${tile.nameCN} ($${prop.price})`, 'buy', `${player.name} bought ${tile.name} ($${prop.price})`);
  }

  // ---- Building ----

  validateBuildHouse(tileIndex: number): string | null {
    if (this.state.phase !== 'rolling' && this.state.phase !== 'awaitEnd') return '现在不能建房';
    if (!this.currentPlayer.properties.includes(tileIndex)) return '你不拥有该地产';
    if (!canBuildHouse(this.currentPlayer, tileIndex)) return '不满足建房条件';
    return null;
  }

  executeBuildHouse(tileIndex: number): void {
    const player = this.currentPlayer;
    const prop = getPropertyDef(tileIndex)!;
    player.houses[tileIndex] = (player.houses[tileIndex] || 0) + 1;
    player.cash -= prop.houseCost;
    const count = player.houses[tileIndex];
    this.addLog(`${player.name} 在 ${prop.nameCN} 建造了${count === 5 ? '酒店' : `第${count}栋房屋`} ($${prop.houseCost})`, 'buy', `${player.name} built ${count === 5 ? 'a hotel' : `${count} house(s)`} on ${prop.nameEN} ($${prop.houseCost})`);
  }

  validateSellHouse(tileIndex: number): string | null {
    if (this.state.phase !== 'rolling' && this.state.phase !== 'awaitEnd' && this.state.phase !== 'debt') {
      return '现在不能卖房';
    }
    if (!this.currentPlayer.properties.includes(tileIndex)) return '你不拥有该地产';
    if (!canSellHouse(this.currentPlayer, tileIndex)) return '不满足卖房条件';
    return null;
  }

  executeSellHouse(tileIndex: number): void {
    const player = this.currentPlayer;
    const value = getSellHouseValue(tileIndex);
    player.houses[tileIndex] = (player.houses[tileIndex] || 0) - 1;
    if (player.houses[tileIndex] <= 0) delete player.houses[tileIndex];
    player.cash += value;
    this.addLog(`${player.name} 出售了房屋，获得 $${value}`, 'sell', `${player.name} sold house(s) for $${value}`);
  }

  // ---- Bankruptcy ----

  declareBankruptcy(): { creditor: Player | null } {
    const player = this.currentPlayer;
    const creditor = this.findCreditor();
    player.status = 'bankrupt';

    if (creditor) {
      // Transfer assets to creditor
      creditor.properties.push(...player.properties);
      creditor.cash += Math.max(0, player.cash);
      for (const [idx, count] of Object.entries(player.houses)) {
        creditor.houses[Number(idx)] = (creditor.houses[Number(idx)] || 0) + count;
      }
      for (const stock of player.stocks) {
        const existing = creditor.stocks.find(s => s.symbol === stock.symbol);
        if (existing) {
          const totalCost = existing.shares * existing.avgCost + stock.shares * stock.avgCost;
          const totalShares = existing.shares + stock.shares;
          existing.avgCost = totalCost / totalShares;
          existing.shares = totalShares;
        } else {
          creditor.stocks.push({ ...stock });
        }
      }
      player.properties = [];
      player.houses = {};
      player.stocks = [];
      player.heldCards = [];
      player.god = null;
      player.cash = 0;
      this.addLog(`💀 ${player.name} 破产！全部资产 → ${creditor.name}`, 'bankrupt', `💀 ${player.name} bankrupt! Assets → ${creditor.name}`);
    } else {
      // Release properties back to market
      player.properties = [];
      player.houses = {};
      player.stocks = [];
      player.heldCards = [];
      player.god = null;
      player.cash = 0;
      this.addLog(`💀 ${player.name} 破产！资产回归银行`, 'bankrupt', `💀 ${player.name} bankrupt! Assets returned to bank`);
    }

    return { creditor };
  }

  // ---- Helpers ----

  findOwner(tileIndex: number): Player | undefined {
    return this.state.players.find(p => p.properties.includes(tileIndex));
  }

  findCreditor(): Player | null {
    // Find the player who is owed the most rent
    // Simplified: find the last player who collected rent from this player
    return this.state.players.find(p => p.id !== this.currentPlayer.id && p.status === 'active') || null;
  }

  checkWinner(): Player | null {
    const activePlayers = this.state.players.filter(p => p.status === 'active' && !p.isSpectator);
    if (activePlayers.length <= 1) {
      return activePlayers[0] || null;
    }
    // If no active players remain, find the last one standing (or richest bankrupt)
    if (activePlayers.length === 0) {
      const nonSpectators = this.state.players.filter(p => !p.isSpectator);
      if (nonSpectators.length === 0) return null;
      // Return player with highest net worth among non-spectators
      const stockPrices = new Map(this.state.stocks.map(s => [s.symbol, s.price]));
      let best = nonSpectators[0];
      let bestNw = -Infinity;
      for (const p of nonSpectators) {
        const nw = this.calcNetWorth(p, stockPrices);
        if (nw > bestNw) { best = p; bestNw = nw; }
      }
      return best;
    }
    // Check turn limit
    if (this.effConfig.turnLimit > 0 && this.state.round >= this.effConfig.turnLimit) {
      // Highest net worth wins
      const stockPrices = new Map(this.state.stocks.map(s => [s.symbol, s.price]));
      let best = activePlayers[0];
      let bestNw = 0;
      for (const p of activePlayers) {
        const nw = this.calcNetWorth(p, stockPrices);
        if (nw > bestNw) { best = p; bestNw = nw; }
      }
      return best;
    }
    return null;
  }

  private calcNetWorth(player: Player, stockPrices: Map<string, number>): number {
    let worth = player.cash;
    for (const idx of player.properties) {
      const prop = getPropertyDef(idx);
      if (prop) worth += prop.price;
      else {
        const rail = getRailwayDef(idx);
        if (rail) worth += rail.price;
        const util = getUtilityDef(idx);
        if (util) worth += util.price;
      }
    }
    for (const [idx, count] of Object.entries(player.houses)) {
      const houseCost = getPropertyDef(Number(idx))?.houseCost || 0;
      worth += Math.floor(houseCost * count / 2);
    }
    for (const h of player.stocks) {
      const price = stockPrices.get(h.symbol) || h.avgCost;
      worth += price * h.shares;
    }
    return worth;
  }

  private addLog(message: string, type: 'info' | 'rent' | 'card' | 'buy' | 'sell' | 'dividend' | 'bankrupt' | 'victory' | 'jail', messageEN?: string): void {
    this.state.logs.push({
      id: this.state.logs.length,
      round: this.state.round,
      timestamp: Date.now(),
      message,
      messageEN: messageEN || message,
      type,
    });
    // Keep last 50 logs
    if (this.state.logs.length > 50) {
      this.state.logs.shift();
    }
  }
}
