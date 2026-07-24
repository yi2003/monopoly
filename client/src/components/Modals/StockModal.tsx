import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';
import { useI18n } from '../../i18n/useI18n';

const PAGE_SIZE = 5;

export default function StockModal() {
  const showStockPanel = useGameStore(s => s.showStockPanel);
  const gameState = useGameStore(s => s.gameState);
  const players = useGameStore(s => s.players);
  const playerId = useGameStore(s => s.playerId);
  const toggleStockPanel = useGameStore(s => s.toggleStockPanel);
  const { t, localName } = useI18n();

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
        <h2>{t('stock.title')}</h2>

        <div className="stock-cash">
          {t('stock.cash')}: <strong>${player.cash.toLocaleString()}</strong>
          {' | '}
          {t('stock.holdings')}: {player.stocks.length > 0
            ? player.stocks.map(s => `${s.symbol}×${s.shares}`).join(', ')
            : t('stock.noHoldings')}
        </div>

        <div className="stock-list">
          <div className="stock-header">
            <span>{t('stock.symbol')}</span>
            <span>{t('stock.price')}</span>
            <span>{t('stock.change')}</span>
            <span>{t('stock.action')}</span>
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
                  <small>{localName(stock)}</small>
                  {myHolding && <span className="holding-badge">{t('stock.holdingFormat', { shares: myHolding.shares })}</span>}
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
                    {t('stock.trade')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>◀</button>
            <span>{page + 1}/{totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>▶</button>
          </div>
        )}

        {selectedStock && (
          <div className="trade-panel">
            <h4>{t('stock.tradeTitle')} {selectedStock.symbol} (${selectedStock.price})</h4>
            {holding && <p>{t('stock.holding')}: {holding.shares}{t('stock.shares')} · {t('stock.avgCost')}: ${holding.avgCost.toFixed(1)}</p>}
            <div className="trade-controls">
              <input
                type="number"
                min={1}
                max={999}
                value={shares}
                onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span>{t('stock.shares')}</span>
              <button className="btn btn-sm btn-success" onClick={() => handleBuy(selectedStock.symbol)}>
                {t('stock.buy')} (${(selectedStock.price * shares).toLocaleString()})
              </button>
              {holding && holding.shares > 0 && (
                <button className="btn btn-sm btn-danger" onClick={() => handleSell(selectedStock.symbol)}>
                  {t('stock.sell')}
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => setSelectedSymbol(null)}>
                {t('stock.cancel')}
              </button>
            </div>
            <small>{t('stock.fee')}</small>
          </div>
        )}

        <button className="btn btn-ghost" onClick={toggleStockPanel}>{t('build.close')}</button>
      </div>
    </div>
  );
}
