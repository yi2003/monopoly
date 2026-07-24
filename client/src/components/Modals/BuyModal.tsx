import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import { getPropertyDef, getRailwayDef, getUtilityDef } from '@monopoly/shared';

export default function BuyModal() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const phase = useGameStore(s => s.phase);
  const players = useGameStore(s => s.players);
  const phaseDelayUntil = useGameStore(s => s.phaseDelayUntil);
  const [delayTick, setDelayTick] = useState(0);

  // Force re-render when phase delay expires
  useEffect(() => {
    const remaining = phaseDelayUntil - Date.now();
    if (remaining > 0) {
      const timer = setTimeout(() => setDelayTick(n => n + 1), remaining + 50);
      return () => clearTimeout(timer);
    }
  }, [phaseDelayUntil, delayTick]);

  if (!gameState || phase !== 'buying') return null;
  if (Date.now() < phaseDelayUntil) return null; // wait for character walk

  const currentPlayer = players[gameState.currentPlayerIndex];
  if (currentPlayer?.id !== playerId) return null;

  const tile = gameState.tiles[currentPlayer.position];
  const prop = getPropertyDef(currentPlayer.position);
  const rail = getRailwayDef(currentPlayer.position);
  const util = getUtilityDef(currentPlayer.position);

  let price = 0;
  let rentInfo: string[] = [];
  let typeLabel = '';

  if (prop) {
    price = prop.price;
    typeLabel = `地产 · ${prop.nameCN}`;
    rentInfo = prop.rent.map((r, i) =>
      i === 0 ? `空地: $${r}` :
      i === 5 ? `酒店: $${r}` :
      `${i}栋: $${r}`
    );
  } else if (rail) {
    price = rail.price;
    typeLabel = `铁路 · ${rail.nameCN}`;
    rentInfo = ['1条: $25', '2条: $50', '3条: $100', '4条: $200'];
  } else if (util) {
    price = util.price;
    typeLabel = `公共事业 · ${util.nameCN}`;
    rentInfo = ['1个: 骰点×4', '2个: 骰点×10'];
  }

  if (!price) return null;

  const handleBuy = () => getSocket()?.emit('buyProperty', true);
  const handlePass = () => getSocket()?.emit('buyProperty', false);

  return (
    <div className="modal-overlay">
      <div className="modal buy-modal">
        <h2>🏘️ 购买地产</h2>
        <div className="buy-property-info">
          <h3>{typeLabel}</h3>
          <div className="buy-price">
            价格: <strong>${price.toLocaleString()}</strong>
          </div>
          <div className="buy-rent-table">
            <h4>租金表</h4>
            {rentInfo.map((r, i) => (
              <div key={i} className="rent-row">{r}</div>
            ))}
          </div>
          {prop && (
            <div className="buy-house-cost">
              建房成本: ${prop.houseCost}/栋
            </div>
          )}
        </div>
        <div className="buy-cash">
          你的现金: <strong>${currentPlayer.cash.toLocaleString()}</strong>
        </div>
        <div className="modal-actions">
          <button className="btn btn-success btn-lg" onClick={handleBuy}>
            ✅ 购买 (${price.toLocaleString()})
          </button>
          <button className="btn btn-danger" onClick={handlePass}>
            ❌ 放弃
          </button>
        </div>
      </div>
    </div>
  );
}
