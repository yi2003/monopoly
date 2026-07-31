import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import type { GameEvent } from '@monopoly/shared';

function getFlashConfig(event: GameEvent, isPayer: boolean, isPayee: boolean) {
  switch (event.kind) {
    case 'rent':
      if (isPayer) return { color: '#E53935', cssClass: 'red-flash' };
      if (isPayee) return { color: '#4CAF50', cssClass: 'green-flash' };
      return { color: '#E53935', cssClass: 'red-flash' }; // spectator default
    case 'tax':
      return { color: '#FF5722', cssClass: 'orange-flash' };
    case 'go_salary':
    case 'dividend':
      return { color: '#4CAF50', cssClass: 'green-flash' };
    case 'card':
      return { color: '#8E24AA', cssClass: 'purple-flash' };
    case 'jail_in':
      return { color: '#9E9E9E', cssClass: 'gray-flash' };
    case 'jail_out':
      return { color: '#FFD700', cssClass: 'gold-flash' };
    case 'maintenance':
      return { color: '#FF9800', cssClass: 'orange-flash' };
    default:
      return null;
  }
}

export default function ScreenFlash() {
  const gameEvent = useUIStore(s => s.gameEvent);
  const showEventCard = useUIStore(s => s.showEventCard);
  const playerId = useGameStore(s => s.playerId);
  const [flashState, setFlashState] = useState<{ key: number; cssClass: string; color: string } | null>(null);

  useEffect(() => {
    if (showEventCard && gameEvent && gameEvent.kind !== 'game_over') {
      const isPayer = 'playerId' in gameEvent && gameEvent.playerId === playerId;
      const isPayee = 'targetId' in gameEvent && (gameEvent as any).targetId === playerId;
      const config = getFlashConfig(gameEvent, isPayer, isPayee);
      if (config) {
        setFlashState({ key: Date.now(), cssClass: config.cssClass, color: config.color });
        setTimeout(() => setFlashState(null), 800);
      }
    }
  }, [showEventCard, gameEvent, playerId]);

  if (!flashState) return null;

  return (
    <div
      key={flashState.key}
      className={`screen-flash ${flashState.cssClass}`}
      style={{ '--flash-color': flashState.color } as React.CSSProperties}
    />
  );
}
