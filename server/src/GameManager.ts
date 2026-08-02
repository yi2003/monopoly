// ============================================================
// GameManager — Authoritative game state & turn machine
// ============================================================

import type { GameState, GameConfig, Player, ThemeId, DifficultyId, GameEvent, AvatarId, GodKind } from '@monopoly/shared';
import {
  createTiles, CHANCE_CARDS, COMMUNITY_CHEST_CARDS,
  SHANGHAI_EXTRA_CHANCE_CARDS, SHANGHAI_EXTRA_COMMUNITY_CHEST_CARDS,
  TOKYO_EXTRA_CHANCE_CARDS, TOKYO_EXTRA_COMMUNITY_CHEST_CARDS,
  GO_SALARY,
  JAIL_FINE, CORNER_GO, CORNER_JAIL, CORNER_GOTO_JAIL,
  OUTER_RING_OFFSET, GROUND_INNER_RING_SIZE, RAILWAYS,
  PLAYER_COLORS, DEFAULT_AVATAR,
} from '@monopoly/shared';
import { getEffectiveConfig, THEMES } from '@monopoly/shared';
import {
  rollDice, findNearestTile, moveToTile, findCardById, playerHasHeldCardKind,
  nearestGodWithin, isGroundTile, getPropertyDef,
} from '@monopoly/shared';
import {
  GOD_DURATION_TURNS, GOD_WEALTH_AMOUNT, GOD_START_COUNT, GOD_RESPAWN_ROUNDS, GOD_MAX_ON_BOARD,
} from '@monopoly/shared';
import { shuffle } from './utils/shuffle';
import { generatePlayerId } from './utils/random';
import { RuleEngine } from './RuleEngine';
import { updateStockPrices, processDividends, executeBuyStock, executeSellStock } from './StockMarket';
import { initStocks } from '@monopoly/shared';
import { decideBotAction } from './BotBrain';

// How many face-down cards are offered for a chance/community-chest pick
const CARD_CHOICE_COUNT = 4;
// Max held action cards a player can carry (beyond this, drawn ones are discarded)
const MAX_HELD_CARDS = 6;

export class GameManager {
  state: GameState;
  private botTimers: Map<string, NodeJS.Timeout> = new Map();
  private onStateChange: (roomCode: string, state: GameState) => void;
  private logIdCounter = 0;
  private godIdCounter = 0;

  constructor(config: GameConfig, onStateChange: (roomCode: string, state: GameState) => void) {
    this.onStateChange = onStateChange;
    // Append theme-specific extra cards
    const extraChance = config.theme === 'shanghai' ? SHANGHAI_EXTRA_CHANCE_CARDS
      : config.theme === 'tokyo' ? TOKYO_EXTRA_CHANCE_CARDS : [];
    const extraCommunity = config.theme === 'shanghai' ? SHANGHAI_EXTRA_COMMUNITY_CHEST_CARDS
      : config.theme === 'tokyo' ? TOKYO_EXTRA_COMMUNITY_CHEST_CARDS : [];

    this.state = {
      config,
      phase: 'lobby',
      round: 0,
      currentPlayerIndex: 0,
      players: [],
      tiles: createTiles(),
      cards: {
        chance: [...CHANCE_CARDS, ...extraChance],
        community_chest: [...COMMUNITY_CHEST_CARDS, ...extraCommunity],
      },
      chanceDeck: shuffle([...CHANCE_CARDS, ...extraChance].map((_, i) => i)),
      communityDeck: shuffle([...COMMUNITY_CHEST_CARDS, ...extraCommunity].map((_, i) => i)),
      stocks: initStocks(),
      trades: [],
      logs: [],
      dice: null,
      diceRolled: false,
      winner: null,
      weather: 'clear',
      weatherTimer: 30,
      dayTime: 0.3, // start at daytime
      wheelResult: null,
      cardChoice: null,
      actionCardPrompt: null,
      gods: [],
      lastCardDrawn: null,
      gameEvent: null,
      ringTransferred: false,
      createdAt: Date.now(),
    };
  }

  get engine(): RuleEngine {
    return new RuleEngine(this.state);
  }

  // ---- Player Management ----

  addPlayer(name: string, color?: string, isBot = false, avatar?: AvatarId): Player {
    const player: Player = {
      id: isBot ? `bot_${generatePlayerId()}` : generatePlayerId(),
      name,
      color: color || PLAYER_COLORS[this.state.players.length % PLAYER_COLORS.length],
      avatar: avatar || DEFAULT_AVATAR,
      isBot,
      isSpectator: false,
      autoPilot: false,
      cash: 0,
      position: 0,
      innerCityRing: 0,
      innerCitySector: 0,
      groundRing: 'inner',
      properties: [],
      houses: {},
      stocks: [],
      jailTurns: 0,
      getOutOfJailCards: 0,
      heldCards: [],
      god: null,
      consecutiveDoubles: 0,
      skipNextTurn: false,
      freeBuildPending: false,
      status: 'active',
      totalRentCollected: 0,
      totalRentPaid: 0,
      totalStockProfit: 0,
      totalDividends: 0,
      netWorthHistory: [],
    };
    this.state.players.push(player);
    return player;
  }

  removePlayer(playerId: string): void {
    this.state.players = this.state.players.filter(p => p.id !== playerId);
    // Adjust currentPlayerIndex if needed
    if (this.state.currentPlayerIndex >= this.state.players.length) {
      this.state.currentPlayerIndex = 0;
    }
  }

  // ---- Game Start ----

  startGame(): void {
    const eff = getEffectiveConfig(this.state.config.theme, this.state.config.difficulty);
    this.state.config.turnLimit = eff.turnLimit;

    // Initialize players
    const activePlayers = this.state.players.filter(p => !p.isSpectator);
    for (const player of activePlayers) {
      player.cash = eff.startingCash;
      player.position = 0;
      player.groundRing = 'inner';
      player.innerCityRing = 0;
      player.innerCitySector = 0;
      player.properties = [];
      player.houses = {};
      player.stocks = [];
      player.god = null;
      player.skipNextTurn = false;
      player.freeBuildPending = false;
      player.status = 'active';
    }

    // Shuffle turn order
    this.state.players = shuffle(this.state.players);

    // Spawn the initial god spirits on the board
    this.state.gods = [];
    this.godIdCounter = 0;
    for (let i = 0; i < GOD_START_COUNT; i++) {
      this.spawnGod();
    }

    this.state.phase = 'rolling';
    this.state.round = 1;
    this.state.currentPlayerIndex = 0;
    this.state.logs = [];
    this.state.dice = null;
    this.state.diceRolled = false;

    this.addLog('游戏开始！', 'info', 'Game started!');
    this.addLog(`主题: ${THEMES[this.state.config.theme].nameCN} | 难度: ${eff.drainPct > 0 ? `${Math.round(eff.drainPct * 100)}%维护费` : '无维护费'}`, 'info', `Theme: ${THEMES[this.state.config.theme].name} | Difficulty: ${eff.drainPct > 0 ? `${Math.round(eff.drainPct * 100)}% maint` : 'no maint'}`);
    this.addLog(`轮到 ${this.currentPlayer.name}`, 'info', `${this.currentPlayer.name}'s turn`);
    this.emitChange();

    // Kick off bot/autoPilot if first player is AI
    if (this.currentPlayer.isBot || this.currentPlayer.autoPilot) {
      this.scheduleBotTurn();
    }
  }

