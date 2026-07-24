import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { connectSocket } from './network/socket';
import Lobby from './components/Lobby/Lobby';
import HUD from './components/HUD/HUD';
import BuyModal from './components/Modals/BuyModal';
import BuildModal from './components/Modals/BuildModal';
import StockModal from './components/Modals/StockModal';
import PortfolioModal from './components/Modals/PortfolioModal';
import QuizModal from './components/Modals/QuizModal';
import BankruptcyModal from './components/Modals/BankruptcyModal';
import CardFlip from './components/Special/CardFlip';
import WheelSpinner from './components/Special/WheelSpinner';
import EventToast from './components/Special/EventToast';
import Toast from './components/Special/Toast';
import GameCanvas from './scene/GameCanvas';
import { useI18n } from './i18n/useI18n';

export default function App() {
  const phase = useGameStore(s => s.phase);
  const connected = useGameStore(s => s.connected);
  const { t } = useI18n();

  useEffect(() => {
    connectSocket();
  }, []);

  if (phase === 'lobby') {
    return (
      <div className="app">
        <Lobby />
      </div>
    );
  }

  return (
    <div className="app">
      <GameCanvas />
      <HUD />
      <BuyModal />
      <BuildModal />
      <StockModal />
      <PortfolioModal />
      <QuizModal />
      <BankruptcyModal />
      <CardFlip />
      <WheelSpinner />
      <EventToast />
      <Toast />
      {!connected && (
        <div className="connection-lost">
          {t('app.connectionLost')}
        </div>
      )}
    </div>
  );
}
