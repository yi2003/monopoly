// ============================================================
// Characters — Humanoid player pieces with path-based walk
// ============================================================

import * as THREE from 'three';
import type { GameState, Player } from '@monopoly/shared';

interface CharacterData {
  playerId: string;
  group: THREE.Group;
  color: string;
  currentTile: number;
  // Path following
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  walkProgress: number; // 0-1 within current segment
}

const WALK_SPEED = 5.5; // tiles per second (~19 units/s, fast board traversal)
const TILE_W = 2.8;
const BOARD_HALF = 5.0 + 7 * TILE_W;
const CORNER_SIZE = 5.0;
const WAYPOINT_THRESHOLD = 0.08;

export class Characters {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private characters: Map<string, CharacterData> = new Map();
  private prevPositions: Map<string, number> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  updateState(state: GameState): void {
    for (const player of state.players) {
      if (player.isSpectator || player.status === 'bankrupt') {
        this.removeCharacter(player.id);
        continue;
      }

      let charData = this.characters.get(player.id);

      // New character
      if (!charData) {
        const charGroup = this.createCharacter(player.color);
        this.group.add(charGroup);
        const pos = this.getTileWorldPos(player.position);
        charGroup.position.set(pos.x, 0.7, pos.z);
        charData = {
          playerId: player.id,
          group: charGroup,
          color: player.color,
          currentTile: player.position,
          waypoints: [],
          waypointIndex: 0,
          walkProgress: 1,
        };
        this.characters.set(player.id, charData);
        this.prevPositions.set(player.id, player.position);
        continue;
      }

      // Check if player moved to a new tile
      const prevPos = this.prevPositions.get(player.id);
      if (prevPos !== undefined && prevPos !== player.position) {
        // Build path from previous tile to new tile
        const path = this.buildPath(prevPos, player.position);
        charData.waypoints = path;
        charData.waypointIndex = 0;
        charData.walkProgress = 0;
        charData.currentTile = player.position;
      }

      this.prevPositions.set(player.id, player.position);
    }

    // Remove characters for disconnected players
    for (const [id] of this.characters) {
      if (!state.players.find(p => p.id === id)) {
        this.removeCharacter(id);
      }
    }
  }

  /** Build tile-by-tile path along the board perimeter */
  private buildPath(from: number, to: number): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = [];

    // Handle wrapping around GO (passing through tile 0)
    // If going forward past tile 47, wrap to 0
    let tiles: number[] = [];
    if (from <= to) {
      // Normal forward movement
      for (let i = from; i <= to; i++) {
        tiles.push(i);
      }
    } else {
      // Wrapped around — go from 'from' to 47, then 0 to 'to'
      for (let i = from; i < 48; i++) tiles.push(i);
      for (let i = 0; i <= to; i++) tiles.push(i);
    }

    // Only emit waypoints for every Nth tile to avoid too many points
    // But always include the starting position and each corner
    for (const t of tiles) {
      const pos = this.getTileWorldPos(t);
      waypoints.push(new THREE.Vector3(pos.x, 0.7, pos.z));
    }