  // ---- Turn Machine ----

  get currentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  rollDice(die1?: number, die2?: number): { dice: { die1: number; die2: number; total: number; isDoubles: boolean }; result: any } {
    if (this.state.phase !== 'rolling') {
      return { dice: { die1: 0, die2: 0, total: 0, isDoubles: false }, result: { error: '现在不能掷骰子' } };
    }

    // Single-die game: only die1 counts. Ignore any client-supplied die2 so the
    // log total always equals the visible die (1-6) and matches bot rolls.
    const dice = (die1 !== undefined)
      ? { die1, die2: 0, total: die1, isDoubles: false }
      : rollDice();
    this.state.dice = dice;
    this.state.diceRolled = true;

    const result = this.engine.processDiceResult(dice);
    this.addLog(`${this.currentPlayer.name} 掷出 ${dice.total} 点`, 'info', `${this.currentPlayer.name} rolled ${dice.total}`);

    if (result.passedGo) {
      const eff = getEffectiveConfig(this.state.config.theme, this.state.config.difficulty);
      this.addLog(`💰 ${this.currentPlayer.name} 经过起点，银行发放工资 $${eff.goSalary}`, 'info', `💰 ${this.currentPlayer.name} passed GO, collect $${eff.goSalary}`);
      this.emitEvent({ kind: 'go_salary', playerId: this.currentPlayer.id, amount: eff.goSalary });
    }

    // Track consecutive doubles
    if (dice.isDoubles) {
      this.currentPlayer.consecutiveDoubles++;
    } else {
      this.currentPlayer.consecutiveDoubles = 0;
    }

    // Move player
    this.currentPlayer.position = result.newPosition;

    if (result.extraRoll) {
      if (this.currentPlayer.consecutiveDoubles >= 3) {
        // Three doubles in a row → jail!
        this.currentPlayer.position = CORNER_JAIL;
        this.currentPlayer.jailTurns = 1;
        this.currentPlayer.status = 'jailed';
        this.currentPlayer.consecutiveDoubles = 0;
        this.addLog(`${this.currentPlayer.name} 连续三次掷出对子，被送进监狱！`, 'jail', `${this.currentPlayer.name} rolled 3 doubles — jail!`);
        this.emitEvent({ kind: 'jail_in', playerId: this.currentPlayer.id, reason: 'three_doubles' });
        this.state.phase = 'awaitEnd';
      } else {
        this.addLog(`${this.currentPlayer.name} 掷出对子，再掷一次！`, 'info', `${this.currentPlayer.name} rolled doubles — roll again!`);
        this.state.diceRolled = false; // allow re-roll
        this.emitChange();
        return { dice, result };
      }
    }

    // Process landing (rent, tax, card draw, rentChoice, etc.)
    this.consumeLanding(this.engine.processLanding(result.newPosition));

    return { dice, result };
  }

  buyProperty(): { success: boolean; error?: string } {
    const err = this.engine.validateBuyProperty();
    if (err) return { success: false, error: err };

    this.engine.executeBuyProperty();
    this.state.phase = 'awaitEnd';
    this.emitChange();
    return { success: true };
  }

  passBuyProperty(): { success: boolean } {
    if (this.state.phase !== 'buying') return { success: false };
    this.state.phase = 'awaitEnd';
    this.emitChange();
    return { success: true };
  }

  buildHouse(tileIndex: number): { success: boolean; error?: string } {
    const err = this.engine.validateBuildHouse(tileIndex);
    if (err) return { success: false, error: err };

    // 免费建屋卡激活时，本次建房不扣款
    const free = this.currentPlayer.freeBuildPending;
    this.engine.executeBuildHouse(tileIndex, free);
    if (free) {
      this.currentPlayer.freeBuildPending = false;
      this.addLog(`${this.currentPlayer.name} 的免费建屋卡已消耗`, 'info', `${this.currentPlayer.name}'s Free-Build card consumed`);
    }
    this.emitChange();
    return { success: true };
  }

  sellHouse(tileIndex: number): { success: boolean; error?: string } {
    const err = this.engine.validateSellHouse(tileIndex);
    if (err) return { success: false, error: err };

    this.engine.executeSellHouse(tileIndex);
    // If in debt and now solvent, continue
    if (this.state.phase === 'debt' && this.currentPlayer.cash >= 0) {
      this.state.phase = 'awaitEnd';
    }
    this.emitChange();
    return { success: true };
  }

  endTurn(): void {
    // Guard: can only end turn from awaitEnd, stock, or debt phases
    if (this.state.phase !== 'awaitEnd' && this.state.phase !== 'stock' && this.state.phase !== 'debt') {
      return;
    }

    if (this.state.phase === 'debt') {
      // Player can't pay → declare bankruptcy
      const result = this.engine.declareBankruptcy();
      const winner = this.engine.checkWinner();
      if (winner) {
        this.state.winner = winner.id;
        this.state.phase = 'ended';
        this.addLog(`${winner.name} 获胜！`, 'victory', `${winner.name} wins!`);
        this.emitEvent({ kind: 'game_over', winnerId: winner.id, winnerName: winner.name });
        this.emitChange();
        return;
      }
    }

    // Check for winner
    const winner = this.engine.checkWinner();
    if (winner) {
      this.state.winner = winner.id;
      this.state.phase = 'ended';
      this.addLog(`${winner.name} 获胜！`, 'victory', `${winner.name} wins!`);
      this.emitEvent({ kind: 'game_over', winnerId: winner.id, winnerName: winner.name });
      this.emitChange();
      return;
    }

    // Apply cash drain
    if (this.currentPlayer.cash > 0) {
      const eff = getEffectiveConfig(this.state.config.theme, this.state.config.difficulty);
      if (eff.drainPct > 0) {
        const drain = Math.round(this.currentPlayer.cash * eff.drainPct);
        this.currentPlayer.cash -= drain;
        if (drain > 0) {
          this.addLog(`🔧 ${this.currentPlayer.name} → 银行 资产维护费 $${drain}（${Math.round(eff.drainPct * 100)}%）`, 'info', `🔧 ${this.currentPlayer.name} → Bank maintenance $${drain} (${Math.round(eff.drainPct * 100)}%)`);
          this.emitEvent({ kind: 'maintenance', playerId: this.currentPlayer.id, amount: drain, rate: Math.round(eff.drainPct * 100) });
        }
      }
    }

    // Update stock prices
    updateStockPrices(this.state);

    // Process dividends
    const dividendEvents = processDividends(this.state);
    if (dividendEvents.length > 0) {
      // Show dividend event for the current player if they received one
      const myEvent = dividendEvents.find(e => e.kind === 'dividend' && e.playerId === this.currentPlayer.id);
      if (myEvent) this.state.gameEvent = myEvent;
    }

    // Advance to next player
    this.advanceTurn();
    this.emitChange();
  }

