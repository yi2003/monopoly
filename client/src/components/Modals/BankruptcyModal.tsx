import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';
import { useI18n } from '../../i18n/useI18n';

export default function BankruptcyModal() {
  const gameState = useGameStore(s => s.gameState);
  const phase = useGameStore(s => s.phase);
  const { t } = useI18n();

  if (!gameState || phase !== 'debt') return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.cash >= 0) return null;

  const handleDeclare = () => {
    getSocket()?.emit('declareBankruptcy');
  };

  return (
    <div className="modal-overlay">
      <div className="modal bankruptcy-modal">
        <h2>{t('bankrupt.title')}</h2>
        <div className="bankruptcy-info">
          <p>{t('bankrupt.desc', { name: currentPlayer.name })}</p>
          <p>{t('bankrupt.currentCash')}: <strong className="negative">-${Math.abs(currentPlayer.cash).toLocaleString()}</strong></p>
          <p>{t('bankrupt.hint')}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={handleDeclare}>
            {t('bankrupt.declare')}
          </button>
          <p className="hint">{t('bankrupt.tip')}</p>
        </div>
      </div>
    </div>
  );
}
