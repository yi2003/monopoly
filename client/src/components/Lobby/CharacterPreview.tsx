// ============================================================
// CharacterPreview — 3D character preview for lobby avatar picker
// ============================================================

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { AvatarId } from '@monopoly/shared';
import { buildCharacterModel } from '../../scene/CharacterModel';

interface CharacterPreviewProps {
  avatar: AvatarId;
  color: string;
  size?: number;
}

export default function CharacterPreview({ avatar, color, size = 200 }: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; group: THREE.Group } | null>(null);

  // Initialize Three.js on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    camera.position.set(0, 0.55, 2.3);
    camera.lookAt(0, 0.5, 0);

    // Lighting
    const ambient = new THREE.AmbientLight('#ffffff', 0.7);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#ffffff', 0.9);
    key.position.set(2, 3, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#ffffff', 0.35);
    fill.position.set(-1, 0.5, 2);
    scene.add(fill);

    const group = new THREE.Group();
    scene.add(group);

    sceneRef.current = { renderer, scene, camera, group };

    // Animation loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      group.rotation.y += 0.008;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      // Dispose all scene objects
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [size]); // Only re-init if size changes

  // Update character model when avatar or color changes
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    // Remove old character
    while (state.group.children.length > 0) {
      const child = state.group.children[0];
      state.group.remove(child);
      if (child instanceof THREE.Group) {
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
    }

    // Build new character
    const charModel = buildCharacterModel(color, avatar);
    state.group.add(charModel);
  }, [avatar, color]);

  return (
    <canvas
      ref={canvasRef}
      className="avatar-preview-canvas"
      style={{ width: size, height: size }}
    />
  );
}
