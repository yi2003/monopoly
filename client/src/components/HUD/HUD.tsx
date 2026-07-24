import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import type { CameraMode, QualityMode } from '@monopoly/shared';
import { THEMES, DIFFICULTIES } from '@monopoly/shared';

const PHASE_LABELS: Record<string, string> = {
  rolling: '掷骰阶段',
  buying: '购买决策',
  stock: '股票交易',
  wheel: '大转盘',
  quiz: '知识问答',
  debt: '债务处理',
  awaitEnd: '回合结束',
  ended: '游戏结束',
};

const WEATHER_EMOJI: Record<string, string> = {
  clear: '☀️',
  rain: '🌧️',
  snow: '❄️',
  fog: '🌫️',
  storm: '⛈️',
};

const CAMERA_OPTIONS: { mode: CameraMode; label: string; emoji: string }[] = [
  { mode: 'orbit', label: '俯瞰', emoji: '🗺️' },
  { mode: 'thirdPerson', label: '第三人称', emoji: '👁' },
  { mode: 'roam', label: '漫游', emoji: '🚶' },
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

  const socket = getSocket();
  const isMyTurn = players[currentPlayerIndex]?.id === playerId;
  const currentPlayer = players[currentPlayerIndex];
  const weather = gameState?.weather || 'clear';

  // Force re-render when phase delay expires, since Date.now() doesn't trigger reactivity
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
          <span className="hud-round">第 {round} 回合</span>
          <span className="hud-weather">{WEATHER_EMOJI[weather] || '☀️'}</span>
        </div>

        <div className="hud-top-center">
          <span className="hud-phase">{PHASE_LABELS[phase] || phase}</span>
          {currentPlayer && (
            <span className="hud-turn" style={{ color: currentPlayer.color }}>
              🎯 {currentPlayer.name} 的回合
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
                title={opt.label}
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
            {qualityMode === 'balanced' ? '⚡均衡' : '🚀性能'}
          </button>

          {/* FOV Slider (only in roam mode) */}
          {cameraMode === 'roam' && (
            <div className="fov-slider" title={`视角: ${roamFov}°`}>
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
          <button className="btn btn-sm btn-outline" onClick={toggleStockPanel}>📈 股市</button>
          <button className="btn btn-sm btn-outline" onClick={togglePortfolio}>💼 资产</button>
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
              {p.properties.length}块地 | 🏠 {Object.values(p.houses).reduce((a, b) => a + b, 0)}栋
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
            🎲 掷骰子
          </button>
        )}

        {phase === 'buying' && isMyTurn && phaseReady && (
          <div className="action-buttons">
            <button className="btn btn-success btn-lg" onClick={() => handleBuyProperty(true)}>
              ✅ 购买
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => handleBuyProperty(false)}>
              ❌ 放弃
            </button>
          </div>
        )}

        {phase === 'buying' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">🚶 移动中...</div>
        )}

        {phase === 'wheel' && isMyTurn && phaseReady && (
          <button className="btn btn-primary btn-lg action-btn" onClick={handleSpinWheel}>
            🎡 转动转盘
          </button>
        )}

        {phase === 'wheel' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">🚶 移动中...</div>
        )}

        {phase === 'stock' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">🚶 移动中...</div>
        )}

        {phase === 'stock' && isMyTurn && phaseReady && (
          <div className="action-buttons">
            <button className="btn btn-sm btn-outline" onClick={toggleStockPanel}>
              📈 股票交易
            </button>
            <button className="btn btn-primary" onClick={handleEndTurn}>
              ⏭ 结束回合
            </button>
          </div>
        )}

        {phase === 'awaitEnd' && isMyTurn && phaseReady && (
          <div className="action-buttons">
            <button className="btn btn-sm btn-outline" onClick={toggleBuildPanel}>
              🏗️ 建造/出售
            </button>
            <button className="btn btn-primary" onClick={handleEndTurn}>
              ⏭ 结束回合
            </button>
          </div>
        )}

        {phase === 'awaitEnd' && isMyTurn && !phaseReady && (
          <div className="action-panel-waiting">🚶 移动中...</div>
        )}

        {phase === 'debt' && isMyTurn && (
          <div className="action-buttons">
            <button className="btn btn-sm btn-outline" onClick={toggleBuildPanel}>
              🏚️ 卖房筹资
            </button>
            <button className="btn btn-danger" onClick={handleDeclareBankruptcy}>
              💀 宣布破产
            </button>
          </div>
        )}

        {phase === 'ended' && (
          <button className="btn btn-primary btn-lg action-btn" onClick={() => useGameStore.getState().reset()}>
            🔄 返回大厅
          </button>
        )}
      </div>
    </div>
  );
}
