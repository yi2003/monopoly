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

export default function App() {
  const phase = useGameStore(s => s.phase);
  const connected = useGameStore(s => s.connected);

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
      {/* 3D Canvas fills the background */}
      <GameCanvas />

      {/* HUD Overlay */}
      <HUD />

      {/* Modals */}
      <BuyModal />
      <BuildModal />
      <StockModal />
      <PortfolioModal />
      <QuizModal />
      <BankruptcyModal />

      {/* Special UI */}
      <CardFlip />
      <WheelSpinner />
      <EventToast />
      <Toast />

      {/* Connection indicator */}
      {!connected && (
        <div className="connection-lost">
          ⚠ 连接已断开，正在重连...
        </div>
      )}
    </div>
  );
}
