import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';
import { THEMES, DIFFICULTIES, PLAYER_COLORS, PLAYER_COLOR_NAMES, MAX_PLAYERS } from '@monopoly/shared';
import type { ThemeId, DifficultyId } from '@monopoly/shared';

const BOT_NAMES = ['小明', '小红', '小刚', '小丽', '阿福', '财神'];
const BOT_COLORS = ['#FB8C00', '#8E24AA', '#00ACC1', '#E91E63', '#FF6F00', '#5C6BC0'];

export default function Lobby() {
  const players = useGameStore(s => s.players);
  const connected = useGameStore(s => s.connected);
  const roomCode = useGameStore(s => s.roomCode);

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
    if (!playerName.trim()) { setError('请输入你的名字'); return; }
    if (playerName.length > 12) { setError('名字最多12个字符'); return; }
    setError('');
    socket?.emit('createRoom', { playerName: playerName.trim(), playerColor, theme, difficulty });
    setScreen('menu');
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('请输入你的名字'); return; }
    if (!joinCode.trim() || joinCode.length !== 4) { setError('请输入4位房间号'); return; }
    setError('');
    socket?.emit('joinRoom', { roomCode: joinCode.toUpperCase(), playerName: playerName.trim(), playerColor });
  };

  const handleStart = () => {
    socket?.emit('startGame');
  };

  const handleAddBot = () => {
    const botCount = players.filter(p => p.isBot).length;
    const name = BOT_NAMES[botCount % BOT_NAMES.length];
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
          <h1 className="lobby-title">🏠 家庭大富翁</h1>
          <p className="lobby-subtitle">3D Multiplayer Monopoly</p>

          {!connected && <div className="lobby-status connecting">正在连接服务器...</div>}

          {screen === 'menu' && (
            <div className="lobby-menu">
              <button className="btn btn-primary" onClick={() => setScreen('create')} disabled={!connected}>
                🎮 创建房间
              </button>
              <button className="btn btn-secondary" onClick={() => setScreen('join')} disabled={!connected}>
                🚪 加入房间
              </button>
            </div>
          )}

          {screen === 'create' && (
            <div className="lobby-form">
              <h2>创建房间</h2>
              <label>
                你的名字
                <input
                  type="text"
                  maxLength={12}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="输入名字（最多12字）"
                  autoFocus
                />
              </label>

              <label>颜色</label>
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

              <label>主题</label>
              <div className="option-row">
                {(Object.entries(THEMES) as [ThemeId, any][]).map(([id, t]) => (
                  <button
                    key={id}
                    className={`btn btn-sm ${theme === id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setTheme(id)}
                  >
                    {t.nameCN}
                  </button>
                ))}
              </div>

              <label>难度</label>
              <div className="option-row">
                {(Object.entries(DIFFICULTIES) as [DifficultyId, any][]).map(([id, d]) => (
                  <button
                    key={id}
                    className={`btn btn-sm ${difficulty === id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setDifficulty(id)}
                  >
                    {d.nameCN}
                  </button>
                ))}
              </div>

              {error && <div className="error-msg">{error}</div>}

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleCreate}>创建</button>
                <button className="btn btn-ghost" onClick={() => setScreen('menu')}>返回</button>
              </div>
            </div>
          )}

          {screen === 'join' && (
            <div className="lobby-form">
              <h2>加入房间</h2>
              <label>
                你的名字
                <input
                  type="text"
                  maxLength={12}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="输入名字"
                />
              </label>

              <label>颜色</label>
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
                房间号
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="输入4位房间号（如 A3F7）"
                  className="room-code-input"
                />
              </label>

              {error && <div className="error-msg">{error}</div>}

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleJoin}>加入</button>
                <button className="btn btn-ghost" onClick={() => setScreen('menu')}>返回</button>
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
          <h1>房间号: <span className="room-code">{roomCode}</span></h1>
          <div className="room-config">
            {THEMES[theme].nameCN} · {DIFFICULTIES[difficulty].nameCN}
          </div>
        </div>

        <div className="player-list">
          <h3>玩家 ({activePlayers.length}/{MAX_PLAYERS})</h3>
          {activePlayers.map((p, i) => (
            <div key={p.id} className="player-item">
              <span className="player-dot" style={{ backgroundColor: p.color }} />
              <span className="player-name">{p.name}</span>
              {p.isBot && <span className="player-tag bot">Bot</span>}
              {i === 0 && <span className="player-tag host">房主</span>}
            </div>
          ))}
          {spectators.map(p => (
            <div key={p.id} className="player-item spectator">
              <span className="player-dot" style={{ backgroundColor: p.color }} />
              <span className="player-name">{p.name}</span>
              <span className="player-tag spectator-tag">旁观</span>
            </div>
          ))}
        </div>

        <div className="room-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={!canStart}
          >
            {canStart ? '🎲 开始游戏' : `等待更多玩家 (至少2人)`}
          </button>
          <button className="btn btn-outline" onClick={handleAddBot} disabled={activePlayers.length >= MAX_PLAYERS}>
            🤖 添加Bot
          </button>
          <button className="btn btn-ghost" onClick={handleLeave}>
            离开房间
          </button>
        </div>

        <div className="share-section">
          <p>分享房间号给朋友：</p>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => navigator.clipboard?.writeText(roomCode || '')}
          >
            📋 复制房间号
          </button>
        </div>
      </div>
    </div>
  );
}
