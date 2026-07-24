// ============================================================
// Pedestrians — Animated NPC pedestrians on sidewalks
// ============================================================

import * as THREE from 'three';
import type { ThemeId } from '@monopoly/shared';

interface PedestrianData {
  group: THREE.Group;
  target: THREE.Vector3;
  startPos: THREE.Vector3;
  speed: number;
  t: number; // lerp progress 0→1
  direction: number; // 0=forward, 1=backward (returns to start)
  walkPhase: number;
  paired: boolean;
  pairOffset: number;
}

const THEME_COLORS: Record<ThemeId, string[]> = {
  classic: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'],
  shanghai: ['#D32F2F', '#C62828', '#F57C00', '#388E3C', '#1976D2'],
  tokyo: ['#212121', '#37474F', '#455A64', '#546E7A', '#263238'],
};

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

  /** Define sidewalk walk zones (called after CityBuilder generates roads) */
  setWalkZones(zones: { start: THREE.Vector3; end: THREE.Vector3 }[]): void {
    this.walkZones = zones;
    this.spawnInitial();
  }

  private spawnInitial(): void {
    // Clear existing
    this.clear();

    if (this.walkZones.length === 0) return;

    const colors = THEME_COLORS[this.theme] || THEME_COLORS.classic;
    const baseCount = Math.floor(this.walkZones.length * 3 * this.density);

    for (let i = 0; i < baseCount; i++) {
      const zone = this.walkZones[i % this.walkZones.length];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const paired = Math.random() < 0.25;
      this.createPedestrian(zone, color, paired);
      if (paired) {
        // Create a pair
        this.createPedestrian(zone, colors[Math.floor(Math.random() * colors.length)], false);
      }
    }
  }

  private createPedestrian(
    zone: { start: THREE.Vector3; end: THREE.Vector3 },
    color: string,
    _paired: boolean,
  ): void {
    const group = this.createHumanoid(color);
    const t = Math.random();

    const start = zone.start.clone();
    const end = zone.end.clone();
    const pos = start.clone().lerp(end, t);

    group.position.copy(pos);
    group.position.y = 0.15;

    // Face the direction of the zone
    const dir = end.clone().sub(start).normalize();
    group.lookAt(pos.clone().add(dir));

    this.group.add(group);
    this.pedestrians.push({
      group,
      target: Math.random() < 0.5 ? end.clone() : start.clone(),
      startPos: start.clone(),
      speed: 0.3 + Math.random() * 0.5,
      t: Math.random(),
      direction: Math.random() < 0.5 ? 0 : 1,
      walkPhase: Math.random() * Math.PI * 2,
      paired: Math.random() < 0.25,
      pairOffset: (Math.random() - 0.5) * 0.8,
    });
  }

  private createHumanoid(color: string): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: '#FFDAB9', roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: '#37474F', roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.8 });

    // Body (torso)
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.4, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.85;
    group.add(head);

    // Legs (animated)
    for (let s = -1; s <= 1; s += 2) {
      // Upper leg
      const upperLegGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.25, 6);
      const upperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
      upperLeg.position.set(s * 0.08, 0.25, 0);
      upperLeg.castShadow = true;
      upperLeg.name = s === -1 ? 'legL' : 'legR';
      group.add(upperLeg);

      // Lower leg + shoe
      const lowerGroup = new THREE.Group();
      lowerGroup.position.y = -0.25;
      const lowerLegGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6);
      const lowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
      lowerLeg.position.y = -0.11;
      lowerGroup.add(lowerLeg);

      const shoeGeo = new THREE.BoxGeometry(0.06, 0.05, 0.1);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.y = -0.24;
      shoe.position.z = 0.03;
      lowerGroup.add(shoe);

      upperLeg.add(lowerGroup);
    }

    // Arms
    for (let s = -1; s <= 1; s += 2) {
      const upperArmGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6);
      const upperArm = new THREE.Mesh(upperArmGeo, bodyMat);
      upperArm.position.set(s * 0.17, 0.65, 0);
      upperArm.name = s === -1 ? 'armL' : 'armR';
      group.add(upperArm);

      const lowerGroup = new THREE.Group();
      lowerGroup.position.y = -0.3;
      const lowerArmGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.25, 6);
      const lowerArm = new THREE.Mesh(lowerArmGeo, bodyMat);
      lowerArm.position.y = -0.125;
      lowerGroup.add(lowerArm);
      upperArm.add(lowerGroup);
    }

    group.scale.setScalar(0.7 + Math.random() * 0.3); // slight height variation
    return group;
  }

  update(dt: number): void {
    for (const ped of this.pedestrians) {
      // Move along path
      const fromPos = ped.direction === 0 ? ped.startPos : ped.target;
      const toPos = ped.direction === 0 ? ped.target : ped.startPos;

      ped.t += dt * ped.speed / fromPos.distanceTo(toPos);

      if (ped.t >= 1) {
        ped.t = 0;
        ped.direction = 1 - ped.direction; // reverse
      }

      const pos = fromPos.clone().lerp(toPos, ped.t);
      ped.group.position.x = pos.x + (ped.paired ? ped.pairOffset : 0);
      ped.group.position.z = pos.z + (ped.paired ? ped.pairOffset : 0);

      // Face movement direction
      const dir = toPos.clone().sub(fromPos).normalize();
      if (dir.lengthSq() > 0.001) {
        const angle = Math.atan2(dir.x, dir.z);
        ped.group.rotation.y = angle;
      }

      // Walk animation — swing legs
      ped.walkPhase += dt * ped.speed * 8;
      const swingAngle = Math.sin(ped.walkPhase) * 0.4;

      const legL = ped.group.getObjectByName('legL');
      const legR = ped.group.getObjectByName('legR');
      const armL = ped.group.getObjectByName('armL');
      const armR = ped.group.getObjectByName('armR');

      if (legL) legL.rotation.x = swingAngle;
      if (legR) legR.rotation.x = -swingAngle;
      if (armL) armL.rotation.x = -swingAngle * 0.7;
      if (armR) armR.rotation.x = swingAngle * 0.7;
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
