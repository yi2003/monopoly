import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import type { CameraMode, QualityMode } from '@monopoly/shared';
import { THEMES, DIFFICULTIES } from '@monopoly/shared';
import { useI18n } from '../../i18n/useI18n';

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
  const phaseDelayUntil = useGameStore(s => s.phaseDelayUntil);

  const { t, lang, switchLang } = useI18n();
  const socket = getSocket();
  const isMyTurn = players[currentPlayerIndex]?.id === playerId;
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

  const handleRoll = () => socket?.emit('rollDice');
  const handleEndTurn = () => socket?.emit('endTurn');
  const handleBuyProperty = (accept: boolean) => socket?.emit('buyProperty', accept);
  const handleSpinWheel = () => socket?.emit('spinWheel');
  const handleDeclareBankruptcy = () => socket?.emit('declareBankruptcy');

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
          {currentPlayer && (
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
        {players.filter(p => !p.isSpectator).map((p, i) => (
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
        {dice !== null ? (
          <div className="dice-display">
            <div className={`dice-face dice-${dice.die1}`}>{dice.die1}</div>
            <div className={`dice-face dice-${dice.die2}`}>{dice.die2}</div>
          </div>
        ) : (
          <div className="dice-display">
            <div className="dice-face dice-empty">?</div>
            <div className="dice-face dice-empty">?</div>
          </div>
        )}
      </div>

      {/* Action Panel */}
      <div className="action-panel">
        {phase === 'rolling' && isMyTurn && !diceRolled && (
          <button className="btn btn-primary btn-lg action-btn" onClick={handleRoll}>
            {t('hud.rollDice')}
          </button>
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