    return waypoints;
  }

  private createCharacter(color: string): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: '#FFDAB9', roughness: 0.5 });

    // Body (torso)
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.6, 8);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.17, 10, 8);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.98;
    head.castShadow = true;
    group.add(head);

    // Hat
    const hatBrimGeo = new THREE.CylinderGeometry(0.2, 0.21, 0.08, 12);
    const hatBrim = new THREE.Mesh(hatBrimGeo, mat);
    hatBrim.position.y = 1.1;
    group.add(hatBrim);
    const hatTopGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.14, 12);
    const hatTop = new THREE.Mesh(hatTopGeo, mat);
    hatTop.position.y = 1.2;
    group.add(hatTop);

    // Legs with pivot for animation
    for (let s = -1; s <= 1; s += 2) {
      const upperLegGroup = new THREE.Group();
      upperLegGroup.position.set(s * 0.08, 0.28, 0);
      upperLegGroup.name = s === -1 ? 'legL' : 'legR';

      const upperLegGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.28, 6);
      const upperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
      upperLeg.position.y = 0;
      upperLeg.castShadow = true;
      upperLegGroup.add(upperLeg);

      // Lower leg + foot pivot
      const lowerGroup = new THREE.Group();
      lowerGroup.position.y = -0.28;
      const lowerLegGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.26, 6);
      const lowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
      lowerLeg.position.y = -0.13;
      lowerGroup.add(lowerLeg);

      const shoeGeo = new THREE.BoxGeometry(0.07, 0.06, 0.12);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(0, -0.27, 0.03);
      lowerGroup.add(shoe);

      upperLegGroup.add(lowerGroup);
      group.add(upperLegGroup);
    }

    // Arms with pivot
    for (let s = -1; s <= 1; s += 2) {
      const armGroup = new THREE.Group();
      armGroup.position.set(s * 0.22, 0.65, 0);
      armGroup.name = s === -1 ? 'armL' : 'armR';

      const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.28, 6);
      const upperArm = new THREE.Mesh(upperArmGeo, mat);
      upperArm.position.y = 0;
      upperArm.castShadow = true;
      armGroup.add(upperArm);

      const lowerGroup = new THREE.Group();
      lowerGroup.position.y = -0.28;
      const lowerArmGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.25, 6);
      const lowerArm = new THREE.Mesh(lowerArmGeo, mat);
      lowerArm.position.y = -0.12;
      lowerGroup.add(lowerArm);

      armGroup.add(lowerGroup);
      group.add(armGroup);
    }

    return group;
  }

  update(dt: number): void {
    for (const [, charData] of this.characters) {
      if (charData.waypoints.length === 0) continue;

      // Advance through waypoints
      const wp = charData.waypoints;
      const idx = charData.waypointIndex;

      if (idx >= wp.length - 1) {
        // At final waypoint — snap and stop
        const target = wp[wp.length - 1];
        charData.group.position.copy(target);
        charData.waypoints = [];
        this.resetPose(charData);
        continue;
      }

      // Move from waypoint[idx] to waypoint[idx+1]
      const from = wp[idx];
      const to = wp[idx + 1];
      const segLen = from.distanceTo(to);
      charData.walkProgress += dt * WALK_SPEED / Math.max(segLen, 0.5);

      if (charData.walkProgress >= 1) {
        // Advance to next segment
        charData.walkProgress -= 1;
        charData.waypointIndex++;
        // Carry overflow to next segment
        if (charData.waypointIndex >= wp.length - 1) {
          charData.group.position.copy(wp[wp.length - 1]);
          charData.waypoints = [];
          this.resetPose(charData);
          continue;
        }
      }

      // Interpolate position
      const currentIdx = charData.waypointIndex;
      const segFrom = wp[currentIdx];
      const segTo = wp[Math.min(currentIdx + 1, wp.length - 1)];
      const t = charData.walkProgress;
      const pos = new THREE.Vector3().lerpVectors(segFrom, segTo, t);
      charData.group.position.copy(pos);

      // Face movement direction
      const dir = segTo.clone().sub(segFrom);
      if (dir.lengthSq() > 0.001) {
        const angle = Math.atan2(dir.x, dir.z);
        charData.group.rotation.y = THREE.MathUtils.lerp(charData.group.rotation.y, angle, 0.15);
      }

      // Walk animation
      this.animateWalk(charData, dt);
    }
  }

  private animateWalk(charData: CharacterData, dt: number): void {
    const speed = WALK_SPEED;
    const freq = speed * 4; // faster steps to match higher speed
    const swing = 0.45;

    // Use a persistent phase per character
    const key = `phase_${charData.playerId}`;
    const currentPhase = (charData.group.userData[key] as number) || 0;
    const newPhase = currentPhase + dt * freq;
    charData.group.userData[key] = newPhase;

    const legSwing = Math.sin(newPhase) * swing;
    const armSwing = Math.sin(newPhase) * swing * 0.8;
    const bounce = Math.abs(Math.sin(newPhase * 2)) * 0.06;

    const legL = charData.group.getObjectByName('legL');
    const legR = charData.group.getObjectByName('legR');
    const armL = charData.group.getObjectByName('armL');
    const armR = charData.group.getObjectByName('armR');

    if (legL) legL.rotation.x = legSwing;
    if (legR) legR.rotation.x = -legSwing;
    if (armL) armL.rotation.x = -armSwing;
    if (armR) armR.rotation.x = armSwing;

    charData.group.position.y = 0.7 + bounce;
  }

  private resetPose(charData: CharacterData): void {
    charData.group.position.y = 0.7;
    for (const name of ['legL', 'legR', 'armL', 'armR']) {
      const part = charData.group.getObjectByName(name);
      if (part) part.rotation.x = THREE.MathUtils.lerp(part.rotation.x, 0, 0.1);
    }
  }

  /** Hide/show a specific character (for first-person roam) */
  setCharacterVisible(playerId: string, visible: boolean): void {
    const cd = this.characters.get(playerId);
    if (cd) cd.group.visible = visible;
  }

  /** Get the character's current yaw rotation (for camera to match walking direction) */
  getCharacterYaw(playerId: string): number | null {
    const cd = this.characters.get(playerId);
    if (!cd) return null;
    return cd.group.rotation.y;
  }

  /** Get the current animated 3D world position of a character (for camera follow) */
  getCharacterPosition(playerId: string): THREE.Vector3 | null {
    const cd = this.characters.get(playerId);
    if (!cd) return null;
    return cd.group.position.clone();
  }

  /** Get world position for a tile on the ground ring */
  private getTileWorldPos(index: number): { x: number; z: number } {
    // Clamp to ground ring
    if (index >= 48) index = 48 - 1;
    const side = Math.floor(index / 12);
    const sideIdx = index % 12;
    const offset = CORNER_SIZE / 2 + sideIdx * (TILE_W + 0.15) + 1.4;
    const inner = 1.8; // inset from board edge

    switch (side) {
      case 0: return { x: -BOARD_HALF + offset, z: -BOARD_HALF + inner };
      case 1: return { x: BOARD_HALF - inner, z: -BOARD_HALF + offset };
      case 2: return { x: BOARD_HALF - offset, z: BOARD_HALF - inner };
      case 3: return { x: -BOARD_HALF + inner, z: BOARD_HALF - offset };
      default: return { x: 0, z: 0 };
    }
  }

  private removeCharacter(id: string): void {
    const existing = this.characters.get(id);
    if (existing) {
      this.group.remove(existing.group);
      this.characters.delete(id);
      this.prevPositions.delete(id);
    }
  }

  dispose(): void {
    for (const [, cd] of this.characters) {
      this.group.remove(cd.group);
      cd.group.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
    this.characters.clear();
    this.prevPositions.clear();
    this.group.clear();
  }
}