  private advanceTurn(): void {
    const activePlayers = this.state.players.filter(p => p.status !== 'bankrupt' && !p.isSpectator);

    // Find next active player
    let next = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    while (
      (this.state.players[next].status === 'bankrupt' || this.state.players[next].isSpectator) &&
      attempts < this.state.players.length
    ) {
      next = (next + 1) % this.state.players.length;
      attempts++;
    }

    // Skip players flagged to miss their turn (跳回合卡)
    let skipGuard = 0;
    while (this.state.players[next].skipNextTurn && skipGuard < this.state.players.length) {
      const skipped = this.state.players[next];
      skipped.skipNextTurn = false;
      this.addLog(`⏭️ ${skipped.name} 的回合被跳过`, 'info', `⏭️ ${skipped.name}'s turn skipped`);
      next = (next + 1) % this.state.players.length;
      let guard = 0;
      while (
        (this.state.players[next].status === 'bankrupt' || this.state.players[next].isSpectator) &&
        guard < this.state.players.length
      ) {
        next = (next + 1) % this.state.players.length;
        guard++;
      }
      skipGuard++;
    }

    // Only increment round when wrapping around to first player
    if (next <= this.state.currentPlayerIndex) {
      this.state.round++;
    }

    this.state.currentPlayerIndex = next;
    this.state.phase = 'rolling';
    this.state.dice = null;
    this.state.diceRolled = false;
    this.state.lastCardDrawn = null;
    this.state.wheelResult = null;
    this.state.cardChoice = null;
    this.state.actionCardPrompt = null;
    this.state.gameEvent = null;
    this.state.ringTransferred = false;

    // Weather change check
    this.state.weatherTimer--;
    if (this.state.weatherTimer <= 0) {
      const oldWeather = this.state.weather;
      this.state.weather = this.rollWeather();
      this.state.weatherTimer = 25 + Math.floor(Math.random() * 20);
      if (oldWeather !== this.state.weather) {
        this.emitEvent({ kind: 'weather', from: oldWeather, to: this.state.weather });
      }
    }

    // Day/night progression
    this.state.dayTime = (this.state.dayTime + 0.008) % 1;

    this.addLog(`轮到 ${this.currentPlayer.name}`, 'info', `${this.currentPlayer.name}'s turn`);

    // God spirit turn countdown — a god leaves after its duration expires
    if (this.currentPlayer.god) {
      this.currentPlayer.god.turnsLeft--;
      if (this.currentPlayer.god.turnsLeft <= 0) {
        const g = this.currentPlayer.god.kind;
        this.currentPlayer.god = null;
        this.emitEvent({ kind: 'god_dismiss', playerId: this.currentPlayer.id, god: g });
        this.addLog(`👋 ${this.currentPlayer.name} 身上的${g === 'wealth' ? '财神' : '衰神'}离开了`, 'info', `👋 ${g === 'wealth' ? 'Wealth' : 'Misfortune'} God left ${this.currentPlayer.name}`);
      }
    }

    // Periodically respawn gods so the board stays populated
    if (this.state.round % GOD_RESPAWN_ROUNDS === 0 && this.state.gods.length < GOD_MAX_ON_BOARD) {
      this.spawnGod();
    }

    // If next player is bot, schedule their turn
    if (this.currentPlayer.isBot || this.currentPlayer.autoPilot) {
      this.scheduleBotTurn();
    }
  }

  private playerInJail(): boolean {
    return this.currentPlayer.status === 'jailed';
  }

  // ---- Jail Actions ----

  payJailFine(): { success: boolean } {
    if (this.currentPlayer.status !== 'jailed') return { success: false };
    this.currentPlayer.cash -= JAIL_FINE;
    this.currentPlayer.jailTurns = 0;
    this.currentPlayer.status = 'active';
    this.addLog(`🔓 ${this.currentPlayer.name} 向银行缴纳 $${JAIL_FINE} 保释出狱`, 'info', `🔓 ${this.currentPlayer.name} paid $${JAIL_FINE} bail`);
    this.emitEvent({ kind: 'jail_out', playerId: this.currentPlayer.id, method: 'pay_fine' });
    this.emitChange();
    return { success: true };
  }

  useJailCard(): { success: boolean } {
    if (this.currentPlayer.status !== 'jailed') return { success: false };
    if (this.currentPlayer.getOutOfJailCards <= 0) return { success: false };
    this.currentPlayer.getOutOfJailCards--;
    this.currentPlayer.jailTurns = 0;
    this.currentPlayer.status = 'active';
    this.addLog(`🃏 ${this.currentPlayer.name} 使用出狱卡出狱`, 'info', `🃏 ${this.currentPlayer.name} used Get Out of Jail card`);
    this.emitEvent({ kind: 'jail_out', playerId: this.currentPlayer.id, method: 'use_card' });
    this.emitChange();
    return { success: true };
  }

  tryJailDice(): { success: boolean } {
    if (this.currentPlayer.status !== 'jailed') return { success: false };
    const dice = rollDice();
    this.state.dice = dice;
    // Single die: 1/3 chance to escape (rolling 5 or 6)
    const escaped = dice.die1 >= 5;
    if (escaped) {
      this.currentPlayer.jailTurns = 0;
      this.currentPlayer.status = 'active';
      this.currentPlayer.consecutiveDoubles = 0;
      this.state.phase = 'rolling';
      this.addLog(`🎲 ${this.currentPlayer.name} 掷出 ${dice.die1} 点，越狱成功！`, 'info', `🎲 ${this.currentPlayer.name} rolled ${dice.die1} — broke out of jail!`);
      this.emitEvent({ kind: 'jail_out', playerId: this.currentPlayer.id, method: 'doubles' });
    } else {
      this.currentPlayer.jailTurns++;
      this.addLog(`🔒 ${this.currentPlayer.name} 掷出 ${dice.die1} 点，未能出狱（${this.currentPlayer.jailTurns}/3回合）`, 'info', `🔒 ${this.currentPlayer.name} rolled ${dice.die1} — still in jail (${this.currentPlayer.jailTurns}/3 turns)`);
      if (this.currentPlayer.jailTurns >= 3) {
        this.currentPlayer.cash -= JAIL_FINE;
        this.currentPlayer.jailTurns = 0;
        this.currentPlayer.status = 'active';
        this.addLog(`${this.currentPlayer.name} 关押3回，强制付 $${JAIL_FINE} 出狱`, 'info', `${this.currentPlayer.name} jailed 3 turns — forced bail $${JAIL_FINE}`);
        this.emitEvent({ kind: 'jail_out', playerId: this.currentPlayer.id, method: 'forced' });
      }
    }
    this.state.phase = 'awaitEnd';
    this.emitChange();
    return { success: true };
  }

  // ---- Cards ----

  private offerCardChoice(type: 'chance' | 'community_chest'): void {
    const deck = type === 'chance' ? this.state.chanceDeck : this.state.communityDeck;
    const cards = type === 'chance' ? this.state.cards.chance : this.state.cards.community_chest;

    if (deck.length < CARD_CHOICE_COUNT) {
      // Not enough cards left — rebuild a fresh shuffled deck
      deck.length = 0;
      deck.push(...shuffle(cards.map((_, i) => i)));
    }

    // Guarantee at least one holdable (action) card among the face-down options,
    // so every card-tile landing has a real chance to net a hand card.
    const picked: number[] = [];
    const holdIdx = deck.find(idx => cards[idx].hold);
    if (holdIdx !== undefined) {
      const removeAt = deck.indexOf(holdIdx);
      if (removeAt !== -1) {
        deck.splice(removeAt, 1);
        picked.push(holdIdx);
      }
    }
    while (picked.length < CARD_CHOICE_COUNT) {
      picked.push(deck.pop()!);
    }

    const options: { idx: number }[] = shuffle(picked).map(idx => ({ idx }));

    this.state.cardChoice = { type, options };
    this.state.phase = 'cardChoice';
    // No emit here — rollDice emits once after landing processing
  }

