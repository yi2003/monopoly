import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';
import { THEMES, DIFFICULTIES, PLAYER_COLORS, PLAYER_COLOR_NAMES, MAX_PLAYERS } from '@monopoly/shared';
import type { ThemeId, DifficultyId } from '@monopoly/shared';
import { useI18n } from '../../i18n/useI18n';

const BOT_COLORS = ['#FB8C00', '#8E24AA', '#00ACC1', '#E91E63', '#FF6F00', '#5C6BC0'];

export default function Lobby() {
  const players = useGameStore(s => s.players);
  const connected = useGameStore(s => s.connected);
  const roomCode = useGameStore(s => s.roomCode);
  const { t, lang, switchLang, localName } = useI18n();

  const botNames = t('bot.names').split(',');

  const [screen, setScreen] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState(() => {
    const saved = localStorage.getItem('monopoly_playerName');
    return saved || '';
  });
  const [playerColor, setPlayerColor] = useState(PLAYER_COLORS[0]);
  const [theme, setTheme] = useState<ThemeId>('classic');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const socket = getSocket();

  const isHost = roomCode !== null && players.length > 0;
  const canStart = players.filter(p => !p.isSpectator).length >= 2;

  // Save name
  useEffect(() => {
    if (playerName) localStorage.setItem('monopoly_playerName', playerName);
  }, [playerName]);

  const handleCreate = () => {
    if (!playerName.trim()) { setError(t('lobby.nameRequired')); return; }
    if (playerName.length > 12) { setError(t('lobby.nameTooLong')); return; }
    setError('');
    socket?.emit('createRoom', { playerName: playerName.trim(), playerColor, theme, difficulty });
    setScreen('menu');
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError(t('lobby.nameRequired')); return; }
    if (!joinCode.trim() || joinCode.length !== 4) { setError(t('lobby.roomCodeInvalid')); return; }
    setError('');
    socket?.emit('joinRoom', { roomCode: joinCode.toUpperCase(), playerName: playerName.trim(), playerColor });
  };

  const handleStart = () => {
    socket?.emit('startGame');
  };

  const handleAddBot = () => {
    const botCount = players.filter(p => p.isBot).length;
    const name = botNames[botCount % botNames.length];
    const color = BOT_COLORS[botCount % BOT_COLORS.length];
    socket?.emit('addBot', { name, color });
  };

  const handleLeave = () => {
    socket?.emit('leaveRoom');
    useGameStore.getState().reset();
    setScreen('menu');
  };

  // Menu screen
  if (!isHost) {
    return (
      <div className="lobby">
        <div className="lobby-container">
          <h1 className="lobby-title">{t('app.title')}</h1>
          <p className="lobby-subtitle">{t('app.subtitle')}</p>

          {/* Language toggle */}
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-sm btn-ghost" onClick={switchLang}>
              🌐 {t('lang.switch')}
            </button>
          </div>

          {!connected && <div className="lobby-status connecting">{t('app.connecting')}</div>}

          {screen === 'menu' && (
            <div className="lobby-menu">
              <button className="btn btn-primary" onClick={() => setScreen('create')} disabled={!connected}>
                {t('lobby.createRoom')}
              </button>
              <button className="btn btn-secondary" onClick={() => setScreen('join')} disabled={!connected}>
                {t('lobby.joinRoom')}
              </button>
            </div>
          )}

          {screen === 'create' && (
            <div className="lobby-form">
              <h2>{t('lobby.createTitle')}</h2>
              <label>
                {t('lobby.yourName')}
                <input
                  type="text"
                  maxLength={12}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder={t('lobby.namePlaceholder')}
                  autoFocus
                />
              </label>

              <label>{t('lobby.color')}</label>
              <div className="color-picker">
                {PLAYER_COLORS.map((c, i) => (
                  <button
                    key={c}
                    className={`color-swatch ${playerColor === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setPlayerColor(c)}
                    title={PLAYER_COLOR_NAMES[i]}
                  />
                ))}
              </div>

              <label>{t('lobby.theme')}</label>
              <div className="option-row">
                {(Object.entries(THEMES) as [ThemeId, any][]).map(([id, themeObj]) => (
                  <button
                    key={id}
                    className={`btn btn-sm ${theme === id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setTheme(id)}
                  >
                    {localName(themeObj)}
                  </button>
                ))}
              </div>

              <label>{t('lobby.difficulty')}</label>
              <div className="option-row">
                {(Object.entries(DIFFICULTIES) as [DifficultyId, any][]).map(([id, d]) => (
                  <button
                    key={id}
                    className={`btn btn-sm ${difficulty === id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setDifficulty(id)}
                  >
                    {localName(d)}
                  </button>
                ))}
              </div>

              {error && <div className="error-msg">{error}</div>}

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleCreate}>{t('lobby.create')}</button>
                <button className="btn btn-ghost" onClick={() => setScreen('menu')}>{t('lobby.back')}</button>
              </div>
            </div>
          )}

          {screen === 'join' && (
            <div className="lobby-form">
              <h2>{t('lobby.joinTitle')}</h2>
              <label>
                {t('lobby.yourName')}
                <input
                  type="text"
                  maxLength={12}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder={t('lobby.namePlaceholder')}
                />
              </label>

              <label>{t('lobby.color')}</label>
              <div className="color-picker">
                {PLAYER_COLORS.map((c, i) => (
                  <button
                    key={c}
                    className={`color-swatch ${playerColor === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setPlayerColor(c)}
                    title={PLAYER_COLOR_NAMES[i]}
                  />
                ))}
              </div>

              <label>
                {t('lobby.roomCode')}
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('lobby.roomCodePlaceholder')}
                  className="room-code-input"
                />
              </label>

              {error && <div className="error-msg">{error}</div>}

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleJoin}>{t('lobby.join')}</button>
                <button className="btn btn-ghost" onClick={() => setScreen('menu')}>{t('lobby.back')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Room lobby (host view)
  const activePlayers = players.filter(p => !p.isSpectator);
  const spectators = players.filter(p => p.isSpectator);

  return (
    <div className="lobby">
      <div className="lobby-container room-lobby">
        <div className="room-header">
          <h1>{t('lobby.roomTitle')}: <span className="room-code">{roomCode}</span></h1>
          <div className="room-config">
            {localName(THEMES[theme])} · {localName(DIFFICULTIES[difficulty])}
          </div>
        </div>

        <div className="player-list">
          <h3>{t('lobby.players')} ({activePlayers.length}/{MAX_PLAYERS})</h3>
          {activePlayers.map((p, i) => (
            <div key={p.id} className="player-item">
              <span className="player-dot" style={{ backgroundColor: p.color }} />
              <span className="player-name">{p.name}</span>
              {p.isBot && <span className="player-tag bot">Bot</span>}
              {i === 0 && <span className="player-tag host">{t('lobby.host')}</span>}
            </div>
          ))}
          {spectators.map(p => (
            <div key={p.id} className="player-item spectator">
              <span className="player-dot" style={{ backgroundColor: p.color }} />
              <span className="player-name">{p.name}</span>
              <span className="player-tag spectator-tag">{t('lobby.spectator')}</span>
            </div>
          ))}
        </div>

        <div className="room-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={!canStart}
          >
            {canStart ? t('lobby.startGame') : t('lobby.waitingPlayers')}
          </button>
          <button className="btn btn-outline" onClick={handleAddBot} disabled={activePlayers.length >= MAX_PLAYERS}>
            {t('lobby.addBot')}
          </button>
          <button className="btn btn-ghost" onClick={handleLeave}>
            {t('lobby.leaveRoom')}
          </button>
        </div>

        <div className="share-section">
          <p>{t('lobby.shareRoom')}</p>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => navigator.clipboard?.writeText(roomCode || '')}
          >
            {t('lobby.copyRoomCode')}
          </button>
        </div>
      </div>
    </div>
  );
}
