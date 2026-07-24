import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import { STOCK_TRADE_FEE, MIN_STOCK_FEE } from '@monopoly/shared';

const PAGE_SIZE = 5;

export default function StockModal() {
  const showStockPanel = useGameStore(s => s.showStockPanel);
  const gameState = useGameStore(s => s.gameState);
  const players = useGameStore(s => s.players);
  const playerId = useGameStore(s => s.playerId);
  const toggleStockPanel = useGameStore(s => s.toggleStockPanel);

  const [page, setPage] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [shares, setShares] = useState(1);

  if (!showStockPanel || !gameState) return null;

  const player = players.find(p => p.id === playerId);
  if (!player) return null;

  const totalPages = Math.ceil(gameState.stocks.length / PAGE_SIZE);
  const pageStocks = gameState.stocks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleBuy = (symbol: string) => {
    getSocket()?.emit('buyStock', { symbol, shares });
    setSelectedSymbol(null);
    setShares(1);
  };

  const handleSell = (symbol: string) => {
    const holding = player.stocks.find(s => s.symbol === symbol);
    if (!holding) return;
    getSocket()?.emit('sellStock', { symbol, shares: Math.min(shares, holding.shares) });
    setSelectedSymbol(null);
    setShares(1);
  };

  const selectedStock = selectedSymbol
    ? gameState.stocks.find(s => s.symbol === selectedSymbol)
    : null;

  const holding = selectedSymbol
    ? player.stocks.find(s => s.symbol === selectedSymbol)
    : null;

  return (
    <div className="modal-overlay" onClick={toggleStockPanel}>
      <div className="modal stock-modal" onClick={e => e.stopPropagation()}>
        <h2>📈 股票市场</h2>

        <div className="stock-cash">
          现金: <strong>${player.cash.toLocaleString()}</strong>
          {' | '}
          持仓: {player.stocks.length > 0
            ? player.stocks.map(s => `${s.symbol}×${s.shares}`).join(', ')
            : '无'}
        </div>

        <div className="stock-list">
          <div className="stock-header">
            <span>股票</span>
            <span>价格</span>
            <span>涨跌</span>
            <span>操作</span>
          </div>
          {pageStocks.map(stock => {
            const prev = stock.priceHistory[stock.priceHistory.length - 2] || stock.price;
            const change = stock.price - prev;
            const pct = prev > 0 ? ((change / prev) * 100).toFixed(1) : '0.0';
            const up = change >= 0;
            const myHolding = player.stocks.find(s => s.symbol === stock.symbol);

            return (
              <div key={stock.symbol} className="stock-row">
                <div className="stock-name">
                  <strong>{stock.symbol}</strong>
                  <small>{stock.nameCN}</small>
                  {myHolding && <span className="holding-badge">{myHolding.shares}股</span>}
                </div>
                <div className={`stock-price ${up ? 'up' : 'down'}`}>
                  ${stock.price}
                </div>
                <div className={`stock-change ${up ? 'up' : 'down'}`}>
                  {up ? '▲' : '▼'} {Math.abs(Number(pct))}%
                </div>
                <div className="stock-actions">
                  <button
                    className="btn btn-xs btn-primary"
                    onClick={() => setSelectedSymbol(stock.symbol)}
                  >
                    交易
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>◀</button>
            <span>{page + 1}/{totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>▶</button>
          </div>
        )}

        {/* Trade panel */}
        {selectedStock && (
          <div className="trade-panel">
            <h4>交易 {selectedStock.symbol} (${selectedStock.price})</h4>
            {holding && <p>持仓: {holding.shares}股 · 均价: ${holding.avgCost.toFixed(1)}</p>}
            <div className="trade-controls">
              <input
                type="number"
                min={1}
                max={999}
                value={shares}
                onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span>股</span>
              <button className="btn btn-sm btn-success" onClick={() => handleBuy(selectedStock.symbol)}>
                买入 (${(selectedStock.price * shares).toLocaleString()})
              </button>
              {holding && holding.shares > 0 && (
                <button className="btn btn-sm btn-danger" onClick={() => handleSell(selectedStock.symbol)}>
                  卖出
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => setSelectedSymbol(null)}>
                取消
              </button>
            </div>
            <small>手续费: 3% (最低$5)</small>
          </div>
        )}

        <button className="btn btn-ghost" onClick={toggleStockPanel}>关闭</button>
      </div>
    </div>
  );
}