  pickCard(choiceIndex: number): { success: boolean } {
    if (this.state.phase !== 'cardChoice' || !this.state.cardChoice) return { success: false };
    const choice = this.state.cardChoice;
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choice.options.length) {
      return { success: false };
    }

    const type = choice.type;
    const deck = type === 'chance' ? this.state.chanceDeck : this.state.communityDeck;
    const cards = type === 'chance' ? this.state.cards.chance : this.state.cards.community_chest;

    // Chosen card is consumed; return the others to the bottom of the deck
    // (unshift = bottom of the pop-from-end stack, so they don't repeat next offer)
    const chosenIdx = choice.options[choiceIndex].idx;
    const unchosen = choice.options
      .filter((_, i) => i !== choiceIndex)
      .map(o => o.idx);
    deck.unshift(...unchosen);

    this.state.cardChoice = null;

    const card = cards[chosenIdx];
    this.state.lastCardDrawn = { type, card };

    // Emit gameEvent so all players see who drew which card
    this.state.gameEvent = {
      kind: 'card',
      playerId: this.currentPlayer.id,
      cardType: type,
      description: card.description,
      descriptionCN: card.descriptionCN,
    };

    this.addLog(`${this.currentPlayer.name} 抽到: ${card.descriptionCN}`, 'card', `${this.currentPlayer.name} drew: ${card.description}`);

    // Held action cards go into the hand instead of resolving immediately
    if (card.hold) {
      if (this.currentPlayer.heldCards.length < MAX_HELD_CARDS) {
        this.currentPlayer.heldCards.push(card.id);
        this.addLog(`${this.currentPlayer.name} 的行动卡已入手牌`, 'card', `${this.currentPlayer.name} added action card to hand`);
      } else {
        this.addLog(`${this.currentPlayer.name} 手牌已满,${card.descriptionCN} 被丢弃`, 'card', `${this.currentPlayer.name}'s hand full — ${card.description} discarded`);
      }
    } else {
      this.applyCardEffect(card);
    }

    // Resolve the turn stage: if the card effect didn't change the phase, end it
    if (this.state.phase === 'cardChoice') {
      this.state.phase = 'awaitEnd';
    }
    // Card may have drained cash → debt
    if (this.currentPlayer.cash < 0) {
      this.state.phase = 'debt';
    }

