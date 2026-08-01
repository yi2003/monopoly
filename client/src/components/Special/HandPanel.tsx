// ============================================================
// HandPanel — the current player's held action cards.
// Rob cards can be played actively (pick a target opponent);
// rent-free / double-rent cards are passive (auto-triggered at
// the right moment by the server's rentChoice prompt).
// ============================================================

import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n/useI18n';
import { getSocket } from '../../network/socket';

export default function HandPanel() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const showHandModal = useUIStore(s => s.showHandModal);
  const toggleHandModal = useUIStore(s => s.toggleHandModal);
  const { t, lang } = useI18n();
  const [robTargetFor, setRobTargetFor] = useState<number | null>(null);

  // Reset target picker when the panel is closed
  useEffect(() => {
    if (!showHandModal) setRobTargetFor(null);
  }, [showHandModal]);

  if (!showHandModal || !gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const allCards = [...gameState.cards.chance, ...gameState.cards.community_chest];
  const held = (myPlayer?.heldCards || [])
    .map(id => allCards.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const robCard = held.find(c => c.effect.kind === 'rob');
  const targets = gameState.players.filter(p => p.id !== playerId && p.status !== 'bankrupt' && !p.isSpectator);

  const handleRobTarget = (targetId: string) => {
    if (!robCard) return;
    getSocket()?.emit('useHeldCard', { cardId: robCard.id, targetId });
    toggleHandModal();
  };

  return (
    <div className="hand-overlay" onClick={toggleHandModal}>
      <div className="hand-panel" onClick={e => e.stopPropagation()}>
        <div className="hand-header">
          <span className="hand-title">{t('hand.title')}</span>
          <button className="btn btn-sm btn-ghost" onClick={toggleHandModal}>
            ✕ {t('hand.close')}
          </button>
        </div>
        {held.length === 0 ? (
          <div className="hand-empty">{t('hand.empty')}</div>
        ) : (
          <div className="hand-list">
            {held.map(card => {
              const name = lang === 'zh' ? card.descriptionCN : card.description;
              const isRob = card.effect.kind === 'rob';
              return (
                <div key={card.id} className="hand-card">
                  <div className="hand-card-name">{name}</div>
                  {isRob ? (
                    robTargetFor === card.id ? (
                      <div className="rob-targets">
                        <div className="rob-targets-title">{t('rob.chooseTarget')}</div>
                        {targets.length === 0 ? (
                          <div className="hand-empty">—</div>
                        ) : (
                          targets.map(p => (
                            <button
                              key={p.id}
                              className="btn btn-sm btn-outline rob-target"
                              onClick={() => handleRobTarget(p.id)}
                            >
                              <span>{p.name}</span>
                              <span className="rob-target-cash">${p.cash.toLocaleString()}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-primary hand-use" onClick={() => setRobTargetFor(card.id)}>
                        {t('hand.use')} · {t('rob.steal')}
                      </button>
                    )
                  ) : (
                    <div className="hand-passive">
                      <span className="hand-passive-tag">{t('hand.passive')}</span>
                      <span className="hand-passive-hint">{t('hand.passiveHint')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
