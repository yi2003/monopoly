import { useGameStore } from '../../store/gameStore';
import { getPropertyDef, getRailwayDef, getUtilityDef, calcNetWorth } from '@monopoly/shared';

export default function PortfolioModal() {
  const showPortfolio = useGameStore(s => s.showPortfolio);
  const gameState = useGameStore(s => s.gameState);
  const players = useGameStore(s => s.players);
  const playerId = useGameStore(s => s.playerId);
  const togglePortfolio = useGameStore(s => s.togglePortfolio);

  if (!showPortfolio || !gameState) return null;

  const player = players.find(p => p.id === playerId);
  if (!player) return null;

  const stockPrices = new Map(gameState.stocks.map(s => [s.symbol, s.price]));
  const netWorth = calcNetWorth(player, stockPrices);

  return (
    <div className="modal-overlay" onClick={togglePortfolio}>
      <div className="modal portfolio-modal" onClick={e => e.stopPropagation()}>
        <h2>💼 {player.name} 的资产组合</h2>
        <div className="portfolio-summary">
          <div className="portfolio-networth">
            净资产: <strong>${netWorth.toLocaleString()}</strong>
          </div>
          <div className="portfolio-cash">
            现金: ${player.cash.toLocaleString()}
          </div>
        </div>

        {/* Properties */}
        <div className="portfolio-section">
          <h3>🏘️ 地产 ({player.properties.length})</h3>
          <div className="portfolio-grid">
            {player.properties.map(idx => {
              const prop = getPropertyDef(idx);
              const rail = getRailwayDef(idx);
              const util = getUtilityDef(idx);
              const tile = gameState.tiles[idx];
              const houses = player.houses[idx] || 0;

              return (
                <div key={idx} className="portfolio-card">
                  <div className="portfolio-card-name">{tile.nameCN}</div>
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
            {player.properties.length === 0 && <p className="empty-msg">暂无地产</p>}
          </div>
        </div>

        {/* Stocks */}
        <div className="portfolio-section">
          <h3>📈 股票持仓</h3>
          {player.stocks.map(h => {
            const stock = gameState.stocks.find(s => s.symbol === h.symbol);
            const currentPrice = stock?.price || h.avgCost;
            const profit = (currentPrice - h.avgCost) * h.shares;
            const profitPct = h.avgCost > 0 ? ((currentPrice - h.avgCost) / h.avgCost * 100) : 0;

            return (
              <div key={h.symbol} className="portfolio-stock-row">
                <span>{h.symbol}</span>
                <span>{h.shares}股</span>
                <span>均价 ${h.avgCost.toFixed(1)}</span>
                <span>现价 ${currentPrice}</span>
                <span className={profit >= 0 ? 'up' : 'down'}>
                  {profit >= 0 ? '+' : ''}${profit.toFixed(0)} ({profitPct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
          {player.stocks.length === 0 && <p className="empty-msg">暂无持仓</p>}
        </div>

        {/* Stats */}
        <div className="portfolio-section">
          <h3>📊 统计</h3>
          <div className="portfolio-stats">
            <div>总收租: ${player.totalRentCollected.toLocaleString()}</div>
            <div>总付租: ${player.totalRentPaid.toLocaleString()}</div>
            <div>股票盈亏: ${player.totalStockProfit.toLocaleString()}</div>
            <div>累计分红: ${player.totalDividends.toLocaleString()}</div>
          </div>
        </div>

        <button className="btn btn-ghost" onClick={togglePortfolio}>关闭</button>
      </div>
    </div>
  );
}
