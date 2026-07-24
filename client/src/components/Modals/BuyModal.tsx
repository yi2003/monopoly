import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';
import { getPropertyDef, getRailwayDef, getUtilityDef } from '@monopoly/shared';
import { useI18n } from '../../i18n/useI18n';

export default function BuyModal() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const phase = useGameStore(s => s.phase);
  const players = useGameStore(s => s.players);
  const phaseDelayUntil = useGameStore(s => s.phaseDelayUntil);
  const { t, localName } = useI18n();
  const [delayTick, setDelayTick] = useState(0);

  useEffect(() => {
    const remaining = phaseDelayUntil - Date.now();
    if (remaining > 0) {
      const timer = setTimeout(() => setDelayTick(n => n + 1), remaining + 50);
      return () => clearTimeout(timer);
    }
  }, [phaseDelayUntil, delayTick]);

  if (!gameState || phase !== 'buying') return null;
  if (Date.now() < phaseDelayUntil) return null;

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
    typeLabel = `${t('buy.property')} · ${localName(prop)}`;
    rentInfo = prop.rent.map((r, i) =>
      i === 0 ? `${t('buy.rent.vacant')}: $${r}` :
      i === 5 ? `${t('buy.rent.hotel')}: $${r}` :
      `${t('buy.rent.houses', { n: i })}: $${r}`
    );
  } else if (rail) {
    price = rail.price;
    typeLabel = `${t('buy.railway')} · ${localName(rail)}`;
    rentInfo = [
      `${t('buy.rent.railway.1')}: $25`,
      `${t('buy.rent.railway.2')}: $50`,
      `${t('buy.rent.railway.3')}: $100`,
      `${t('buy.rent.railway.4')}: $200`,
    ];
  } else if (util) {
    price = util.price;
    typeLabel = `${t('buy.utility')} · ${localName(util)}`;
    rentInfo = [t('buy.rent.util.1'), t('buy.rent.util.2')];
  }

  if (!price) return null;

  const handleBuy = () => getSocket()?.emit('buyProperty', true);
  const handlePass = () => getSocket()?.emit('buyProperty', false);

  return (
    <div className="modal-overlay">
      <div className="modal buy-modal">
        <h2>{t('buy.title')}</h2>
        <div className="buy-property-info">
          <h3>{typeLabel}</h3>
          <div className="buy-price">
            {t('buy.price')}: <strong>${price.toLocaleString()}</strong>
          </div>
          <div className="buy-rent-table">
            <h4>{t('buy.rentTable')}</h4>
            {rentInfo.map((r, i) => (
              <div key={i} className="rent-row">{r}</div>
            ))}
          </div>
          {prop && (
            <div className="buy-house-cost">
              {t('buy.houseCost')}: ${prop.houseCost}/{t('buy.rent.hotel').replace(': $', '').toLowerCase()}
            </div>
          )}
        </div>
        <div className="buy-cash">
          {t('buy.yourCash')}: <strong>${currentPlayer.cash.toLocaleString()}</strong>
        </div>
        <div className="modal-actions">
          <button className="btn btn-success btn-lg" onClick={handleBuy}>
            {t('buy.confirm')} (${price.toLocaleString()})
          </button>
          <button className="btn btn-danger" onClick={handlePass}>
            {t('buy.passBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
