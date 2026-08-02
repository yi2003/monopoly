// ============================================================
// Characters — Humanoid player pieces with path-based walk
// ============================================================

import * as THREE from 'three';
import type { GameState, Player, AvatarId, GodKind } from '@monopoly/shared';
import { getCharacterTilePos, OUTER_RING_OFFSET, GROUND_INNER_RING_SIZE } from '@monopoly/shared';
import { audioManager } from '../audio/AudioManager';
import { buildCharacterModel } from './CharacterModel';
import { drawGodFollowerGlyph, GOD_FOLLOWER_W, GOD_FOLLOWER_H } from './GodSprites';

interface CharacterData {
  playerId: string;
  group: THREE.Group;
  color: string;
  currentTile: number;
  nameLabel: THREE.Sprite;
  // Path following
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  walkProgress: number; // 0-1 within current segment
}

const WALK_SPEED = 5.5; // tiles per second
const WAYPOINT_THRESHOLD = 0.08;
const REACTION_DURATION = 0.6;

// Attached-god follower (财神/衰神 hovering above the bearer)
const GOD_FOLLOWER_Y = 2.2; // above the name label (1.45)
const GOD_FOLLOWER_SCALE = 0.72; // width; height keeps canvas aspect
const GOD_FOLLOWER_SPAWN = 0.35; // pop-in duration (s)

interface GodFollower {
  kind: GodKind;
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  lastTurns: number;
  phase: number; // bob / pulse phase
  spawnT: number; // elapsed pop-in time
}

interface ReactionState {
  type: 'hurt' | 'celebrate';
  elapsed: number;
  duration: number;
}

export class Characters {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private characters: Map<string, CharacterData> = new Map();
  private prevPositions: Map<string, number> = new Map();
  private reactions: Map<string, ReactionState> = new Map();
  private godFollowers: Map<string, GodFollower> = new Map();

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
        const charGroup = this.createCharacter(player.color, player.avatar);
        this.group.add(charGroup);
        const pos = this.getTileWorldPos(player.position);
        charGroup.position.set(pos.x, 0.7, pos.z);
        const nameLabel = this.createNameLabel(player.name, player.color);
        charGroup.add(nameLabel);
        charData = {
          playerId: player.id,
          group: charGroup,
          color: player.color,
          currentTile: player.position,
          nameLabel,
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

    // Sync attached-god followers (财神/衰神 hovering above the bearer)
    const followed = new Set<string>();
    for (const player of state.players) {
      if (player.isSpectator || player.status === 'bankrupt' || !player.god) continue;
      if (!this.characters.has(player.id)) continue;
      followed.add(player.id);
      this.ensureGodFollower(player.id, player.god.kind, player.god.turnsLeft);
    }
    for (const id of [...this.godFollowers.keys()]) {
      if (!followed.has(id)) this.removeGodFollower(id);
    }
  }

  /** Build tile-by-tile path along the board perimeter (ring-aware) */
  private buildPath(from: number, to: number): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = [];

    // Determine which ring we're on
    const isOuter = from >= OUTER_RING_OFFSET || to >= OUTER_RING_OFFSET;
    const ringStart = isOuter ? OUTER_RING_OFFSET : 0;
    const ringEnd = ringStart + GROUND_INNER_RING_SIZE;

    // Ring transfer: snap directly (no animation)
    if ((from >= OUTER_RING_OFFSET) !== (to >= OUTER_RING_OFFSET)) {
      const pos = this.getTileWorldPos(to);
      waypoints.push(new THREE.Vector3(pos.x, 0.7, pos.z));
      return waypoints;
    }

    let tiles: number[] = [];
    if (from <= to) {
      for (let i = from; i <= to; i++) tiles.push(i);
    } else {
      for (let i = from; i < ringEnd; i++) tiles.push(i);
      for (let i = ringStart; i <= to; i++) tiles.push(i);
    }

