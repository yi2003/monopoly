// ============================================================
// Effects — Coin particles, glow pulses, victory confetti
// ============================================================

import * as THREE from 'three';
import type { GameState } from '@monopoly/shared';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Effects {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private particles: Particle[] = [];
  private glowRings: Map<string, { mesh: THREE.Mesh; life: number }> = new Map();
  private lastLogCount = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  updateState(state: GameState): void {
    // Detect new log entries that trigger effects
    const newLogs = state.logs.slice(this.lastLogCount);
    this.lastLogCount = state.logs.length;

    for (const log of newLogs) {
      if (log.type === 'rent') this.spawnCoins(new THREE.Vector3(0, 2, 0), '#FFD700', 8);
      if (log.type === 'buy') this.spawnGlowPulse(new THREE.Vector3(0, 0, 0), '#4CAF50');
      if (log.type === 'bankrupt') this.spawnCoins(new THREE.Vector3(0, 2, 0), '#E53935', 12);
      if (log.type === 'victory') this.spawnConfetti(new THREE.Vector3(0, 8, 0));
      if (log.type === 'jail') this.spawnGlowPulse(new THREE.Vector3(0, 0, 0), '#9E9E9E');
    }
  }

  private spawnCoins(position: THREE.Vector3, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.8 });
      const coin = new THREE.Mesh(geo, mat);
      coin.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 4,
      );

      this.group.add(coin);
      this.particles.push({
        mesh: coin,
        velocity: vel,
        life: 1.5 + Math.random() * 0.5,
        maxLife: 2.0,
      });
    }
  }

  private spawnConfetti(position: THREE.Vector3): void {
    const colors = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#FFD700', '#00ACC1', '#EC407A'];
    for (let i = 0; i < 60; i++) {
      const geo = new THREE.BoxGeometry(0.15, 0.15, 0.02);
      const mat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.5 });
      const confetti = new THREE.Mesh(geo, mat);
      confetti.position.copy(position);
      confetti.position.x += (Math.random() - 0.5) * 6;
      confetti.position.z += (Math.random() - 0.5) * 6;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        4 + Math.random() * 6,
        (Math.random() - 0.5) * 2,
      );

      this.group.add(confetti);
      this.particles.push({
        mesh: confetti,
        velocity: vel,
        life: 2.0 + Math.random() * 2,
        maxLife: 4.0,
      });
    }
  }

  private spawnGlowPulse(position: THREE.Vector3, color: string): void {
    const geo = new THREE.RingGeometry(0.3, 1.2, 32);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 1.0 });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(position);
    ring.position.y = 0.1;
    ring.rotation.x = -Math.PI / 2;

    this.group.add(ring);
    const key = `glow_${Date.now()}`;
    this.glowRings.set(key, { mesh: ring, life: 1.5 });
  }

  update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.velocity.y -= 4 * dt; // gravity
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.z += dt * 3;

      // Fade out
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.mesh.material instanceof THREE.MeshStandardMaterial) {
        p.mesh.material.opacity = alpha;
        p.mesh.material.transparent = true;
      }

      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }

    // Update glow rings
    for (const [key, ring] of this.glowRings) {
      ring.life -= dt;
      ring.mesh.scale.setScalar(1 + (1.5 - ring.life) * 3);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ring.life / 1.5);

      if (ring.life <= 0) {
        this.group.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        (ring.mesh.material as THREE.Material).dispose();
        this.glowRings.delete(key);
      }
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    for (const [, ring] of this.glowRings) {
      this.group.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      (ring.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
    this.glowRings.clear();
    this.group.clear();
  }
}
