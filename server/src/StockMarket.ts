// ============================================================
// StockMarket — Price fluctuations & dividends
// ============================================================

import type { Player } from '@monopoly/shared';
import { STOCKS, STOCK_TRADE_FEE, MIN_STOCK_FEE } from '@monopoly/shared';
import { getEffectiveConfig } from '@monopoly/shared';
import type { GameState } from '@monopoly/shared';

export function updateStockPrices(state: GameState): void {
  const eff = getEffectiveConfig(state.config.theme, state.config.difficulty);

  for (const stock of state.stocks) {
    // Geometric Brownian motion with mean reversion
    const sigma = stock.volatility + eff.stockVolatility * 0.5;
    const drift = (stock.drift - stock.price) * 0.1; // mean reversion
    const shock = (Math.random() - 0.5) * 2 * sigma * stock.price;
    const change = drift + shock * 0.3;

    let newPrice = stock.price + change;
    newPrice = Math.max(stock.initialPrice * 0.2, Math.min(stock.initialPrice * 3, newPrice));
    newPrice = Math.round(newPrice);

    stock.price = newPrice;
    stock.priceHistory.push(newPrice);
    if (stock.priceHistory.length > 20) {
      stock.priceHistory.shift();
    }
  }
}

export function processDividends(state: GameState): void {
  const config = state.config;
  // Probability varies by theme
  const dividendChance = config.theme === 'shanghai' ? 0.18 : 0.12;
  const dividendRate = config.theme === 'shanghai' ? 0.08 : 0.05;

  // Pick a random stock
  const eligibleStocks = state.stocks.filter(s =>
    state.players.some(p => p.stocks.some(h => h.symbol === s.symbol)),
  );

  if (eligibleStocks.length === 0) return;

  const stock = eligibleStocks[Math.floor(Math.random() * eligibleStocks.length)];

  // Award dividends to all holders
  for (const player of state.players) {
    if (player.status === 'bankrupt') continue;
    const holding = player.stocks.find(h => h.symbol === stock.symbol);
    if (holding) {
      const dividend = Math.round(stock.price * dividendRate * holding.shares);
      player.cash += dividend;
      player.totalDividends += dividend;
      state.logs.push({
        id: state.logs.length,
        round: state.round,
        timestamp: Date.now(),
        message: `${player.name} 获得 ${stock.nameCN} 分红 $${dividend} (${holding.shares}股)`,
        type: 'dividend',
      });
    }
  }
}

export function executeBuyStock(
  state: GameState,
  playerId: string,
  symbol: string,
  shares: number,
): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return '玩家不存在';

  const stock = state.stocks.find(s => s.symbol === symbol);
  if (!stock) return '股票不存在';

  const totalCost = stock.price * shares;
  const fee = Math.max(MIN_STOCK_FEE, Math.round(totalCost * STOCK_TRADE_FEE));
  const total = totalCost + fee;

  if (player.cash < total) return '现金不足';

  player.cash -= total;

  const existing = player.stocks.find(s => s.symbol === symbol);
  if (existing) {
    const totalCostBasis = existing.shares * existing.avgCost + totalCost;
    existing.shares += shares;
    existing.avgCost = Math.round(totalCostBasis / existing.shares * 100) / 100;
  } else {
    player.stocks.push({ symbol, shares, avgCost: stock.price });
  }

  state.trades.push({
    round: state.round,
    playerId,
    symbol,
    shares,
    price: stock.price,
    type: 'buy',
    fee,
  });

  return null;
}

export function executeSellStock(
  state: GameState,
  playerId: string,
  symbol: string,
  shares: number,
): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return '玩家不存在';

  const holding = player.stocks.find(s => s.symbol === symbol);
  if (!holding) return '未持有该股票';
  if (holding.shares < shares) return '持股不足';

  const stock = state.stocks.find(s => s.symbol === symbol);
  if (!stock) return '股票不存在';

  const totalRevenue = stock.price * shares;
  const fee = Math.max(MIN_STOCK_FEE, Math.round(totalRevenue * STOCK_TRADE_FEE));
  const net = totalRevenue - fee;

  holding.shares -= shares;
  if (holding.shares <= 0) {
    player.stocks = player.stocks.filter(s => s.symbol !== symbol);
  }

  const profit = (stock.price - holding.avgCost) * shares;
  player.totalStockProfit += profit;
  player.cash += net;

  state.trades.push({
    round: state.round,
    playerId,
    symbol,
    shares,
    price: stock.price,
    type: 'sell',
    fee,
  });

  return null;
}
