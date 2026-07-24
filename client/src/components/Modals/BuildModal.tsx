import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import { getPropertyDef, canBuildHouse, canSellHouse, getSellHouseValue, ownsFullGroup } from '@monopoly/shared';

export default function BuildModal() {
  const showBuildPanel = useGameStore(s => s.showBuildPanel);
  const gameState = useGameStore(s => s.gameState);
  const players = useGameStore(s => s.players);
  const playerId = useGameStore(s => s.playerId);
  const toggleBuildPanel = useGameStore(s => s.toggleBuildPanel);

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
          <h2>🏗️ 建造/出售</h2>
          <p className="empty-msg">你还没有任何地产</p>
          <button className="btn btn-ghost" onClick={toggleBuildPanel}>关闭</button>
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
        <h2>🏗️ 地产管理</h2>

        <div className="build-tabs">
          <button
            className={`btn btn-sm ${mode === 'build' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode('build')}
          >
            建造
          </button>
          <button
            className={`btn btn-sm ${mode === 'sell' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode('sell')}
          >
            出售
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
                  <span className="build-item-name">{prop.nameCN}</span>
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
                      title={!hasFullGroup ? '需要拥有整组颜色' : houses >= 5 ? '已达上限' : `建房 $${prop.houseCost}`}
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
          现金: <strong>${player.cash.toLocaleString()}</strong>
        </div>

        <button className="btn btn-ghost" onClick={toggleBuildPanel}>关闭</button>
      </div>
    </div>
  );
}
