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

const TARGET_CARD_KINDS = ['rob', 'skipTurn', 'stealProperty', 'swapPositions'];
const ACTIVE_NO_TARGET_KINDS = ['dismissGod', 'summonGod', 'buildFree'];

export default function HandPanel() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);
  const showHandModal = useUIStore(s => s.showHandModal);
  const toggleHandModal = useUIStore(s => s.toggleHandModal);
  const { t, lang } = useI18n();
  const [targetFor, setTargetFor] = useState<number | null>(null);

  const targetTitle = (kind: string): string => {
    switch (kind) {
      case 'rob': return t('rob.chooseTarget');
      case 'skipTurn': return t('card.skipTurnTarget');
      case 'stealProperty': return t('card.stealTarget');
      case 'swapPositions': return t('card.swapTarget');
      default: return t('rob.chooseTarget');
    }
  };

  const actionLabel = (kind: string): string => {
    switch (kind) {
      case 'rob': return t('rob.steal');
      case 'skipTurn': return t('card.skipTurnUse');
      case 'stealProperty': return t('card.stealUse');
      case 'swapPositions': return t('card.swapUse');
      case 'dismissGod': return t('hand.dismiss');
      case 'summonGod': return t('hand.summon');
      case 'buildFree': return t('card.buildFreeUse');
      default: return t('hand.use');
    }
  };

  // Reset target picker when the panel is closed
  useEffect(() => {
    if (!showHandModal) setTargetFor(null);
  }, [showHandModal]);

  if (!showHandModal || !gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const allCards = [...gameState.cards.chance, ...gameState.cards.community_chest];
  const held = (myPlayer?.heldCards || [])
    .map(id => allCards.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const targets = gameState.players.filter(p => p.id !== playerId && p.status !== 'bankrupt' && !p.isSpectator);

  const handleTargetPick = (targetId: string) => {
    if (targetFor === null) return;
    getSocket()?.emit('useHeldCard', { cardId: targetFor, targetId });
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
              const isTarget = TARGET_CARD_KINDS.includes(card.effect.kind);
              const isActiveNoTarget = ACTIVE_NO_TARGET_KINDS.includes(card.effect.kind);
              return (
                <div key={card.id} className="hand-card">
                  <div className="hand-card-name">{name}</div>
                  {isTarget ? (
                    targetFor === card.id ? (
                      <div className="rob-targets">
                        <div className="rob-targets-title">{targetTitle(card.effect.kind)}</div>
                        {targets.length === 0 ? (
                          <div className="hand-empty">—</div>
                        ) : (
                          targets.map(p => (
                            <button
                              key={p.id}
                              className="btn btn-sm btn-outline rob-target"
                              onClick={() => handleTargetPick(p.id)}
                            >
                              <span>{p.name}</span>
                              <span className="rob-target-cash">${p.cash.toLocaleString()}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-primary hand-use" onClick={() => setTargetFor(card.id)}>
                        {t('hand.use')} · {actionLabel(card.effect.kind)}
                      </button>
                    )
                  ) : isActiveNoTarget ? (
                    <button
                      className="btn btn-sm btn-primary hand-use"
                      onClick={() => {
                        getSocket()?.emit('useHeldCard', { cardId: card.id });
                        toggleHandModal();
                      }}
                    >
                      {actionLabel(card.effect.kind)}
                    </button>
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