    this.emitChange();
    return { success: true };
  }

  private applyCardEffect(card: { effect: any }): void {
    const player = this.currentPlayer;
    const effect = card.effect;

    switch (effect.kind) {
      case 'move': {
        const { position, passedGo } = moveToTile(effect.target, player.position);
        player.position = position;
        if (passedGo && effect.collectGo) {
          player.cash += GO_SALARY[this.state.config.theme];
        }
        // Re-process landing (may enter buying / rentChoice)
        this.consumeLanding(this.engine.processLanding(position), { emit: false, keepGameEvent: true });
        break;
      }

      case 'moveToNearest': {
        const nearest = findNearestTile(player.position, effect.tileType);
        player.position = nearest;
        const payMultiplier = effect.payMultiplier || 1;
        this.consumeLanding(this.engine.processLanding(nearest, payMultiplier), { emit: false, keepGameEvent: true });
        break;
      }

      case 'cash': {
        player.cash += effect.amount;
        break;
      }

      case 'cashPerPlayer': {
        const others = this.state.players.filter(p => p.id !== player.id && p.status !== 'bankrupt');
        for (const other of others) {
          if (effect.amount > 0) {
            other.cash -= effect.amount;
            player.cash += effect.amount;
          } else {
            other.cash += Math.abs(effect.amount);
            player.cash -= Math.abs(effect.amount);
          }
        }
        break;
      }

      case 'jail': {
        player.position = CORNER_JAIL;
        player.jailTurns = 1;
        player.status = 'jailed';
        this.emitEvent({ kind: 'jail_in', playerId: player.id, reason: 'card' });
        break;
      }

      case 'getOutOfJail': {
        player.getOutOfJailCards++;
        break;
      }

      case 'repairs': {
        let total = 0;
        for (const [idx, count] of Object.entries(player.houses)) {
          total += count >= 5 ? effect.perHotel * count : effect.perHouse * count;
        }
        player.cash -= total;
        break;
      }

      case 'moveBack': {
        const ringStart = player.groundRing === 'inner' ? 0 : OUTER_RING_OFFSET;
        const ringSize = GROUND_INNER_RING_SIZE;
        const localPos = player.position - ringStart;
        const newLocalPos = localPos - effect.spaces;
        player.position = newLocalPos < 0 ? ringStart + ringSize + newLocalPos : ringStart + newLocalPos;
        this.consumeLanding(this.engine.processLanding(player.position), { emit: false, keepGameEvent: true });
        break;
      }
    }
  }

  // ---- Landing resolution (shared by dice, card-move and ring transfer) ----

  private consumeLanding(
    landing: ReturnType<RuleEngine['processLanding']>,
    opts: { emit?: boolean; keepGameEvent?: boolean } = {},
  ): void {
    if (landing.gameEvent && !opts.keepGameEvent) {
      this.state.gameEvent = landing.gameEvent;
    }
    this.state.phase = landing.phase;

    if (landing.phase === 'god' && landing.godPickup) {
      // A god occupies this tile — pick it up and attach it.
      if (this.currentPlayer.god) {
        // Already has a god → leave the entity in place and process the tile normally.
        this.consumeLanding(this.engine.processLanding(landing.godPickup.tileIndex, 1, true), opts);
        return;
      }
      const god = landing.godPickup;
      this.state.gods = this.state.gods.filter(g => g.id !== god.id); // consume the entity
      this.attachGod(this.currentPlayer, god.kind);
      this.state.phase = 'awaitEnd';
    } else if (landing.phase === 'rentChoice' && landing.holdPrompt && landing.rentTarget) {
      this.buildRentChoicePrompt(landing);
    } else if (landing.cardType && this.currentPlayer.cash >= 0) {
      this.offerCardChoice(landing.cardType);
    }

    // Check bankruptcy (card effect may have taken cash)
    if (this.currentPlayer.cash < 0) {
      this.state.phase = 'debt';
    }

    if (opts.emit !== false) this.emitChange();
    if (this.state.phase === 'rentChoice') this.maybeScheduleRentChoiceBot();
  }

  private buildRentChoicePrompt(landing: ReturnType<RuleEngine['processLanding']>): void {
    const prompt = landing.holdPrompt!;
    const owner = this.state.players.find(p => p.id === landing.rentTarget);
    if (!owner) return;
    const tile = this.state.tiles[this.currentPlayer.position];
    this.state.actionCardPrompt = {
      kind: prompt.kind,
      actorId: prompt.actorId,
      payerId: this.currentPlayer.id,
      ownerId: owner.id,
      baseRent: landing.rentAmount,
      tileIndex: this.currentPlayer.position,
      tileName: tile.name,
      tileNameCN: tile.nameCN,
    };
    this.addLog(`${this.currentPlayer.name} 租金待结算`, 'info', `${this.currentPlayer.name} rent pending`);
  }

  // ---- Held Action Cards ----

  /**
   * Play a held action card.
   * - In the rentChoice phase: the card must match the pending prompt (rentFree / doubleRent).
   * - Otherwise: active cards on the current player's own turn — rob (target another player),
   *   dismissGod (send away your attached god), summonGod (attract the nearest god within view).
   */
  useHeldCard(requesterId: string, cardId: number, targetId?: string): { success: boolean; error?: string } {
    if (this.state.phase === 'rentChoice' && this.state.actionCardPrompt) {
      return this.resolveRentChoiceCard(requesterId, cardId);
    }

    // Active cards — only the current player, on their own turn
    const player = this.state.players.find(p => p.id === requesterId);
    if (!player || player.id !== this.currentPlayer.id) return { success: false, error: '现在不能使用' };
    if (this.state.phase !== 'rolling' && this.state.phase !== 'awaitEnd') return { success: false, error: '现在不能使用' };

    const card = findCardById(this.state.cards, cardId);
    if (!card) return { success: false, error: '无效的卡片' };
    if (!player.heldCards.includes(cardId)) return { success: false, error: '你没有这张卡' };

    // 送神卡 — dismiss the god attached to you
    if (card.effect.kind === 'dismissGod') {
      if (!player.god) return { success: false, error: '你身上没有神仙' };
      const god = player.god.kind;
      player.god = null;
      player.heldCards = player.heldCards.filter(id => id !== cardId);
      this.addLog(`🙏 ${player.name} 使用送神卡，送走了${god === 'wealth' ? '财神' : '衰神'}`, 'info', `🙏 ${player.name} used Send-Away card to dismiss the ${god === 'wealth' ? 'Wealth' : 'Misfortune'} God`);
      this.emitEvent({ kind: 'god_dismiss', playerId: player.id, god });
      this.emitChange();
      return { success: true };
    }

    // 请神卡 — summon the nearest god within view onto yourself
    if (card.effect.kind === 'summonGod') {
      if (player.god) return { success: false, error: '已有神仙附身' };
      const god = nearestGodWithin(this.state.gods, player.position);
      if (!god) return { success: false, error: '视野内没有神仙' };
      this.state.gods = this.state.gods.filter(g => g.id !== god.id); // consume the entity
      player.heldCards = player.heldCards.filter(id => id !== cardId);
      this.addLog(`✨ ${player.name} 使用请神卡，请来了${god.kind === 'wealth' ? '财神' : '衰神'}`, 'info', `✨ ${player.name} used Invite card to summon the ${god.kind === 'wealth' ? 'Wealth' : 'Misfortune'} God`);
      this.attachGod(player, god.kind);
      this.emitChange();
      return { success: true };
    }

    // 免费建屋卡 — activate a free-build buff (next build costs nothing)
    if (card.effect.kind === 'buildFree') {
      if (player.freeBuildPending) return { success: false, error: '免费建屋效果已激活' };
      player.freeBuildPending = true;
      player.heldCards = player.heldCards.filter(id => id !== cardId);
      this.addLog(`🏗️ ${player.name} 使用免费建屋卡，下次建房免费`, 'info', `🏗️ ${player.name} used Free-Build card — next build is free`);
      this.emitEvent({ kind: 'cardUsed', playerId: player.id, cardId, description: card.description, descriptionCN: card.descriptionCN });
      this.emitChange();
      return { success: true };
    }

    // Target-based active cards (skipTurn / stealProperty / swapPositions / rob)
    const target = this.state.players.find(p => p.id === targetId);
    if (!target || target.id === player.id || target.status === 'bankrupt' || target.isSpectator) {
      return { success: false, error: '无效的目标玩家' };
    }

    // 跳回合卡 — make the target skip their next turn
    if (card.effect.kind === 'skipTurn') {
      target.skipNextTurn = true;
      player.heldCards = player.heldCards.filter(id => id !== cardId);
      this.addLog(`⏭️ ${player.name} 对 ${target.name} 使用跳回合卡`, 'info', `⏭️ ${player.name} used Skip-Turn card on ${target.name}`);
      this.emitEvent({ kind: 'cardUsed', playerId: player.id, cardId, description: card.description, descriptionCN: card.descriptionCN, targetId: target.id });
      this.emitChange();
      return { success: true };
    }

    // 强征地产卡 — steal one unimproved property from the target
    if (card.effect.kind === 'stealProperty') {
      const stealable = target.properties.filter(idx => !target.houses[idx] && getPropertyDef(idx));
      if (stealable.length === 0) return { success: false, error: '目标没有可强征的无建筑地产' };
      const stolenIdx = stealable[0];
      target.properties = target.properties.filter(idx => idx !== stolenIdx);
      player.properties.push(stolenIdx);
      player.heldCards = player.heldCards.filter(id => id !== cardId);
      const prop = getPropertyDef(stolenIdx)!;
      this.addLog(`🏛️ ${player.name} 强征了 ${target.name} 的「${prop.nameCN}」`, 'info', `🏛️ ${player.name} claimed ${prop.nameEN} from ${target.name}`);
      this.emitEvent({ kind: 'cardUsed', playerId: player.id, cardId, description: card.description, descriptionCN: card.descriptionCN, targetId: target.id });
      this.emitChange();
      return { success: true };
    }

    // 移形换位卡 — swap board positions with the target
    if (card.effect.kind === 'swapPositions') {
      if (target.status === 'jailed') return { success: false, error: '不能与在押玩家换位' };
      const tmpPos = player.position; const tmpRing = player.groundRing; const tmpIR = player.innerCityRing; const tmpIS = player.innerCitySector;
      player.position = target.position; player.groundRing = target.groundRing; player.innerCityRing = target.innerCityRing; player.innerCitySector = target.innerCitySector;
      target.position = tmpPos; target.groundRing = tmpRing; target.innerCityRing = tmpIR; target.innerCitySector = tmpIS;
      player.heldCards = player.heldCards.filter(id => id !== cardId);
      this.addLog(`🌀 ${player.name} 与 ${target.name} 交换了位置`, 'info', `🌀 ${player.name} swapped positions with ${target.name}`);
      this.emitEvent({ kind: 'cardUsed', playerId: player.id, cardId, description: card.description, descriptionCN: card.descriptionCN, targetId: target.id });
      this.emitChange();
      return { success: true };
    }

    // Rob card — steal from a target player
    if (card.effect.kind !== 'rob') return { success: false, error: '此卡不能在此使用' };

    const stolen = Math.min(card.effect.amount, target.cash);
    target.cash -= stolen;
    player.cash += stolen;
    player.heldCards = player.heldCards.filter(id => id !== cardId);
    this.addLog(`🦹 ${player.name} 偷走了 ${target.name} 的 $${stolen}`, 'info', `🦹 ${player.name} stole $${stolen} from ${target.name}`);
    this.emitEvent({ kind: 'rob', actorId: player.id, targetId: target.id, amount: stolen });
    this.emitChange();
    return { success: true };
  }

  private resolveRentChoiceCard(requesterId: string, cardId: number): { success: boolean; error?: string } {
    const prompt = this.state.actionCardPrompt!;
    if (requesterId !== prompt.actorId) return { success: false, error: '不是你的决策' };

    const actor = this.state.players.find(p => p.id === prompt.actorId)!;
    const card = findCardById(this.state.cards, cardId);
    if (!card || !actor.heldCards.includes(cardId)) return { success: false, error: '你没有这张卡' };

    const matches = (card.effect.kind === 'rentFree' && prompt.kind === 'rentFree')
      || (card.effect.kind === 'doubleRent' && prompt.kind === 'doubleRent');
    if (!matches) return { success: false, error: '此卡不能在此使用' };

    // Consume the card
    actor.heldCards = actor.heldCards.filter(id => id !== cardId);

    const payer = this.state.players.find(p => p.id === prompt.payerId)!;
    const owner = this.state.players.find(p => p.id === prompt.ownerId)!;

    let amount: number | undefined;
    if (prompt.kind === 'rentFree') {
      amount = prompt.baseRent; // rent saved
      this.addLog(`🃏 ${payer.name} 使用免租卡，免付 ${owner.name} 的租金 $${prompt.baseRent}`, 'info', `🃏 ${payer.name} used Rent-Free card to skip $${prompt.baseRent} rent to ${owner.name}`);
    } else {
      const rent = prompt.baseRent * 2;
      amount = rent;
      this.addLog(`💸 ${payer.name} → ${owner.name} 双倍租金 $${rent}`, 'rent', `💸 ${payer.name} → ${owner.name} double rent $${rent}`);
      this.transferRent(payer, owner, rent, prompt);
    }

    this.emitEvent({
      kind: 'cardUsed',
      playerId: actor.id,
      cardId: card.id,
      description: card.description,
      descriptionCN: card.descriptionCN,
      amount,
    });
    this.finalizeRentChoice(payer);
    return { success: true };
  }

  /** Decline the action card — pay the normal rent (or re-offer the payer's rent-free card if the owner declined double-rent). */
  payRentNow(requesterId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'rentChoice' || !this.state.actionCardPrompt) {
      return { success: false, error: '当前没有待决租金' };
    }
    const prompt = this.state.actionCardPrompt;
    if (requesterId !== prompt.actorId) return { success: false, error: '不是你的决策' };

    // Owner declined double-rent → offer the payer's rent-free card next
    if (prompt.kind === 'doubleRent') {
      const payer = this.state.players.find(p => p.id === prompt.payerId)!;
      if (playerHasHeldCardKind(payer, this.state.cards, 'rentFree')) {
        this.state.actionCardPrompt = { ...prompt, kind: 'rentFree', actorId: payer.id };
        this.emitChange();
        this.maybeScheduleRentChoiceBot();
        return { success: true };
      }
    }

    const payer = this.state.players.find(p => p.id === prompt.payerId)!;
    const owner = this.state.players.find(p => p.id === prompt.ownerId)!;
    this.addLog(`💸 ${payer.name} → ${owner.name} 租金 $${prompt.baseRent}`, 'rent', `💸 ${payer.name} → ${owner.name} rent $${prompt.baseRent}`);
    this.transferRent(payer, owner, prompt.baseRent, prompt);
    this.finalizeRentChoice(payer);
    return { success: true };
  }

  private transferRent(
    payer: Player,
    owner: Player,
    amount: number,
    prompt: { tileIndex: number; tileName: string; tileNameCN: string },
  ): void {
    payer.cash -= amount;
    owner.cash += amount;
    if (amount > 0) {
      this.emitEvent({
        kind: 'rent',
        playerId: payer.id,
        targetId: owner.id,
        amount,
        tileIndex: prompt.tileIndex,
        tileName: prompt.tileName,
        tileNameCN: prompt.tileNameCN,
      });
    }
  }

  private finalizeRentChoice(payer: Player): void {
    this.state.phase = payer.cash < 0 ? 'debt' : 'awaitEnd';
    this.state.actionCardPrompt = null;
    this.emitChange();
    // Resume the current player's bot/auto-pilot turn (the payer, who is always the current player)
    if (this.currentPlayer.isBot || this.currentPlayer.autoPilot) {
      this.scheduleBotAfterRoll();
    }
  }

  // ---- Rent-choice bot interrupt (the actor may NOT be the current player) ----

  private maybeScheduleRentChoiceBot(): void {
    if (this.state.phase !== 'rentChoice' || !this.state.actionCardPrompt) return;
    const actor = this.state.players.find(p => p.id === this.state.actionCardPrompt!.actorId);
    if (!actor || (!actor.isBot && !actor.autoPilot)) return;
    const existing = this.botTimers.get(actor.id);
    if (existing) clearTimeout(existing);
    const delay = actor.isBot ? 1000 : 1500;
    const timer = setTimeout(() => {
      this.botTimers.delete(actor.id);
      this.executeRentChoiceAction();
    }, delay);
    this.botTimers.set(actor.id, timer);
  }

  private executeRentChoiceAction(): void {
    if (this.state.phase !== 'rentChoice' || !this.state.actionCardPrompt) return;
    const prompt = this.state.actionCardPrompt;
    const actor = this.state.players.find(p => p.id === prompt.actorId);
    if (!actor || (!actor.isBot && !actor.autoPilot)) return;

    const decision = decideBotAction(this.state, actor);
    if (decision.action === 'useHeldCard') {
      this.useHeldCard(actor.id, decision.cardId!, decision.targetId);
    } else if (decision.action === 'payRentNow') {
      this.payRentNow(actor.id);
    }

    if (this.state.phase === 'rentChoice') {
      // Owner declined double-rent → re-offer the payer's rent-free card
      this.maybeScheduleRentChoiceBot();
    }
    // Otherwise finalizeRentChoice already resumed the current player's bot turn.
  }

  // ---- God Spirits (财神 / 衰神) ----

  private attachGod(player: Player, kind: GodKind): void {
    player.god = { kind, turnsLeft: GOD_DURATION_TURNS };
    this.emitEvent({ kind: 'god_attach', playerId: player.id, god: kind });

    if (kind === 'wealth') {
      const targets = this.state.players.filter(p => p.id !== player.id && p.status !== 'bankrupt' && !p.isSpectator);
      let total = 0;
      for (const t of targets) {
        t.cash -= GOD_WEALTH_AMOUNT;
        total += GOD_WEALTH_AMOUNT;
      }
      player.cash += total;
      if (targets.length > 0) {
        this.emitEvent({
          kind: 'god_wealth_collect', playerId: player.id, amountPer: GOD_WEALTH_AMOUNT,
          targetIds: targets.map(t => t.id), total,
        });
        this.addLog(`😇 ${player.name} 受财神庇佑，向每名对手收取 $${GOD_WEALTH_AMOUNT}`, 'info', `😇 ${player.name} blessed by Wealth God, collected $${GOD_WEALTH_AMOUNT} each`);
      }
    } else {
      // 衰神:随机丢 2 张手牌(不足则丢光)
      const lost = shuffle(player.heldCards).slice(0, Math.min(2, player.heldCards.length));
      if (lost.length > 0) {
        player.heldCards = player.heldCards.filter(id => !lost.includes(id));
        this.emitEvent({ kind: 'god_card_lost', playerId: player.id, lost: lost.length });
        this.addLog(`👿 ${player.name} 被衰神附身，丢失 ${lost.length} 张手牌`, 'info', `👿 ${player.name} cursed by Misfortune God, lost ${lost.length} card(s)`);
      }
    }
  }

  private spawnGod(): void {
    // Valid tiles: ground rings, excluding corners and special action tiles, not already occupied
    const excludedTypes = new Set(['go', 'jail', 'goto_jail', 'stock_market', 'wheel']);
    const candidates: number[] = [];
    for (let i = 0; i < this.state.tiles.length; i++) {
      if (!isGroundTile(i)) continue;
      const type = this.state.tiles[i].type;
      if (excludedTypes.has(type)) continue;
      if (this.state.gods.some(g => g.tileIndex === i)) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return;

    const kind: GodKind = Math.random() < 0.5 ? 'wealth' : 'misfortune';
    const tileIndex = candidates[Math.floor(Math.random() * candidates.length)];
    this.state.gods.push({ id: ++this.godIdCounter, kind, tileIndex });
  }

  // ---- Wheel ----

  spinWheel(): number {
    const sectorIndex = Math.floor(Math.random() * 14);
    this.state.wheelResult = sectorIndex;
    const sector = [
      { label: '+$200', effect: { kind: 'cash' as const, amount: 200 } },
      { label: '+$500', effect: { kind: 'cash' as const, amount: 500 } },
      { label: '+$1000', effect: { kind: 'cash' as const, amount: 1000 } },
      { label: '-$100', effect: { kind: 'cash' as const, amount: -100 } },
      { label: '-$300', effect: { kind: 'cash' as const, amount: -300 } },
      { label: '进监狱', effect: { kind: 'jail' as const } },
      { label: '前进到GO', effect: { kind: 'moveToGO' as const } },
      { label: '每人付你$50', effect: { kind: 'cashPerPlayer' as const, amount: 50 } },
      { label: '你付每人$50', effect: { kind: 'cashPerPlayer' as const, amount: -50 } },
      { label: '出狱卡', effect: { kind: 'getOutOfJail' as const } },
      { label: '免费建房', effect: { kind: 'freeHouse' as const } },
      { label: '科技股×2', effect: { kind: 'freeStock' as const, symbol: 'TECH', shares: 2 } },
      { label: '黄金股×1', effect: { kind: 'freeStock' as const, symbol: 'GOLD', shares: 1 } },
      { label: 'AI股×2', effect: { kind: 'freeStock' as const, symbol: 'AI', shares: 2 } },
    ][sectorIndex];

    // Apply effect
    const player = this.currentPlayer;
    switch (sector.effect.kind) {
      case 'cash':
        player.cash += sector.effect.amount;
        break;
      case 'jail':
        player.position = CORNER_JAIL;
        player.jailTurns = 1;
        player.status = 'jailed';
        this.emitEvent({ kind: 'jail_in', playerId: player.id, reason: 'wheel' });
        break;
      case 'moveToGO':
        player.position = CORNER_GO;
        player.cash += GO_SALARY[this.state.config.theme];
        break;
      case 'cashPerPlayer':
        for (const other of this.state.players) {
          if (other.id === player.id || other.status === 'bankrupt') continue;
          if (sector.effect.amount > 0) {
            other.cash -= sector.effect.amount;
            player.cash += sector.effect.amount;
          } else {
            other.cash += Math.abs(sector.effect.amount);
            player.cash -= Math.abs(sector.effect.amount);
          }
        }
        break;
      case 'getOutOfJail':
        player.getOutOfJailCards++;
        break;
      case 'freeHouse': {
        // Build one free house on first buildable property
        for (const idx of player.properties) {
          const err = this.engine.validateBuildHouse(idx);
          if (!err) { this.engine.executeBuildHouse(idx); break; }
        }
        break;
      }
      case 'freeStock': {
        const stock = this.state.stocks.find(s => s.symbol === sector.effect.symbol);
        if (stock) {
          const existing = player.stocks.find(s => s.symbol === stock.symbol);
          if (existing) existing.shares += sector.effect.shares;
          else player.stocks.push({ symbol: stock.symbol, shares: sector.effect.shares, avgCost: stock.price });
        }
        break;
      }
    }

    this.addLog(`${player.name} 转到了: ${sector.label}`, 'info', `${player.name} spun: ${sector.label}`);
    this.state.phase = 'awaitEnd';
    this.emitChange();
    return sectorIndex;
  }

  // ---- Stock Trading ----

  buyStock(playerId: string, symbol: string, shares: number): { success: boolean; error?: string } {
    // Only the current player may trade on their stock-market turn — attribute
    // the trade to the requester, not whoever happens to be the current player.
    if (playerId !== this.currentPlayer.id) return { success: false, error: '现在不能交易股票' };
    const err = executeBuyStock(this.state, playerId, symbol, shares);
    if (err) return { success: false, error: err };
    // Private: only log for the trading player, not broadcast as public event
    this.emitChange();
    return { success: true };
  }

  sellStock(playerId: string, symbol: string, shares: number): { success: boolean; error?: string } {
    if (playerId !== this.currentPlayer.id) return { success: false, error: '现在不能交易股票' };
    const err = executeSellStock(this.state, playerId, symbol, shares);
    if (err) return { success: false, error: err };
    // Private: only log for the trading player, not broadcast as public event
    this.emitChange();
    return { success: true };
  }

  // ---- High Speed Rail ----

  takeHighSpeedRail(targetTheme: ThemeId): { success: boolean; error?: string } {
    const player = this.currentPlayer;
    const tile = this.state.tiles[player.position];
    if (tile.type !== 'railway') return { success: false, error: '当前位置不是铁路' };

    const owner = this.state.players.find(p => p.properties.includes(player.position));
    const cost = (owner && owner.id === player.id) ? 0 : 50;
    if (player.cash < cost) return { success: false, error: '现金不足' };

    player.cash -= cost;
    this.state.config.theme = targetTheme;
    this.addLog(`🚄 ${player.name} 乘坐高铁切换到 ${THEMES[targetTheme].nameCN}（费用 $200）`, 'info', `🚄 ${player.name} took HSR to ${THEMES[targetTheme].name} (fee $200)`);
    this.emitChange();
    return { success: true };
  }

  // ---- Inner City ----

  enterInnerCity(sector: number): { success: boolean } {
    const player = this.currentPlayer;
    // Entry fee based on ring
    const entryFees = [50, 100, 200];
    const ring = 0; // start at outer ring
    const fee = entryFees[ring];

    if (player.cash < fee) return { success: false };

    player.cash -= fee;
    player.innerCityRing = 1; // outer ring (1-based: 1=outer, 2=middle, 3=inner)
    player.innerCitySector = sector;
    player.position = GROUND_INNER_RING_SIZE + sector; // First tile of outer ring
    this.addLog(`${player.name} 进入内城`, 'info', `${player.name} entered inner city`);
    this.emitChange();
    return { success: true };
  }

  exitInnerCity(): { success: boolean } {
    const player = this.currentPlayer;
    player.innerCityRing = 0;
    player.innerCitySector = 0;
    player.groundRing = 'inner';
    // Exit to a random railway on the inner ground ring
    const railways = RAILWAYS.map(r => r.index);
    player.position = railways[Math.floor(Math.random() * railways.length)];
    this.addLog(`${player.name} 离开内城`, 'info', `${player.name} left inner city`);
    this.emitChange();
    return { success: true };
  }

  // ---- Ring Transfer (inner <-> outer ground ring) ----

  transferRing(toRing: 'inner' | 'outer'): { success: boolean; error?: string } {
    const player = this.currentPlayer;
    const tile = this.state.tiles[player.position];

    if (tile.type !== 'railway') return { success: false, error: '只能在铁路站换环' };
    if (player.innerCityRing !== 0) return { success: false, error: '不在街道环上' };
    if (player.groundRing === toRing) return { success: false, error: '已经在该环上' };
    if (this.state.ringTransferred) return { success: false, error: '本回合已换过环' };

    const fee = toRing === 'outer' ? 100 : 50;
    if (player.cash < fee) return { success: false, error: '现金不足' };

    player.cash -= fee;
    player.groundRing = toRing;

    // Map to corresponding railway on target ring
    const localIdx = (player.position >= OUTER_RING_OFFSET) ? player.position - OUTER_RING_OFFSET : player.position;
    player.position = toRing === 'outer' ? OUTER_RING_OFFSET + localIdx : localIdx;

    // Process landing on new tile (may enter buying / rentChoice)
    this.state.ringTransferred = true;
    this.addLog(`${player.name} 换乘到${toRing === 'outer' ? '外环' : '内环'} (费用 $${fee})`, 'info', `${player.name} transferred to ${toRing === 'outer' ? 'outer' : 'inner'} ring (fee $${fee})`);
    this.consumeLanding(this.engine.processLanding(player.position));
    return { success: true };
  }

  // ---- Bot AI ----

  private scheduleBotTurn(): void {
    const player = this.currentPlayer;

    // Clear any stale timer for this player
    const existing = this.botTimers.get(player.id);
    if (existing) clearTimeout(existing);

    const delay = player.isBot ? 1000 : 1500; // bots faster than auto-pilot

    const timer = setTimeout(() => {
      this.botTimers.delete(player.id);
      this.executeBotAction();
    }, delay);

    this.botTimers.set(player.id, timer);
  }

  private executeBotAction(): void {
    if (this.state.phase === 'ended' || this.state.phase === 'lobby') return;

    const player = this.currentPlayer;
    if (!player.isBot && !player.autoPilot) return;

    const decision = decideBotAction(this.state, player);

    switch (decision.action) {
      case 'roll':
        if (player.status === 'jailed') {
          // tryJailDice always leaves the phase at 'awaitEnd'
          this.tryJailDice();
        } else {
          this.rollDice();
        }
        this.scheduleBotAfterRoll();
        break;

      case 'pickCard':
        if (decision.choiceIndex !== undefined) {
          this.pickCard(decision.choiceIndex);
        }
        this.scheduleBotAfterRoll();
        break;

      case 'buy': {
        const res = this.buyProperty();
        // If the buy fails validation, still leave the buying phase so the bot can't stall
        if (!res.success && this.state.phase === 'buying') {
          this.passBuyProperty();
        }
        setTimeout(() => this.endTurn(), 1000);
        break;
      }

      case 'pass':
        if (this.state.phase === 'buying') {
          this.passBuyProperty();
        }
        // Execute stock action if present (the bot is the current player)
        if (decision.stockAction) {
          const { symbol, shares, action } = decision.stockAction;
          if (action === 'buy') {
            this.buyStock(this.currentPlayer.id, symbol, shares);
          } else if (action === 'sell') {
            this.sellStock(this.currentPlayer.id, symbol, shares);
          }
        }
        setTimeout(() => this.endTurn(), 1000);
        break;

      case 'build':
        if (decision.tileIndex !== undefined) {
          this.buildHouse(decision.tileIndex);
        }
        // Continue with more actions
        setTimeout(() => this.executeBotAction(), 1500);
        break;

      case 'sellHouse':
        if (decision.tileIndex !== undefined) {
          this.sellHouse(decision.tileIndex);
        }
        setTimeout(() => this.executeBotAction(), 1500);
        break;

      case 'endTurn':
        this.endTurn();
        break;

      case 'payJail':
        this.payJailFine();
        setTimeout(() => {
          this.rollDice();
          this.scheduleBotAfterRoll();
        }, 1000);
        break;

      case 'useCard':
        this.useJailCard();
        setTimeout(() => {
          this.rollDice();
          this.scheduleBotAfterRoll();
        }, 1000);
        break;

      case 'useHeldCard': {
        // Rob card used on the current player's turn (rent-choice is handled by executeRentChoiceAction)
        this.useHeldCard(player.id, decision.cardId!, decision.targetId);
        if (this.state.phase === 'rolling') {
          this.rollDice();
          this.scheduleBotAfterRoll();
        } else {
          setTimeout(() => this.endTurn(), 1000);
        }
        break;
      }

      case 'tryDoubles':
        this.tryJailDice();
        setTimeout(() => this.executeBotAction(), 1500);
        break;

      case 'spinWheel':
        this.spinWheel();
        setTimeout(() => this.endTurn(), 1500);
        break;

    }
  }

  /**
   * After a bot rolls, picks a card, or pays bail, schedule the next step based
   * on the resulting phase. Covers every phase so a bot can never stall.
   */
  private scheduleBotAfterRoll(): void {
    const phase = this.state.phase;
    if (phase === 'buying' || phase === 'debt' || phase === 'stock' || phase === 'wheel' || phase === 'cardChoice') {
      setTimeout(() => this.executeBotAction(), 2800);
    } else if (phase === 'awaitEnd') {
      setTimeout(() => this.endTurn(), 1500);
    } else if (phase === 'rolling') {
      // Extra roll (doubles) — re-roll
      setTimeout(() => this.executeBotAction(), 1500);
    } else if (phase === 'rentChoice') {
      // Decision may belong to a non-current player (double-rent owner)
      this.maybeScheduleRentChoiceBot();
    }
    // 'ended' → nothing needed
  }

  clearBotTimers(): void {
    for (const [id, timer] of this.botTimers) {
      clearTimeout(timer);
    }
    this.botTimers.clear();
  }

  // ---- Helpers ----

  private emitChange(): void {
    this.onStateChange(this.state.config.roomCode, this.state);
  }

  private addLog(message: string, type: 'info' | 'rent' | 'card' | 'buy' | 'sell' | 'dividend' | 'bankrupt' | 'victory' | 'jail' = 'info', messageEN?: string): void {
    this.state.logs.push({
      id: this.logIdCounter++, // monotonically increasing, never collides
      round: this.state.round,
      timestamp: Date.now(),
      message,
      messageEN: messageEN || message,
      type,
    });
    // Keep last 50
    if (this.state.logs.length > 50) {
      this.state.logs.shift();
    }
  }

  private emitEvent(event: GameEvent): void {
    this.state.gameEvent = event;
  }

  private rollWeather(): 'clear' | 'rain' | 'snow' | 'fog' | 'storm' {
    const r = Math.random();
    if (r < 0.55) return 'clear';
    if (r < 0.72) return 'rain';
    if (r < 0.85) return 'snow';
    if (r < 0.95) return 'fog';
    return 'storm';
  }
}
