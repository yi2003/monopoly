import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';
import { getPropertyDef, canBuildHouse, canSellHouse, getSellHouseValue, ownsFullGroup } from '@monopoly/shared';
import { useI18n } from '../../i18n/useI18n';

export default function BuildModal() {
  const showBuildPanel = useGameStore(s => s.showBuildPanel);
  const gameState = useGameStore(s => s.gameState);
  const players = useGameStore(s => s.players);
  const playerId = useGameStore(s => s.playerId);
  const toggleBuildPanel = useGameStore(s => s.toggleBuildPanel);
  const { t, localName } = useI18n();

  const [mode, setMode] = useState<'build' | 'sell'>('build');

  if (!showBuildPanel || !gameState) return null;

  const player = players.find(p => p.id === playerId);
  if (!player) return null;

  const ownedProperties = player.properties
    .map(idx => getPropertyDef(idx))
    .filter(Boolean);

  if (ownedProperties.length === 0) {
    return (
      <div className="modal-overlay" onClick={toggleBuildPanel}>
        <div className="modal build-modal" onClick={e => e.stopPropagation()}>
          <h2>{t('build.title')}</h2>
          <p className="empty-msg">{t('build.noProperties')}</p>
          <button className="btn btn-ghost" onClick={toggleBuildPanel}>{t('build.close')}</button>
        </div>
      </div>
    );
  }

  const handleBuild = (tileIndex: number) => {
    getSocket()?.emit('buildHouse', tileIndex);
  };

  const handleSell = (tileIndex: number) => {
    getSocket()?.emit('sellHouse', tileIndex);
  };

  return (
    <div className="modal-overlay" onClick={toggleBuildPanel}>
      <div className="modal build-modal" onClick={e => e.stopPropagation()}>
        <h2>{t('build.title')}</h2>

        <div className="build-tabs">
          <button
            className={`btn btn-sm ${mode === 'build' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode('build')}
          >
            {t('build.tab.build')}
          </button>
          <button
            className={`btn btn-sm ${mode === 'sell' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode('sell')}
          >
            {t('build.tab.sell')}
          </button>
        </div>

        <div className="build-list">
          {ownedProperties.map((prop) => {
            if (!prop) return null;
            const houses = player.houses[prop.index] || 0;
            const canBuild = mode === 'build' && canBuildHouse(player, prop.index);
            const canSell = mode === 'sell' && canSellHouse(player, prop.index);
            const sellValue = getSellHouseValue(prop.index);
            const hasFullGroup = ownsFullGroup(player, prop.group);

            return (
              <div key={prop.index} className="build-item">
                <div className="build-item-info">
                  <span className="build-item-name">{localName(prop)}</span>
                  <span className="build-item-houses">
                    {'🏠'.repeat(Math.min(houses, 4))}
                    {houses >= 5 && '🏨'}
                    <small>{houses}/5</small>
                  </span>
                </div>
                <div className="build-item-actions">
                  {mode === 'build' && (
                    <button
                      className="btn btn-sm btn-success"
                      disabled={!canBuild}
                      onClick={() => handleBuild(prop.index)}
                      title={!hasFullGroup ? t('build.needFullGroup') : houses >= 5 ? t('build.atLimit') : `${t('build.buildCost')} $${prop.houseCost}`}
                    >
                      +1 (${prop.houseCost})
                    </button>
                  )}
                  {mode === 'sell' && (
                    <button
                      className="btn btn-sm btn-warning"
                      disabled={!canSell}
                      onClick={() => handleSell(prop.index)}
                    >
                      -1 (+${sellValue})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="build-cash">
          {t('build.cash')}: <strong>${player.cash.toLocaleString()}</strong>
        </div>

        <button className="btn btn-ghost" onClick={toggleBuildPanel}>{t('build.close')}</button>
      </div>
    </div>
  );
}
