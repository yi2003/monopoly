// ============================================================
// Pedestrians — Opus5-style detailed NPCs with outfit system
// ============================================================

import * as THREE from 'three';
import type { ThemeId } from '@monopoly/shared';
import { Rng } from '../util/rng';
import { boxMesh, cylMesh } from '../util/geom';

// ---- Outfit colour palettes (from opus5) ----

const OUTFIT_COLORS: Record<string, string[]> = {
  overcoat: ['#2a2a28', '#3a3028', '#1a2030', '#4a3a28'],
  fedora: ['#2a2a28', '#3a3028'],
  dress40s: ['#6a2030', '#2a4060', '#4a3a20', '#5a2040'],
  uniform: ['#2a3a2a', '#3a3a40'],
  apron: ['#e0e0d8', '#c8c0b0'],
  mod: ['#e04080', '#20a0c0', '#e0c020', '#8040c0'],
  suit60s: ['#2a2a30', '#3a4050', '#4a3020'],
  dress60s: ['#e06080', '#40c0c0', '#e0a040'],
  leather: ['#1a1a1a', '#2a1a10'],
  power: ['#1a1a1a', '#e0e0e0', '#2a2040'],
  punk: ['#101010', '#e02040', '#80ff40'],
  aerobics: ['#ff40a0', '#40e0ff', '#e0ff40'],
  denim: ['#304878', '#3a5088'],
  suit80s: ['#1a1a28', '#3a2040', '#e8e0d0'],
  casual00s: ['#2a4a6a', '#4a3a2a', '#e04030', '#1a1a1a'],
  suit00s: ['#2a2a30', '#3a3a40'],
  hoodie: ['#1a3040', '#3a2030', '#2a4a2a'],
  tourist: ['#e0e0e0', '#c04030', '#4080c0'],
  athleisure: ['#1a1a1a', '#e0e0e0', '#40a070', '#c04080'],
  tech: ['#2a2a2a', '#3a4050', '#e8e8e8'],
  delivery: ['#e04020', '#2040a0', '#e0a020'],
  casual25: ['#3a3a3a', '#6a8070', '#c0b0a0'],
  softsuit: ['#c0e8e0', '#e0e0ff', '#80ffe0'],
  techwear: ['#1a1a1a', '#2a3040'],
  // Shanghai-themed
  shanghai_casual: ['#2a3040', '#4a3a30', '#c04030', '#1a1a2a'],
  shanghai_formal: ['#1a1a28', '#3a3a48', '#e8e0d0', '#2a2a38'],
  shanghai_youth: ['#ff4080', '#40a0ff', '#40e040', '#202020'],
  // Tokyo-themed
  tokyo_casual: ['#212121', '#37474F', '#455A64', '#546E7A', '#263238'],
  tokyo_formal: ['#1a1a1a', '#2a3040', '#3a3a40', '#e0e0e0'],
  tokyo_youth: ['#ff4080', '#00bcd4', '#ff9800', '#9c27b0', '#212121'],
};

// Theme → outfit pools
const THEME_OUTFITS: Record<ThemeId, string[]> = {
  classic: ['overcoat', 'casual00s', 'suit00s', 'hoodie', 'tourist', 'tech', 'athleisure', 'casual25', 'denim'],
  shanghai: ['shanghai_casual', 'shanghai_formal', 'shanghai_youth', 'tech', 'athleisure', 'casual25'],
  tokyo: ['tokyo_casual', 'tokyo_formal', 'tokyo_youth', 'tech', 'casual25', 'softsuit'],
};

// ---- Pedestrian data ----

interface PedestrianData {
  group: THREE.Group;
  startPos: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  t: number;
  direction: number; // 0=forward, 1=backward
  walkPhase: number;
  paired: boolean;
  pairOffset: number;
  nightTolerance: number;
}

// ---- Helpers ----

function skinMat(rng: Rng): THREE.MeshStandardMaterial {
  const tones = ['#e0b090', '#c09070', '#8a6040', '#5a3a28', '#f0c8a8', '#d0a080'];
  return new THREE.MeshStandardMaterial({ color: rng.pick(tones), roughness: 0.85, metalness: 0 });
}

function clothMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 });
}

