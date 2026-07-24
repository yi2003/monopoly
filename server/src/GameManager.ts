// ============================================================
// GameManager — Authoritative game state & turn machine
// ============================================================

import type { GameState, GameConfig, Player, ThemeId, DifficultyId } from '@monopoly/shared';
import {
  createTiles, CHANCE_CARDS, COMMUNITY_CHEST_CARDS,
  SHANGHAI_EXTRA_CHANCE_CARDS, SHANGHAI_EXTRA_COMMUNITY_CHEST_CARDS,
  TOKYO_EXTRA_CHANCE_CARDS, TOKYO_EXTRA_COMMUNITY_CHEST_CARDS,
  QUIZ_QUESTIONS, QUIZ_TRIGGER_CHANCE, GO_SALARY,
  JAIL_FINE, CORNER_GO, CORNER_JAIL,
  PLAYER_COLORS,
} from '@monopoly/shared';
import { getEffectiveConfig, THEMES } from '@monopoly/shared';
import { rollDice, findNearestTile, moveToTile } from '@monopoly/shared';
import { shuffle } from './utils/shuffle';
import { generatePlayerId } from './utils/random';
import { RuleEngine } from './RuleEngine';
import { updateStockPrices, processDividends, executeBuyStock, executeSellStock } from './StockMarket';
import { initStocks } from '@monopoly/shared';
import { decideBotAction } from './BotBrain';

