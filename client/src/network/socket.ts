// ============================================================
// Socket.IO Client
// ============================================================

import { io, Socket } from 'socket.io-client';
import type { GameState, Player, GameConfig } from '@monopoly/shared';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io('http://localhost:3001', {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  const gameStore = useGameStore.getState;
  const uiStore = useUIStore.getState;

  socket.on('connect', () => {
    console.log('[socket] connected:', socket?.id);
    useGameStore.setState({ connected: true });
  });

  socket.on('disconnect', () => {
    console.log('[socket] disconnected');
    useGameStore.setState({ connected: false });
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connection error:', err.message);
    useGameStore.setState({ connected: false });
  });

  // ---- Room Events ----

  socket.on('roomInfo', (info: { code: string; players: Player[]; config: GameConfig; playerId?: string }) => {
    console.log('[socket] roomInfo:', info);
    const updates: any = {
      roomCode: info.code,
      players: info.players,
    };
    // Store our player ID so we know when it's our turn
    if (info.playerId) {
      updates.playerId = info.playerId;
    }
    useGameStore.setState(updates);
  });

  socket.on('playerJoined', (player: Player) => {
    const store = useGameStore.getState();
    useGameStore.setState({ players: [...store.players, player] });
    uiStore().addToast(`${player.name} 加入了房间`);
  });

  socket.on('playerLeft', (playerId: string) => {
    const store = useGameStore.getState();
    const player = store.players.find(p => p.id === playerId);
    useGameStore.setState({ players: store.players.filter(p => p.id !== playerId) });
    if (player) {
      uiStore().addToast(`${player.name} 离开了房间`);
    }
  });

  socket.on('error', (message: string) => {
    uiStore().addToast(message, 'error');
  });

  // ---- Quiz Result (direct response, no need to detect state transition) ----

  socket.on('quizResult', (result: { correct: boolean; reward?: number; penalty?: number }) => {
    if (result.correct) {
      uiStore().setQuizResult('correct', result.reward);
    } else {
      uiStore().setQuizResult('wrong', result.penalty);
    }
  });

  // ---- Game State ----

  socket.on('gameState', (state: GameState) => {
    const prevState = useGameStore.getState().gameState;
    console.log('[socket] gameState:', state.phase, 'round:', state.round);
    useGameStore.getState().setGameState(state);

    // Mark dice rolled when new dice appear
    if (state.dice && !prevState?.dice) {
      uiStore().markDiceRolled();
    }

    // Detect quiz result from log (when quiz transitions active→inactive)
    if (prevState?.quizActive && !state.quizActive) {
      const lastLog = state.logs[state.logs.length - 1];
      if (lastLog && lastLog.message.includes('答对了')) {
        const match = lastLog.message.match(/\$(\d+)/);
        const amount = match ? Number(match[1]) : undefined;
        uiStore().setQuizResult('correct', amount);
      } else if (lastLog && lastLog.message.includes('答错了')) {
        const match = lastLog.message.match(/\$(\d+)/);
        const amount = match ? Number(match[1]) : undefined;
        uiStore().setQuizResult('wrong', amount);
      }
    }

    // Delay card/wheel/quiz until character finishes walking
    const DICE_ANIM_BASE = 2500;
    const walkSteps = state.dice ? state.dice.total : 0;
    const walkTimeMs = walkSteps > 0 ? (walkSteps / 5.5) * 1000 : 0;
    const totalDelay = Math.max(DICE_ANIM_BASE, walkTimeMs) + 1200;
    const timeSinceDice = Date.now() - uiStore().diceRolledAt;
    const delay = state.dice ? Math.max(0, totalDelay - timeSinceDice) : 0;

    const showDelayedEvents = () => {
      // Check for card drawn
      if (state.lastCardDrawn) {
        uiStore().setCardDrawn({
          type: state.lastCardDrawn.type,
          description: state.lastCardDrawn.card.description,
          descriptionCN: state.lastCardDrawn.card.descriptionCN,
        });
      }

      // Check for wheel result
      if (state.wheelResult !== null) {
        uiStore().setWheelResult(state.wheelResult);
      }

      // Check for quiz — read from the LIVE store state (not the closure-captured state)
      // to avoid re-showing an already-resolved quiz after a delay.
      const liveState = useGameStore.getState().gameState;
      if (liveState?.quizActive && liveState.quizQuestion) {
        uiStore().setQuizData({
          question: liveState.quizQuestion.question,
          options: liveState.quizQuestion.options,
          reward: '租金倍率奖励',
          penalty: '税费倍率惩罚',
        });
      }
    };

    if (delay > 0) {
      setTimeout(showDelayedEvents, delay);
    } else {
      showDelayedEvents();
    }

    // Check for game over
    if (state.phase === 'ended' && state.winner) {
      uiStore().openModal('GameOver');
    }

    // Trigger audio events based on log entries
    const lastLog = state.logs[state.logs.length - 1];
    if (lastLog) {
      triggerLogAudio(lastLog.message, lastLog.type);
    }
  });

  socket.on('stateDelta', (delta: any) => {
    const store = useGameStore.getState();
    if (store.gameState) {
      const merged = { ...store.gameState, ...delta };
      store.setGameState(merged);
    }
  });

  // ---- Chat ----

  socket.on('chatMessage', (data: { playerId: string; playerName: string; message: string }) => {
    useGameStore.getState().logs.push({
      id: Date.now(),
      round: 0,
      message: `[${data.playerName}]: ${data.message}`,
      type: 'info',
      timestamp: Date.now(),
    });
  });

  socket.on('pong', () => {
    // heartbeat
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ---- Audio trigger helper (placeholder) ----

function triggerLogAudio(_message: string, type: string): void {
  // Audio triggers will be wired in Phase 13
  // For now, this is a no-op
  if (typeof window !== 'undefined' && (window as any).__monopolyAudio) {
    (window as any).__monopolyAudio.onLogEvent(type);
  }
}
