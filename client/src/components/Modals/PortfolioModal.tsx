import { useGameStore } from '../../store/gameStore';
import { getPropertyDef, getRailwayDef, getUtilityDef, calcNetWorth } from '@monopoly/shared';
import { useI18n } from '../../i18n/useI18n';

export default function PortfolioModal() {
  const showPortfolio = useGameStore(s => s.showPortfolio);
  const gameState = useGameStore(s => s.gameState);
  const players = useGameStore(s => s.players);
  const playerId = useGameStore(s => s.playerId);
  const togglePortfolio = useGameStore(s => s.togglePortfolio);
  const { t, localName } = useI18n();

  if (!showPortfolio || !gameState) return null;

  const player = players.find(p => p.id === playerId);
  if (!player) return null;

  const stockPrices = new Map(gameState.stocks.map(s => [s.symbol, s.price]));
  const netWorth = calcNetWorth(player, stockPrices);

  return (
    <div className="modal-overlay" onClick={togglePortfolio}>
      <div className="modal portfolio-modal" onClick={e => e.stopPropagation()}>
        <h2>💼 {t('portfolio.title', { name: player.name })}</h2>
        <div className="portfolio-summary">
          <div className="portfolio-networth">
            {t('portfolio.netWorth')}: <strong>${netWorth.toLocaleString()}</strong>
          </div>
          <div className="portfolio-cash">
            {t('portfolio.cash')}: ${player.cash.toLocaleString()}
          </div>
        </div>

        {/* Properties */}
        <div className="portfolio-section">
          <h3>{t('portfolio.properties')} ({player.properties.length})</h3>
          <div className="portfolio-grid">
            {player.properties.map(idx => {
              const prop = getPropertyDef(idx);
              const rail = getRailwayDef(idx);
              const util = getUtilityDef(idx);
              const tile = gameState.tiles[idx];
              const houses = player.houses[idx] || 0;

              return (
                <div key={idx} className="portfolio-card">
                  <div className="portfolio-card-name">{localName(tile)}</div>
                  <div className="portfolio-card-houses">
                    {houses > 0 && '🏠'.repeat(Math.min(houses, 4))}
                    {houses >= 5 && '🏨'}
                  </div>
                  <div className="portfolio-card-value">
                    ${(prop?.price || rail?.price || util?.price || 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
            {player.properties.length === 0 && <p className="empty-msg">{t('portfolio.noProperties')}</p>}
          </div>
        </div>

        {/* Stocks */}
        <div className="portfolio-section">
          <h3>{t('portfolio.stocks')}</h3>
          {player.stocks.map(h => {
            const stock = gameState.stocks.find(s => s.symbol === h.symbol);
            const currentPrice = stock?.price || h.avgCost;
            const profit = (currentPrice - h.avgCost) * h.shares;
            const profitPct = h.avgCost > 0 ? ((currentPrice - h.avgCost) / h.avgCost * 100) : 0;

            return (
              <div key={h.symbol} className="portfolio-stock-row">
                <span>{h.symbol}</span>
                <span>{h.shares}{t('stock.shares')}</span>
                <span>{t('portfolio.avgPrice')} ${h.avgCost.toFixed(1)}</span>
                <span>{t('portfolio.currentPrice')} ${currentPrice}</span>
                <span className={profit >= 0 ? 'up' : 'down'}>
                  {profit >= 0 ? '+' : ''}${profit.toFixed(0)} ({profitPct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
          {player.stocks.length === 0 && <p className="empty-msg">{t('portfolio.noStocks')}</p>}
        </div>

        {/* Stats */}
        <div className="portfolio-section">
          <h3>{t('portfolio.stats')}</h3>
          <div className="portfolio-stats">
            <div>{t('portfolio.totalRentCollected')}: ${player.totalRentCollected.toLocaleString()}</div>
            <div>{t('portfolio.totalRentPaid')}: ${player.totalRentPaid.toLocaleString()}</div>
            <div>{t('portfolio.totalStockProfit')}: ${player.totalStockProfit.toLocaleString()}</div>
            <div>{t('portfolio.totalDividends')}: ${player.totalDividends.toLocaleString()}</div>
          </div>
        </div>

        <button className="btn btn-ghost" onClick={togglePortfolio}>{t('build.close')}</button>
      </div>
    </div>
  );
}
