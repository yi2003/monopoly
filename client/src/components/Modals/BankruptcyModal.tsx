import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../network/socket';

export default function BankruptcyModal() {
  const gameState = useGameStore(s => s.gameState);
  const phase = useGameStore(s => s.phase);

  if (!gameState || phase !== 'debt') return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.cash >= 0) return null;

  const handleDeclare = () => {
    getSocket()?.emit('declareBankruptcy');
  };

  return (
    <div className="modal-overlay">
      <div className="modal bankruptcy-modal">
        <h2>⚠️ 现金不足！</h2>
        <div className="bankruptcy-info">
          <p>{currentPlayer.name}，你的现金不足支付债务。</p>
          <p>当前现金: <strong className="negative">-${Math.abs(currentPlayer.cash).toLocaleString()}</strong></p>
          <p>你可以尝试出售房屋或股票来筹集资金。</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={handleDeclare}>
            💀 宣布破产
          </button>
          <p className="hint">提示: 使用右侧建造面板出售房屋</p>
        </div>
      </div>
    </div>
  );
}