function makeHumanoid(outfit: string, theme: ThemeId, seed: string): THREE.Group {
  const rng = new Rng(seed);
  const g = new THREE.Group();
  const colors = OUTFIT_COLORS[outfit] || OUTFIT_COLORS.casual25;
  const cloth = clothMat(rng.pick(colors));
  const skin = skinMat(rng);
  const dark = clothMat('#1a1a1a');

  const torsoH = 0.4;
  const hipY = 0.4;
  const shoulderY = 0.42 + torsoH * 0.35;
  const legLen = 0.4;

  // Legs — pivot from hip (y = hipY)
  const legLPivot = new THREE.Group();
  legLPivot.position.set(-0.08, hipY, 0);
  legLPivot.name = 'legL';
  const legLMesh = boxMesh(0.1, legLen, 0.12, cloth, 0, -legLen, 0);
  legLPivot.add(legLMesh);
  g.add(legLPivot);

  const legRPivot = new THREE.Group();
  legRPivot.position.set(0.08, hipY, 0);
  legRPivot.name = 'legR';
  const legRMesh = boxMesh(0.1, legLen, 0.12, cloth, 0, -legLen, 0);
  legRPivot.add(legRMesh);
  g.add(legRPivot);

  // torso
  g.add(boxMesh(0.28, torsoH, 0.18, cloth, 0, hipY, 0));

  // head
  g.add(cylMesh(0.1, 0.1, 0.16, skin, 0, hipY + torsoH, 0, 8));

  // Arms — pivot from shoulder (y = shoulderY)
  const armLen = 0.3;
  const armLPivot = new THREE.Group();
  armLPivot.position.set(-0.19, shoulderY, 0);
  armLPivot.name = 'armL';
  const armLMesh = boxMesh(0.07, armLen, 0.07, cloth, 0, -armLen, 0);
  armLPivot.add(armLMesh);
  g.add(armLPivot);

  const armRPivot = new THREE.Group();
  armRPivot.position.set(0.19, shoulderY, 0);
  armRPivot.name = 'armR';
  const armRMesh = boxMesh(0.07, armLen, 0.07, cloth, 0, -armLen, 0);
  armRPivot.add(armRMesh);
  g.add(armRPivot);

  // fedora/hat (classic)
  if (outfit === 'overcoat' && rng.bool(0.5)) {
    g.add(cylMesh(0.14, 0.14, 0.06, dark, 0, hipY + torsoH + 0.16, 0, 10));
    g.add(cylMesh(0.17, 0.17, 0.02, dark, 0, hipY + torsoH + 0.16, 0, 10));
  }

  // backpack / delivery bag
  if (outfit === 'delivery' || (outfit === 'athleisure' && rng.bool(0.2))) {
    g.add(boxMesh(0.2, 0.25, 0.12, clothMat('#e04020'), 0, 0.55, -0.14));
  }

  // slight size variation
  const s = rng.f(0.92, 1.08);
  g.scale.set(s, s, s);

  g.userData.limbs = { legL: legLPivot, legR: legRPivot, armL: armLPivot, armR: armRPivot };
  g.userData.phase = rng.f(0, Math.PI * 2);

  return g;
}

export class Pedestrians {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private pedestrians: PedestrianData[] = [];
  private theme: ThemeId = 'classic';
  private density = 1.0;
  private walkZones: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'pedestrians';
    this.scene.add(this.group);
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
  }

  setDensity(factor: number): void {
    this.density = Math.max(0, factor);
  }

  setNightFactor(nightFactor: number): void {
    for (const ped of this.pedestrians) {
      ped.group.visible = nightFactor <= ped.nightTolerance;
    }
  }

  setWalkZones(zones: { start: THREE.Vector3; end: THREE.Vector3 }[]): void {
    this.walkZones = zones;
    this.spawnInitial();
  }

  private spawnInitial(): void {
    this.clear();
    if (this.walkZones.length === 0) return;

    const outfits = THEME_OUTFITS[this.theme] || THEME_OUTFITS.classic;
    const rng = new Rng(`peds-${this.theme}`);
    const baseCount = Math.floor(this.walkZones.length * 8 * this.density);

    for (let i = 0; i < baseCount; i++) {
      const zone = this.walkZones[i % this.walkZones.length];
      const outfit = rng.pick(outfits);
      const mesh = makeHumanoid(outfit, this.theme, `p-${this.theme}-${i}`);

      const goForward = rng.bool(0.5);
      const start = zone.start.clone();
      const end = zone.end.clone();
      const t = goForward ? rng.next() : 1;
      const pos = start.clone().lerp(end, t);

      mesh.position.copy(pos);
      mesh.position.y = 0.15;

      this.group.add(mesh);
      this.pedestrians.push({
        group: mesh,
        startPos: start,
        target: end,
        speed: (0.3 + rng.f(0, 0.5)),
        t,
        direction: goForward ? 0 : 1,
        walkPhase: rng.f(0, Math.PI * 2),
        paired: rng.bool(0.25),
        pairOffset: rng.j(0.8),
        nightTolerance: 0.2 + rng.f(0, 0.7),
      });
    }
  }

  update(dt: number): void {
    for (const ped of this.pedestrians) {
      const fromPos = ped.direction === 0 ? ped.startPos : ped.target;
      const toPos = ped.direction === 0 ? ped.target : ped.startPos;

      ped.t += dt * ped.speed / Math.max(0.001, fromPos.distanceTo(toPos));

      if (ped.t >= 1) {
        ped.t = 0;
        ped.direction = 1 - ped.direction;
      }

      const pos = fromPos.clone().lerp(toPos, ped.t);
      ped.group.position.x = pos.x + (ped.paired ? ped.pairOffset : 0);
      ped.group.position.z = pos.z + (ped.paired ? ped.pairOffset : 0);

      // Face movement direction
      const dir = toPos.clone().sub(fromPos).normalize();
      if (dir.lengthSq() > 0.001) {
        ped.group.rotation.y = Math.atan2(dir.x, dir.z);
      }

      // Walk animation — limb swing (opus5-style)
      ped.walkPhase += dt * ped.speed * 8;
      const swing = Math.sin(ped.walkPhase + ped.group.userData.phase) * 0.45;
      const { legL, legR, armL, armR } = ped.group.userData.limbs || {};
      if (legL) {
        legL.rotation.x = swing;
        legR.rotation.x = -swing;
        armL.rotation.x = -swing * 0.7;
        armR.rotation.x = swing * 0.7;
      }
    }
  }

  clear(): void {
    for (const ped of this.pedestrians) {
      this.group.remove(ped.group);
      ped.group.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
    this.pedestrians = [];
  }

  dispose(): void {
    this.clear();
    this.group.clear();
    this.scene.remove(this.group);
  }
}
