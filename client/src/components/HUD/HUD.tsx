import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import { getDice3DInstance } from '../../scene/Dice3D';
import type { CameraMode, QualityMode } from '@monopoly/shared';
import { THEMES, DIFFICULTIES } from '@monopoly/shared';
import { useI18n } from '../../i18n/useI18n';

// ---- Dice dot patterns (3×3 grid, same as 3D dice) ----
const DOT_GRID: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function DiceFace({ value, spinning }: { value: number; spinning: boolean }) {
  const dots = DOT_GRID[value] || [];
  return (
    <div className={`dice-cube ${spinning ? 'dice-cube-spinning' : ''}`}>
      <div className="dice-cube-inner">
        {[0, 1, 2].map(row => (
          <div key={row} className="dice-dot-row">
            {[0, 1, 2].map(col => {
              const active = dots.some(([r, c]) => r === row && c === col);
              return (
                <div key={col} className="dice-dot-cell">
                  {active && <div className="dice-dot" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const CAMERA_OPTIONS: { mode: CameraMode; key: string; emoji: string }[] = [
  { mode: 'orbit', key: 'camera.orbit', emoji: '🗺️' },
  { mode: 'thirdPerson', key: 'camera.thirdPerson', emoji: '👁' },
  { mode: 'roam', key: 'camera.roam', emoji: '🚶' },
];

export default function HUD() {
  const phase = useGameStore(s => s.phase);
  const round = useGameStore(s => s.round);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const players = useGameStore(s => s.players);
  const dice = useGameStore(s => s.dice);
  const diceRolled = useGameStore(s => s.diceRolled);
  const gameState = useGameStore(s => s.gameState);
  const cameraMode = useGameStore(s => s.cameraMode);
  const qualityMode = useGameStore(s => s.qualityMode);
  const roamFov = useGameStore(s => s.roamFov);
  const setCameraMode = useGameStore(s => s.setCameraMode);
  const setQualityMode = useGameStore(s => s.setQualityMode);
  const setRoamFov = useGameStore(s => s.setRoamFov);
  const toggleStockPanel = useGameStore(s => s.toggleStockPanel);
  const togglePortfolio = useGameStore(s => s.togglePortfolio);
  const toggleBuildPanel = useGameStore(s => s.toggleBuildPanel);
  const playerId = useGameStore(s => s.playerId);
  const isSpectator = useGameStore(s => s.isSpectator);
  const phaseDelayUntil = useGameStore(s => s.phaseDelayUntil);
  const diceSpinning = useGameStore(s => s.diceSpinning);

  const { t, lang, switchLang } = useI18n();
  const socket = getSocket();
  const myPlayer = gameState?.players.find(p => p.id === playerId);
  const isMyTurn = !isSpectator && !!(gameState && gameState.players[gameState.currentPlayerIndex]?.id === playerId);
  const currentPlayer = players[currentPlayerIndex];
  const weather = gameState?.weather || 'clear';

  // Force re-render when phase delay expires
  const [delayTick, setDelayTick] = useState(0);
  useEffect(() => {
    const remaining = phaseDelayUntil - Date.now();
    if (remaining > 0) {
      const timer = setTimeout(() => setDelayTick(n => n + 1), remaining + 50);
      return () => clearTimeout(timer);
    }
  }, [phaseDelayUntil, delayTick]);
  const phaseReady = Date.now() >= phaseDelayUntil;

  const handleRoll = () => socket?.emit('rollDice', { die1: Math.floor(Math.random() * 6) + 1, die2: 0 });
  const handleEndTurn = () => socket?.emit('endTurn');

  // Scrolling dice number animation
  const [scrollDie, setScrollDie] = useState(1);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (diceSpinning) {
      scrollTimerRef.current = setInterval(() => {
        setScrollDie(Math.floor(Math.random() * 6) + 1);
      }, 80);
    } else {
      if (scrollTimerRef.current) {
        clearInterval(scrollTimerRef.current);
        scrollTimerRef.current = undefined;
      }
    }
    return () => {
      if (scrollTimerRef.current) {
        clearInterval(scrollTimerRef.current);
      }
    };
  }, [diceSpinning]);

  const handleStopDice = useCallback(() => {
    const dice3D = getDice3DInstance();
    if (dice3D?.isSpinning()) {
      dice3D.manualStop(); // generates values → settles 3D dice → onManualStop sends to server
    } else {
      // Fallback if 3D dice isn't spinning
      const d1 = Math.floor(Math.random() * 6) + 1;
      socket?.emit('rollDice', { die1: d1, die2: 0 });
    }
  }, [socket]);
  const handleBuyProperty = (accept: boolean) => socket?.emit('buyProperty', accept);
  const handleSpinWheel = () => socket?.emit('spinWheel');
  const handleDeclareBankruptcy = () => socket?.emit('declareBankruptcy');
  const handleTransferRing = (toRing: 'inner' | 'outer') => socket?.emit('transferRing', toRing);

  // Check if current player is on a railway (for ring transfer)
  const myTile = myPlayer && gameState ? gameState.tiles[myPlayer.position] : null;
  const onRailway = myTile?.type === 'railway';
  const onInnerRing = myPlayer?.groundRing === 'inner';
  const ringTransferred = gameState?.ringTransferred ?? false;
  const canTransferRing = isMyTurn && onRailway && myPlayer?.innerCityRing === 0 && !ringTransferred;

  return (
    <div className="hud">
      {/* Top Bar */}
      <div className="hud-top-bar">
        <div className="hud-top-left">
          <span className="hud-room">🏠 {gameState?.config.roomCode || ''}</span>
          <span className="hud-round">{t('hud.round', { round })}</span>
          <span className="hud-weather">{t(`weather.${weather}` as any)}</span>
          {/* Language toggle */}
          <button className="btn btn-sm btn-ghost" onClick={switchLang} title={t('lang.label')}>
            {t('lang.switch')}
          </button>
        </div>

        <div className="hud-top-center">
          <span className="hud-phase">{t(`phase.${phase}` as any)}</span>
          {isSpectator && (
            <span className="hud-spectator-badge">{t('hud.spectatorMode')}</span>
          )}
          {currentPlayer && !isSpectator && (
            <span className="hud-turn" style={{ color: currentPlayer.color }}>
              🎯 {t('hud.turn', { name: currentPlayer.name })}
            </span>
          )}
        </div>

        <div className="hud-top-right">
          {/* Camera Mode */}
          <div className="camera-modes">
            {CAMERA_OPTIONS.map(opt => (
              <button
                key={opt.mode}
                className={`btn btn-icon ${cameraMode === opt.mode ? 'active' : ''}`}
                onClick={() => setCameraMode(opt.mode)}
                title={t(opt.key as any)}
              >
                {opt.emoji}
              </button>
            ))}
          </div>

          {/* Quality Toggle */}
          <button
            className={`btn btn-sm ${qualityMode === 'balanced' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setQualityMode(qualityMode === 'balanced' ? 'performance' : 'balanced')}
          >
            {qualityMode === 'balanced' ? t('quality.balanced') : t('quality.performance')}
          </button>

          {/* FOV Slider (only in roam mode) */}
          {cameraMode === 'roam' && (
            <div className="fov-slider" title={`FOV: ${roamFov}°`}>
              <span style={{ fontSize: '11px', color: '#aaa' }}>FOV</span>
              <input
                type="range"
                min={65}
                max={90}
                value={roamFov}
                onChange={e => setRoamFov(Number(e.target.value))}
                style={{ width: '60px', accentColor: '#FFD700' }}
              />
              <span style={{ fontSize: '11px', color: '#FFD700' }}>{roamFov}°</span>
            </div>
          )}

          {/* Stock & Portfolio */}
          <button className="btn btn-sm btn-outline" onClick={toggleStockPanel}>{t('hud.stockMarket')}</button>
          <button className="btn btn-sm btn-outline" onClick={togglePortfolio}>{t('hud.portfolio')}</button>
        </div>
      </div>

      {/* Player Cards */}
      <div className="hud-player-cards">
        {gameState?.players.filter(p => !p.isSpectator).map((p, i) => (
          <div
            key={p.id}
            className={`player-card ${p.status === 'bankrupt' ? 'bankrupt' : ''} ${i === currentPlayerIndex ? 'active' : ''}`}
            style={{ borderColor: p.color }}
          >
            <div className="player-card-color" style={{ backgroundColor: p.color }} />
            <div className="player-card-info">
              <span className="player-card-name">
                {p.name}
                {p.isBot && ' 🤖'}
                {p.autoPilot && ' 🔄'}
                {p.status === 'jailed' && ' 🔒'}
              </span>
              <span className="player-card-cash">${p.cash.toLocaleString()}</span>
            </div>
            <div className="player-card-props">
              {t('hud.player.props', { props: p.properties.length })} | 🏠 {t('hud.player.houses', { houses: Object.values(p.houses).reduce((a, b) => a + b, 0) })}
            </div>
          </div>
        ))}
      </div>

      {/* Stock Ticker */}
      {gameState && (
        <div className="stock-ticker">
          <div className="stock-ticker-scroll">
            {gameState.stocks.map(s => {
              const prev = s.priceHistory[s.priceHistory.length - 2] || s.price;
              const change = s.price - prev;
              const pct = prev > 0 ? ((change / prev) * 100).toFixed(1) : '0.0';
              const up = change >= 0;
              return (
                <span key={s.symbol} className={`ticker-item ${up ? 'up' : 'down'}`}>
                  {s.symbol} ${s.price} <small>{up ? '▲' : '▼'}{pct}%</small>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Dice Panel */}
      <div className="dice-panel">
        {diceSpinning ? (
          <div className="dice-display">
            <DiceFace value={scrollDie} spinning={true} />
          </div>
        ) : dice !== null ? (
          <div className="dice-display">
            <DiceFace value={dice.die1} spinning={false} />
          </div>
        ) : (
          <div className="dice-display">
            <div className="dice-face dice-empty">?</div>
          </div>
        )}
      </div>

      {/* Action Panel */}
      <div className="action-panel">
        {isSpectator && phase !== 'ended' && phase !== 'lobby' && (
          <div className="action-panel-waiting">{t('hud.spectating')}</div>
        )}

        {!isSpectator && phase === 'rolling' && isMyTurn && !diceRolled && (
          <div className="action-buttons">
            {diceSpinning ? (
              <button className="btn btn-danger btn-lg dice-stop-btn" onClick={handleStopDice}>
                ⏹ {t('hud.stopDice')}
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={handleRoll}>
                {t('hud.rollDice')}
              </button>
            )}
            <button className="btn btn-sm btn-outline" onClick={toggleBuildPanel}>
              {t('hud.buildSell')}
            </button>
            {canTransferRing && (
              <button className="btn btn-sm btn-outline" onClick={() => handleTransferRing(onInnerRing ? 'outer' : 'inner')}>
                {t('hud.transferRing')} ({onInnerRing ? t('hud.toOuter') : t('hud.toInner')})
              </button>
            )}
          </div>
        )}

        {phase === 'buying' && isMyTurn && phaseReady && (
          <div className="action-buttons">
            <button className="btn btn-success btn-lg" onClick={() => handleBuyProperty(true)}>
              {t('hud.buy')}
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => handleBuyProperty(false)}>
              {t('hud.pass')}
            </button>
          </div>
        )}

        {phase === 'buying' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">{t('phase.moving')}</div>
        )}

        {phase === 'wheel' && isMyTurn && phaseReady && (
          <button className="btn btn-primary btn-lg action-btn" onClick={handleSpinWheel}>
            {t('hud.spinWheel')}
          </button>
        )}

        {phase === 'wheel' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">{t('phase.moving')}</div>
        )}

        {phase === 'stock' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">{t('phase.moving')}</div>
        )}

        {phase === 'stock' && isMyTurn && phaseReady && (
          <div className="action-buttons">
            <button className="btn btn-sm btn-outline" onClick={toggleStockPanel}>
              {t('hud.stockTrade')}
            </button>
            <button className="btn btn-primary" onClick={handleEndTurn}>
              {t('hud.endTurn')}
            </button>
          </div>
        )}

        {phase === 'awaitEnd' && isMyTurn && phaseReady && (
          <div className="action-buttons">
            <button className="btn btn-sm btn-outline" onClick={toggleBuildPanel}>
              {t('hud.buildSell')}
            </button>
            {canTransferRing && (
              <button className="btn btn-sm btn-outline" onClick={() => handleTransferRing(onInnerRing ? 'outer' : 'inner')}>
                {t('hud.transferRing')} ({onInnerRing ? t('hud.toOuter') : t('hud.toInner')})
              </button>
            )}
            <button className="btn btn-primary" onClick={handleEndTurn}>
              {t('hud.endTurn')}
            </button>
          </div>
        )}

        {phase === 'awaitEnd' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">{t('phase.moving')}</div>
        )}

        {phase === 'debt' && isMyTurn && (
          <div className="action-buttons">
            <button className="btn btn-sm btn-outline" onClick={toggleBuildPanel}>
              {t('hud.sellHouse')}
            </button>
            <button className="btn btn-danger" onClick={handleDeclareBankruptcy}>
              {t('hud.declareBankrupt')}
            </button>
          </div>
        )}

        {phase === 'ended' && (
          <button className="btn btn-primary btn-lg action-btn" onClick={() => useGameStore.getState().reset()}>
            {t('hud.backToLobby')}
          </button>
        )}
      </div>
    </div>
  );
}
