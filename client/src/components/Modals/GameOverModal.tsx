import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getSocket } from '../../network/socket';
import { useI18n } from '../../i18n/useI18n';

export default function GameOverModal() {
  const phase = useGameStore(s => s.phase);
  const gameState = useGameStore(s => s.gameState);
  const showGameOverModal = useUIStore(s => s.showGameOverModal);
  const { t } = useI18n();
  const reset = useGameStore(s => s.reset);

  if (!showGameOverModal && phase !== 'ended') return null;
  if (!gameState) return null;

  const winner = gameState.players.find(p => p.id === gameState.winner);
  const winnerName = gameState.gameEvent?.kind === 'game_over'
    ? gameState.gameEvent.winnerName
    : winner?.name || 'Unknown';

  const activePlayers = gameState.players
    .filter(p => !p.isSpectator)
    .sort((a, b) => {
      const aNw = a.cash + a.properties.length * 100;
      const bNw = b.cash + b.properties.length * 100;
      return bNw - aNw;
    });

  const handleBackToLobby = () => {
    useUIStore.getState().closeModal('GameOver');
    getSocket()?.emit('leaveRoom');
    reset();
  };

  return (
    <div className="modal-overlay">
      <div className="modal gameover-modal">
        <div className="gameover-trophy">🏆</div>
        <h2>{t('gameOver.title')}</h2>
        <div className="gameover-winner">
          🎉 {winnerName}
        </div>

        <div className="gameover-stats">
          <div className="gameover-stat">
            <div className="gameover-stat-label">{t('gameOver.rounds')}</div>
            <div className="gameover-stat-value">{gameState.round}</div>
          </div>
          <div className="gameover-stat">
            <div className="gameover-stat-label">{t('gameOver.players')}</div>
            <div className="gameover-stat-value">{activePlayers.length}</div>
          </div>
          {winner && (
            <>
              <div className="gameover-stat">
                <div className="gameover-stat-label">{t('gameOver.finalCash')}</div>
                <div className="gameover-stat-value">${winner.cash.toLocaleString()}</div>
              </div>
              <div className="gameover-stat">
                <div className="gameover-stat-label">{t('gameOver.properties')}</div>
                <div className="gameover-stat-value">{winner.properties.length}</div>
              </div>
            </>
          )}
        </div>

        {activePlayers.length > 1 && (
          <div className="gameover-standings">
            <h3>{t('gameOver.standings')}</h3>
            {activePlayers.map((p, i) => (
              <div key={p.id} className="gameover-standing-row" style={{ borderLeftColor: p.color }}>
                <span className="gameover-rank">#{i + 1}</span>
                <span className="gameover-pname">
                  {p.name}
                  {p.status === 'bankrupt' && ' 💀'}
                </span>
                <span className="gameover-pcash">${p.cash.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary btn-lg" onClick={handleBackToLobby}>
            {t('gameOver.backToLobby')}
          </button>
        </div>
      </div>
    </div>
  );
}