export class GameManager {
  state: GameState;
  private botTimers: Map<string, NodeJS.Timeout> = new Map();
  private onStateChange: (roomCode: string, state: GameState) => void;

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
      quizActive: false,
      quizQuestion: null,
      wheelResult: null,
      lastCardDrawn: null,
      createdAt: Date.now(),
    };
  }

  get engine(): RuleEngine {
    return new RuleEngine(this.state);
  }

  // ---- Player Management ----

  addPlayer(name: string, color?: string, isBot = false): Player {
    const player: Player = {
      id: isBot ? `bot_${generatePlayerId()}` : generatePlayerId(),
      name,
      color: color || PLAYER_COLORS[this.state.players.length % PLAYER_COLORS.length],
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
      consecutiveDoubles: 0,
      skipNextTurn: false,
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
      player.status = 'active';
    }

    // Shuffle turn order
    this.state.players = shuffle(this.state.players);

    this.state.phase = 'rolling';
    this.state.round = 1;
    this.state.currentPlayerIndex = 0;
    this.state.logs = [];
    this.state.dice = null;
    this.state.diceRolled = false;

    this.addLog('游戏开始！');
    this.addLog(`主题: ${THEMES[this.state.config.theme].nameCN} | 难度: ${eff.drainPct > 0 ? `${Math.round(eff.drainPct * 100)}%维护费` : '无维护费'}`);
    this.addLog(`轮到 ${this.currentPlayer.name}`);
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

  rollDice(): { dice: { die1: number; die2: number; total: number; isDoubles: boolean }; result: any } {
    if (this.state.phase !== 'rolling') {
      return { dice: { die1: 0, die2: 0, total: 0, isDoubles: false }, result: { error: '现在不能掷骰子' } };
    }

    const dice = rollDice();
    this.state.dice = dice;
    this.state.diceRolled = true;

    const result = this.engine.processDiceResult(dice);
    this.addLog(`${this.currentPlayer.name} 掷出 [${dice.die1}][${dice.die2}] = ${dice.total}`);

    if (result.passedGo) {
      this.addLog(`${this.currentPlayer.name} 经过起点，领取工资`, 'info');
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
        this.addLog(`${this.currentPlayer.name} 连续三次掷出对子，被送进监狱！`, 'jail');
        this.state.phase = 'awaitEnd';
      } else {
        this.addLog(`${this.currentPlayer.name} 掷出对子 (${dice.die1}+${dice.die2})，再掷一次！`, 'info');
        this.state.diceRolled = false; // allow re-roll
        this.emitChange();
        return { dice, result };
      }
    }

    // Process landing
    const landing = this.engine.processLanding(result.newPosition);

    if (landing.cardType) {
      this.drawCard(landing.cardType);
    }

    this.state.phase = landing.phase;

    // Check bankruptcy
    if (this.currentPlayer.cash < 0) {
      this.state.phase = 'debt';
    }

    this.emitChange();
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

    this.engine.executeBuildHouse(tileIndex);
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
        this.addLog(`${winner.name} 获胜！`, 'victory');
        this.emitChange();
        return;
      }
    }

    // Check for winner
    const winner = this.engine.checkWinner();
    if (winner) {
      this.state.winner = winner.id;
      this.state.phase = 'ended';
      this.addLog(`${winner.name} 获胜！`, 'victory');
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
          this.addLog(`${this.currentPlayer.name} 维护费: -$${drain}`, 'info');
        }
      }
    }

    // Update stock prices
    updateStockPrices(this.state);

    // Process dividends
    processDividends(this.state);

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

    // Only increment round when wrapping around to first player
    if (next <= this.state.currentPlayerIndex) {
      this.state.round++;
    }

    this.state.currentPlayerIndex = next;
    this.state.phase = 'rolling';
    this.state.dice = null;
    this.state.diceRolled = false;
    this.state.quizActive = false;
    this.state.quizQuestion = null;
    this.state.lastCardDrawn = null;

    // Check for quiz trigger at turn start
    if (QUIZ_TRIGGER_CHANCE > 0 && Math.random() < QUIZ_TRIGGER_CHANCE) {
      const questions = QUIZ_QUESTIONS;
      const q = questions[Math.floor(Math.random() * questions.length)];
      this.state.quizActive = true;
      this.state.quizQuestion = q;
      this.addLog(`知识问答！`, 'info');
    }

    // Weather change check
    this.state.weatherTimer--;
    if (this.state.weatherTimer <= 0) {
      this.state.weather = this.rollWeather();
      this.state.weatherTimer = 25 + Math.floor(Math.random() * 20);
    }

    // Day/night progression
    this.state.dayTime = (this.state.dayTime + 0.008) % 1;

    this.addLog(`轮到 ${this.currentPlayer.name}`);

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
    this.addLog(`${this.currentPlayer.name} 支付 $${JAIL_FINE} 出狱`);
    this.emitChange();
    return { success: true };
  }

  useJailCard(): { success: boolean } {
    if (this.currentPlayer.status !== 'jailed') return { success: false };
    if (this.currentPlayer.getOutOfJailCards <= 0) return { success: false };
    this.currentPlayer.getOutOfJailCards--;
    this.currentPlayer.jailTurns = 0;
    this.currentPlayer.status = 'active';
    this.addLog(`${this.currentPlayer.name} 使用出狱卡`);
    this.emitChange();
    return { success: true };
  }

  tryJailDice(): { success: boolean } {
    if (this.currentPlayer.status !== 'jailed') return { success: false };
    const dice = rollDice();
    this.state.dice = dice;
    if (dice.isDoubles) {
      this.currentPlayer.jailTurns = 0;
      this.currentPlayer.status = 'active';
      this.currentPlayer.consecutiveDoubles = 0;
      this.state.phase = 'rolling';
      this.addLog(`${this.currentPlayer.name} 掷出对子 [${dice.die1}][${dice.die2}]，出狱！`);
    } else {
      this.currentPlayer.jailTurns++;
      this.addLog(`${this.currentPlayer.name} 掷出 [${dice.die1}][${dice.die2}]，未能出狱`);
      if (this.currentPlayer.jailTurns >= 3) {
        this.currentPlayer.cash -= JAIL_FINE;
        this.currentPlayer.jailTurns = 0;
        this.currentPlayer.status = 'active';
        this.addLog(`${this.currentPlayer.name} 关押3回，强制付 $${JAIL_FINE} 出狱`);
      }
    }
    this.state.phase = 'awaitEnd';
    this.emitChange();
    return { success: true };
  }

  // ---- Cards ----

  drawCard(type: 'chance' | 'community_chest'): void {
    const deck = type === 'chance' ? this.state.chanceDeck : this.state.communityDeck;
    const cards = type === 'chance' ? this.state.cards.chance : this.state.cards.community_chest;

    if (deck.length === 0) {
      // Reshuffle
      const fresh = shuffle(cards.map((_, i) => i));
      if (type === 'chance') this.state.chanceDeck = fresh;
      else this.state.communityDeck = fresh;
      deck.length = 0;
      deck.push(...fresh);
    }

    const cardIdx = deck.pop()!;
    const card = cards[cardIdx];
    this.state.lastCardDrawn = { type, card };

    // Apply effect
    this.applyCardEffect(card);
    this.addLog(`${this.currentPlayer.name} 抽到: ${card.descriptionCN}`, 'card');
    this.emitChange();
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
        // Re-process landing
        const landing = this.engine.processLanding(position);
        this.state.phase = landing.phase === 'buying' ? 'buying' : 'awaitEnd';
        break;
      }

      case 'moveToNearest': {
        const nearest = findNearestTile(player.position, effect.tileType);
        player.position = nearest;
        const payMultiplier = effect.payMultiplier || 1;
        const landing = this.engine.processLanding(nearest, payMultiplier);
        this.state.phase = landing.phase === 'buying' ? 'buying' : 'awaitEnd';
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
        const ringStart = player.groundRing === 'inner' ? 0 : 72;
        const ringSize = 48;
        const localPos = player.position - ringStart;
        const newLocalPos = localPos - effect.spaces;
        player.position = newLocalPos < 0 ? ringStart + ringSize + newLocalPos : ringStart + newLocalPos;
        const landing = this.engine.processLanding(player.position);
        this.state.phase = landing.phase === 'buying' ? 'buying' : 'awaitEnd';
        break;
      }
    }
  }

  // ---- Quiz ----

  answerQuiz(optionIndex: number): { correct: boolean; reward?: number; penalty?: number } {
    if (!this.state.quizActive || !this.state.quizQuestion) {
      return { correct: false };
    }

    const question = this.state.quizQuestion;
    const correct = optionIndex === question.correctIndex;
    const eff = getEffectiveConfig(this.state.config.theme, this.state.config.difficulty);

    if (correct) {
      const reward = Math.round(200 * eff.rentMultiplier);
      this.currentPlayer.cash += reward;
      this.addLog(`${this.currentPlayer.name} 答对了！获得 $${reward}`, 'info');
      this.state.quizActive = false;
      this.emitChange();
      return { correct: true, reward };
    } else {
      const penalty = Math.round(100 * eff.taxMultiplier);
      this.currentPlayer.cash -= penalty;
      this.addLog(`${this.currentPlayer.name} 答错了！支付 $${penalty}`, 'info');
      this.state.quizActive = false;
      if (this.currentPlayer.cash < 0) this.state.phase = 'debt';
      this.emitChange();
      return { correct: false, penalty };
    }
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

    this.addLog(`${player.name} 转到了: ${sector.label}`, 'info');
    this.state.phase = 'awaitEnd';
    this.emitChange();
    return sectorIndex;
  }

  // ---- Stock Trading ----

  buyStock(symbol: string, shares: number): { success: boolean; error?: string } {
    const err = executeBuyStock(this.state, this.currentPlayer.id, symbol, shares);
    if (err) return { success: false, error: err };
    this.addLog(`${this.currentPlayer.name} 买入 ${symbol} ×${shares}`, 'buy');
    this.emitChange();
    return { success: true };
  }

  sellStock(symbol: string, shares: number): { success: boolean; error?: string } {
    const err = executeSellStock(this.state, this.currentPlayer.id, symbol, shares);
    if (err) return { success: false, error: err };
    this.addLog(`${this.currentPlayer.name} 卖出 ${symbol} ×${shares}`, 'sell');
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
    this.addLog(`${player.name} 乘坐高铁切换到 ${THEMES[targetTheme].nameCN}`, 'info');
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
    player.position = 48 + sector; // First tile of outer ring
    this.addLog(`${player.name} 进入内城`, 'info');
    this.emitChange();
    return { success: true };
  }

  exitInnerCity(): { success: boolean } {
    const player = this.currentPlayer;
    player.innerCityRing = 0;
    player.innerCitySector = 0;
    player.groundRing = 'inner';
    // Exit to nearest railway on inner ground ring
    const railways = [5, 11, 17, 29, 35, 41];
    player.position = railways[Math.floor(Math.random() * railways.length)];
    this.addLog(`${player.name} 离开内城`, 'info');
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

    const fee = toRing === 'outer' ? 100 : 50;
    if (player.cash < fee) return { success: false, error: '现金不足' };

    player.cash -= fee;
    player.groundRing = toRing;

    // Map to corresponding railway on target ring
    const localIdx = (player.position >= 72) ? player.position - 72 : player.position;
    player.position = toRing === 'outer' ? 72 + localIdx : localIdx;

    // Process landing on new tile
    const landing = this.engine.processLanding(player.position);
    this.state.phase = landing.phase === 'buying' ? 'buying' : 'awaitEnd';
    this.addLog(`${player.name} 换乘到${toRing === 'outer' ? '外环' : '内环'} (费用 $${fee})`, 'info');
    this.emitChange();
    return { success: true };
  }

  // ---- Bot AI ----

  private scheduleBotTurn(): void {
    const player = this.currentPlayer;
    const delay = player.isBot ? 1000 : 1500; // bots faster than auto-pilot

    const timer = setTimeout(() => {
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
          this.tryJailDice();
          // After jail dice, schedule follow-up
          if (this.state.phase === 'awaitEnd') {
            setTimeout(() => this.endTurn(), 1500);
          } else if (this.state.phase === 'rolling') {
            // Escaped jail with doubles, need to roll for movement
            setTimeout(() => this.executeBotAction(), 2000);
          }
        } else {
          this.rollDice();
        }
        // After rolling, schedule follow-up
        if (this.state.phase === 'buying' || this.state.phase === 'debt' || this.state.phase === 'stock' || this.state.phase === 'wheel' || this.state.phase === 'quiz') {
          setTimeout(() => this.executeBotAction(), 2800);
        } else if (this.state.phase === 'awaitEnd') {
          setTimeout(() => this.endTurn(), 1500);
        } else if (this.state.phase === 'rolling') {
          // Extra roll (doubles) — re-roll
          setTimeout(() => this.executeBotAction(), 1500);
        }
        break;

      case 'buy':
        this.buyProperty();
        setTimeout(() => this.endTurn(), 1000);
        break;

      case 'pass':
        if (this.state.phase === 'buying') {
          this.passBuyProperty();
        }
        // Execute stock action if present
        if (decision.stockAction) {
          const { symbol, shares, action } = decision.stockAction;
          if (action === 'buy') {
            this.buyStock(symbol, shares);
          } else if (action === 'sell') {
            this.sellStock(symbol, shares);
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
        setTimeout(() => this.rollDice(), 1000);
        break;

      case 'useCard':
        this.useJailCard();
        setTimeout(() => this.rollDice(), 1000);
        break;

      case 'tryDoubles':
        this.tryJailDice();
        setTimeout(() => this.executeBotAction(), 1500);
        break;
    }
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

  private addLog(message: string, type: 'info' | 'rent' | 'card' | 'buy' | 'sell' | 'dividend' | 'bankrupt' | 'victory' | 'jail' = 'info'): void {
    this.state.logs.push({
      id: this.state.logs.length,
      round: this.state.round,
      timestamp: Date.now(),
      message,
      type,
    });
    // Keep last 50
    if (this.state.logs.length > 50) {
      this.state.logs.shift();
    }
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
