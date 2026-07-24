import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { SceneManager } from './SceneManager';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneManager | null>(null);
  const gameState = useGameStore(s => s.gameState);
  const cameraMode = useGameStore(s => s.cameraMode);
  const qualityMode = useGameStore(s => s.qualityMode);
  const roamFov = useGameStore(s => s.roamFov);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;

    const scene = new SceneManager(containerRef.current);
    let animId = 0;
    let cancelled = false;

    scene.init(qualityMode).then(() => {
      if (cancelled) {
        scene.dispose();
        return;
      }
      sceneRef.current = scene;

      // Animation loop — start after init completes
      const animate = () => {
        animId = requestAnimationFrame(animate);
        scene.render();
      };
      animate();
    });

    // Resize handler
    const handleResize = () => scene.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      } else {
        // init hasn't finished yet — dispose raw scene
        scene.dispose();
      }
    };
  }, []);

  // Sync game state to scene
  useEffect(() => {
    if (!sceneRef.current || !gameState) return;
    sceneRef.current.updateState(gameState);
  }, [gameState]);

  // Sync camera mode
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setCameraMode(cameraMode);
  }, [cameraMode]);

  // Sync quality mode
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setQualityMode(qualityMode);
  }, [qualityMode]);

  // Sync FOV for roam mode
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setRoamFov(roamFov);
  }, [roamFov]);

  return <div ref={containerRef} className="game-canvas" />;
}
