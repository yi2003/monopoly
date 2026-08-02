// ============================================================
// GodSprites — floating glowing billboards for 财神/衰神 entities
// Synced from GameState.gods and animated (bob / slow spin / pulse).
// ============================================================

import * as THREE from 'three';
import type { GameState, GodEntity, GodKind } from '@monopoly/shared';
import { getCharacterTilePos } from '@monopoly/shared';
import { glowText } from '../util/canvas';

const GOD_COLORS: Record<GodKind, { color: string; glow: string }> = {
  wealth: { color: '#FFD700', glow: '#FF8C00' },
  misfortune: { color: '#C084FC', glow: '#8E24AA' },
};
const GOD_EMOJI: Record<GodKind, string> = { wealth: '😇', misfortune: '👿' };
const GOD_NAME: Record<GodKind, string> = { wealth: '财神', misfortune: '衰神' };
const BASE_Y = 1.8; // above tile props / characters

interface GodSprite {
  id: number;
  sprite: THREE.Sprite;
  baseY: number;
  phase: number;
}

export class GodSprites {
  private group = new THREE.Group();
  private sprites = new Map<number, GodSprite>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'gods';
    scene.add(this.group);
  }

  updateState(state: GameState): void {
    const gods = state.gods;

    // Remove sprites whose entity is gone (picked up / consumed)
    for (const [id, gs] of this.sprites) {
      if (!gods.some(g => g.id === id)) {
        this.removeSprite(gs);
      }
    }

    // Add new entities
    for (const god of gods) {
      if (this.sprites.has(god.id)) continue;
      this.sprites.set(god.id, this.createSprite(god));
    }
  }

  private createSprite(god: GodEntity): GodSprite {
    const { color, glow } = GOD_COLORS[god.kind];
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    // Soft glow disc behind the glyph
    const grad = ctx.createRadialGradient(80, 75, 8, 80, 75, 70);
    grad.addColorStop(0, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(80, 75, 70, 0, Math.PI * 2);
    ctx.fill();

    // Emoji glyph with glow
    ctx.font = '64px serif';
    glowText(ctx, GOD_EMOJI[god.kind], 80, 78, { color, glow, blur: 28, passes: 4 });

    // Name pill below
    ctx.font = 'bold 22px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(35, 148, 90, 32);
    glowText(ctx, GOD_NAME[god.kind], 80, 164, { color: '#ffffff', glow: color, blur: 12, passes: 2 });

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 1.9, 1);
    const pos = getCharacterTilePos(god.tileIndex);
    sprite.position.set(pos.x, BASE_Y, pos.z);
    sprite.renderOrder = 998;
    this.group.add(sprite);

    return { id: god.id, sprite, baseY: BASE_Y, phase: Math.random() * Math.PI * 2 };
  }

  private removeSprite(gs: GodSprite): void {
    this.group.remove(gs.sprite);
    gs.sprite.material.dispose();
    (gs.sprite.material as THREE.SpriteMaterial).map?.dispose();
    this.sprites.delete(gs.id);
  }

  update(dt: number): void {
    for (const gs of this.sprites.values()) {
      gs.phase += dt * 2.2;
      gs.sprite.position.y = gs.baseY + Math.sin(gs.phase) * 0.15;
      const mat = gs.sprite.material as THREE.SpriteMaterial;
      mat.rotation = gs.phase * 0.15;
      const pulse = 1 + Math.sin(gs.phase * 0.8) * 0.06;
      gs.sprite.scale.set(1.5 * pulse, 1.9 * pulse, 1);
    }
  }

  dispose(): void {
    for (const gs of this.sprites.values()) {
      this.removeSprite(gs);
    }
    this.scene.remove(this.group);
  }
}

// ============================================================
// Attached-god follower billboard (财神/衰神 hovering over the bearer)
// Smaller than board sprites, with a turns-left counter. Attached to
// the character group in Characters.ts so it follows the player.
// ============================================================

export const GOD_FOLLOWER_W = 96;
export const GOD_FOLLOWER_H = 112;

export function drawGodFollowerGlyph(
  ctx: CanvasRenderingContext2D,
  kind: GodKind,
  turns: number,
): void {
  const { color, glow } = GOD_COLORS[kind];
  const cx = GOD_FOLLOWER_W / 2;

  // Soft glow disc behind the glyph
  const grad = ctx.createRadialGradient(cx, 44, 6, cx, 44, 40);
  grad.addColorStop(0, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, 44, 40, 0, Math.PI * 2);
  ctx.fill();

  // Emoji glyph with glow
  ctx.font = '40px serif';
  glowText(ctx, GOD_EMOJI[kind], cx, 46, { color, glow, blur: 16, passes: 4 });

  // Turns-left counter pill ("×N")
  ctx.font = 'bold 18px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(18, 84, 60, 22);
  glowText(ctx, `×${turns}`, cx, 92, { color: '#ffffff', glow: color, blur: 8, passes: 2 });
}
