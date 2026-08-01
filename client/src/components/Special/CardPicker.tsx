// ============================================================
// CardPicker — face-down Chance/Community Chest card choice
// When a player lands on a card tile, the server offers 4 face-down
// cards; the current player picks one blind, then the chosen card is
// revealed by the existing CardFlip/EventCard flow.
// ============================================================

import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useI18n } from '../../i18n/useI18n';
import { getSocket } from '../../network/socket';

export default function CardPicker() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const isSpectator = useGameStore(s => s.isSpectator);
  const phaseDelayUntil = useGameStore(s => s.phaseDelayUntil);
  const { t } = useI18n();

  const [now, setNow] = useState(Date.now());

  // Re-render once the walk-animation delay elapses so the fan becomes clickable
  useEffect(() => {
    if (gameState?.phase !== 'cardChoice' || !gameState.cardChoice) return;
    const delay = phaseDelayUntil - Date.now();
    if (delay <= 0) { setNow(Date.now()); return; }
    const timer = setTimeout(() => setNow(Date.now()), delay + 50);
    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.cardChoice, phaseDelayUntil]);

  if (!gameState || gameState.phase !== 'cardChoice' || !gameState.cardChoice) return null;

  const choice = gameState.cardChoice;
  const count = choice.options.length;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = !isSpectator && !!currentPlayer && currentPlayer.id === playerId;
  const phaseReady = now >= phaseDelayUntil;
  const canPick = isMyTurn && phaseReady;
  const isChance = choice.type === 'chance';

  const handlePick = (index: number) => {
    if (!canPick) return;
    getSocket()?.emit('pickCard', { choiceIndex: index });
  };

  return (
    <div className={`card-choice-overlay ${isChance ? 'chance' : 'community'}`}>
      <div className="card-choice-heading">
        {isMyTurn
          ? (canPick ? t('card.pickTitle') : t('card.pickWait'))
          : t('card.pickWaitingFor', { name: currentPlayer?.name ?? '' })}
      </div>
      <div className="card-choice-fan">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            className={`card-choice-card ${isChance ? 'chance' : 'community'} ${canPick ? 'pickable' : ''}`}
            onClick={() => handlePick(i)}
            disabled={!canPick}
            style={{ '--fan-index': i } as React.CSSProperties}
          >
            <div className="card-choice-symbol">?</div>
            <div className="card-choice-label">
              {isChance ? t('card.chance') : t('card.community')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
