// ============================================================
// DicePreview — Shows a card per dice result (1-6) predicting the
// tile the current player will land on before they roll.
// ============================================================

import { useGameStore } from '../../store/gameStore';
import { useI18n } from '../../i18n/useI18n';
import { computeDicePreview } from '../../util/dicePreview';

export default function DicePreview() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const phase = useGameStore(s => s.phase);
  const diceRolled = useGameStore(s => s.diceRolled);
  const { t, lang } = useI18n();

  if (!gameState) return null;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  if (!isMyTurn || phase !== 'rolling' || diceRolled || player.isBot) return null;

  // In jail the dice don't move the piece — show a single notice instead.
  if (player.status === 'jailed') {
    return (
      <div className="dice-preview dice-preview-jailed">
        {t('dicePreview.jailed')}
      </div>
    );
  }

  const entries = computeDicePreview(player, gameState, lang);
  return (
    <div className="dice-preview" aria-label={t('dicePreview.title')}>
      {entries.map(e => (
        <div
          key={e.roll}
          className="dice-preview-card"
          style={{ borderTopColor: e.accent }}
          title={e.tileName}
        >
          <div className="dice-preview-roll">
            <span className="dice-preview-roll-num">{e.roll}</span>
            <span className="dice-preview-dot" style={{ background: e.accent }} />
          </div>
          <div className="dice-preview-icon">{e.icon}</div>
          <div className="dice-preview-name">{e.tileName}</div>
          <div className="dice-preview-action">
            {e.action}
            {e.passedGo && <span className="dice-preview-go">+GO</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