    for (const t of tiles) {
      const pos = this.getTileWorldPos(t);
      waypoints.push(new THREE.Vector3(pos.x, 0.7, pos.z));
    }

    return waypoints;
  }

  private createCharacter(color: string, avatar?: AvatarId): THREE.Group {
    return buildCharacterModel(color, avatar);
  }

  /** Create a canvas-based sprite label floating above the character */
  private createNameLabel(name: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Background pill
    const bgWidth = 200;
    const bgHeight = 36;
    const bgX = (256 - bgWidth) / 2;
    const bgY = (64 - bgHeight) / 2;
    const radius = 12;

    // Draw rounded rect background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.moveTo(bgX + radius, bgY);
    ctx.lineTo(bgX + bgWidth - radius, bgY);
    ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
    ctx.lineTo(bgX + bgWidth, bgY + bgHeight - radius);
    ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - radius, bgY + bgHeight);
    ctx.lineTo(bgX + radius, bgY + bgHeight);
    ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
    ctx.lineTo(bgX, bgY + radius);
    ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
    ctx.closePath();
    ctx.fill();

    // Colored accent bar on top
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bgX + radius, bgY);
    ctx.lineTo(bgX + bgWidth - radius, bgY);
    ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
    ctx.lineTo(bgX + bgWidth, bgY + 5);
    ctx.lineTo(bgX, bgY + 5);
    ctx.lineTo(bgX, bgY + radius);
    ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
    ctx.closePath();
    ctx.fill();

    // Player name text
    ctx.font = 'bold 18px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayName = name.length > 8 ? name.slice(0, 7) + '…' : name;
    ctx.fillText(displayName, 128, 34);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.0, 0.5, 1);
    sprite.position.y = 1.45;
    sprite.renderOrder = 999;
    return sprite;
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

    // ── Process character reactions ──
    for (const [playerId, reaction] of this.reactions) {
      reaction.elapsed += dt;
      const cd = this.characters.get(playerId);
      if (!cd) { this.reactions.delete(playerId); continue; }

      const t = Math.min(reaction.elapsed / reaction.duration, 1);

      // Find the body mesh (first child = torso cylinder)
      const body = cd.group.children[0] as THREE.Mesh;
      if (body?.material instanceof THREE.MeshStandardMaterial) {
        if (!cd.group.userData.origEmissive) {
          cd.group.userData.origEmissive = body.material.emissive ? body.material.emissive.getHex() : 0;
        }
        if (reaction.type === 'hurt') {
          body.material.emissive = new THREE.Color('#ff0000');
          body.material.emissiveIntensity = 0.5 * (1 - t);
        } else if (reaction.type === 'celebrate') {
          body.material.emissive = new THREE.Color('#4CAF50');
          body.material.emissiveIntensity = 0.4 * (1 - t);
        }
      }

      // Vertical bounce/squish (on top of walk bounce)
      if (reaction.type === 'hurt') {
        cd.group.position.y += -(1 - t) * 0.2; // squish down
      } else if (reaction.type === 'celebrate') {
        const hop = Math.sin(t * Math.PI) * 0.35; // hop up
        cd.group.position.y += hop;
      }

      // Cleanup when done
      if (reaction.elapsed >= reaction.duration) {
        if (body?.material instanceof THREE.MeshStandardMaterial) {
          body.material.emissive = new THREE.Color(0x000000);
          body.material.emissiveIntensity = 0;
        }
        this.reactions.delete(playerId);
      }
    }

    // ── Animate attached-god followers (bob / pulse / pop-in) ──
    for (const f of this.godFollowers.values()) {
      f.phase += dt * 2.2;
      f.spawnT = Math.min(f.spawnT + dt, GOD_FOLLOWER_SPAWN);

      // easeOutBack pop-in on attach
      const k = f.spawnT / GOD_FOLLOWER_SPAWN;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const ease = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);

      const bob = Math.sin(f.phase) * 0.08;
      const pulse = 1 + Math.sin(f.phase * 0.8) * 0.05;
      const s = GOD_FOLLOWER_SCALE * pulse * ease;
      f.sprite.position.y = GOD_FOLLOWER_Y + bob;
      f.sprite.scale.set(s, s * (GOD_FOLLOWER_H / GOD_FOLLOWER_W), 1);
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

    // Footstep trigger on sign change (foot hits ground), paced to a natural
    // cadence (~0.28s ≈ 3.5 steps/sec) instead of firing on every leg swing.
    const prevSinKey = `prevSin_${charData.playerId}`;
    const prevSin = (charData.group.userData[prevSinKey] as number) || 0;
    const newSin = Math.sin(newPhase);
    const stepTimerKey = `stepTimer_${charData.playerId}`;
    const stepTimer = (charData.group.userData[stepTimerKey] as number) || 0;
    charData.group.userData[stepTimerKey] = stepTimer + dt;
    if ((prevSin > 0 && newSin <= 0) || (prevSin < 0 && newSin >= 0)) {
      if (stepTimer >= 0.28) {
        charData.group.userData[stepTimerKey] = 0;
        audioManager.playFootstep();
      }
    }
    charData.group.userData[prevSinKey] = newSin;

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

  /** Trigger a reaction animation on a character */
  playReaction(playerId: string, type: 'hurt' | 'celebrate'): void {
    this.reactions.set(playerId, { type, elapsed: 0, duration: REACTION_DURATION });
  }

  /** Create or refresh the god billboard hovering above a character's head */
  private ensureGodFollower(playerId: string, kind: GodKind, turns: number): void {
    const existing = this.godFollowers.get(playerId);
    if (existing) {
      // Refresh the turns-left counter when it changes
      if (existing.lastTurns !== turns) {
        drawGodFollowerGlyph(existing.ctx, existing.kind, turns);
        existing.texture.needsUpdate = true;
        existing.lastTurns = turns;
      }
      return;
    }

    const cd = this.characters.get(playerId);
    if (!cd) return;

    const canvas = document.createElement('canvas');
    canvas.width = GOD_FOLLOWER_W;
    canvas.height = GOD_FOLLOWER_H;
    const ctx = canvas.getContext('2d')!;
    drawGodFollowerGlyph(ctx, kind, turns);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const h = GOD_FOLLOWER_SCALE * (GOD_FOLLOWER_H / GOD_FOLLOWER_W);
    sprite.scale.set(GOD_FOLLOWER_SCALE, h, 1);
    sprite.position.set(0, GOD_FOLLOWER_Y, 0);
    sprite.renderOrder = 999;
    cd.group.add(sprite);

    this.godFollowers.set(playerId, {
      kind,
      sprite,
      texture,
      ctx,
      lastTurns: turns,
      phase: Math.random() * Math.PI * 2,
      spawnT: 0,
    });
  }

  private removeGodFollower(playerId: string): void {
    const f = this.godFollowers.get(playerId);
    if (!f) return;
    const cd = this.characters.get(playerId);
    if (cd) cd.group.remove(f.sprite);
    f.sprite.material.dispose();
    f.texture.dispose();
    this.godFollowers.delete(playerId);
  }

  /** Get world position for a tile on the ground ring */
  private getTileWorldPos(index: number): { x: number; z: number } {
    // Ground ring tiles (inner or outer)
    if (index < GROUND_INNER_RING_SIZE || index >= OUTER_RING_OFFSET) {
      return getCharacterTilePos(index);
    }
    // Inner city — fallback to center
    return { x: 0, z: 0 };
  }

  private removeCharacter(id: string): void {
    const existing = this.characters.get(id);
    if (existing) {
      this.group.remove(existing.group);
      this.characters.delete(id);
      this.prevPositions.delete(id);
    }
    this.removeGodFollower(id);
  }

  dispose(): void {
    for (const id of [...this.godFollowers.keys()]) this.removeGodFollower(id);
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
