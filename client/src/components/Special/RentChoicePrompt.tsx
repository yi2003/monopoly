// ============================================================
// RentChoicePrompt — pending rent decision for held action cards
// Rendered for the prompt's ACTOR (the one who must decide).
// NOT gated on isMyTurn: the double-rent card asks the property
// OWNER to decide during another player's turn.
// ============================================================

import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useI18n } from '../../i18n/useI18n';
import { getSocket } from '../../network/socket';

export default function RentChoicePrompt() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const isSpectator = useGameStore(s => s.isSpectator);
  const phaseDelayUntil = useGameStore(s => s.phaseDelayUntil);
  const { t, lang } = useI18n();

  const [now, setNow] = useState(Date.now());

  // Re-render once the walk-animation delay elapses so the buttons become clickable
  useEffect(() => {
    if (gameState?.phase !== 'rentChoice' || !gameState.actionCardPrompt) return;
    const delay = phaseDelayUntil - Date.now();
    if (delay <= 0) { setNow(Date.now()); return; }
    const timer = setTimeout(() => setNow(Date.now()), delay + 50);
    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.actionCardPrompt, phaseDelayUntil]);

  if (!gameState || gameState.phase !== 'rentChoice' || !gameState.actionCardPrompt) return null;
  const prompt = gameState.actionCardPrompt;
  if (prompt.actorId !== playerId || isSpectator) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const payer = gameState.players.find(p => p.id === prompt.payerId);
  const tileName = lang === 'zh' ? prompt.tileNameCN : prompt.tileName;

  // Find the held card that matches this prompt's kind
  const allCards = [...gameState.cards.chance, ...gameState.cards.community_chest];
  const matchCard = (myPlayer?.heldCards || [])
    .map(id => allCards.find(c => c.id === id))
    .find(c => c && c.effect.kind === prompt.kind);

  const phaseReady = now >= phaseDelayUntil;

  const handleUseCard = () => {
    if (!matchCard || !phaseReady) return;
    getSocket()?.emit('useHeldCard', { cardId: matchCard.id });
  };
  const handlePayNow = () => {
    if (!phaseReady) return;
    getSocket()?.emit('payRentNow');
  };

  const desc = prompt.kind === 'rentFree'
    ? t('rentChoice.rentFree.desc', { tile: tileName, rent: prompt.baseRent })
    : t('rentChoice.doubleRent.desc', { payer: payer?.name || '', tile: tileName, rent: prompt.baseRent });

  return (
    <div className="rent-choice-overlay">
      <div className="rent-choice-card">
        <div className="rent-choice-title">{t('rentChoice.title')}</div>
        <div className="rent-choice-desc">{desc}</div>
        {prompt.kind === 'doubleRent' && (
          <div className="rent-choice-x2">×2</div>
        )}
        <div className="rent-choice-buttons">
          <button
            className="btn btn-primary"
            disabled={!matchCard || !phaseReady}
            onClick={handleUseCard}
          >
            {t('rentChoice.useCard')}
          </button>
          <button className="btn btn-outline" disabled={!phaseReady} onClick={handlePayNow}>
            {t('rentChoice.payNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
