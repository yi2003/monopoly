// ============================================================
// ZoneDetector — Map camera position → audio zone weights
// Based on proximity to game tiles and their types/groups
// ============================================================

import * as THREE from 'three';
import type { GameState, Tile, ColorGroup } from '@monopoly/shared';
import {
  getGroundTilePosition,
  GROUND_INNER_RING_SIZE,
  OUTER_RING_OFFSET,
  TOTAL_TILES,
} from '@monopoly/shared';

// ---- Audio Zone Enum ----

export enum AudioZone {
  ResidentialLow = 'ResidentialLow',
  CommercialMid = 'CommercialMid',
  Upscale = 'Upscale',
  Premium = 'Premium',
  Railway = 'Railway',
  Industrial = 'Industrial',
  Civic = 'Civic',
  InnerCafe = 'InnerCafe',
  InnerRest = 'InnerRest',
  InnerMarket = 'InnerMarket',
}

// ---- Zone mapping tables ----

/** Color groups → AudioZone */
const GROUP_ZONE_MAP: Partial<Record<ColorGroup, AudioZone>> = {
  brown: AudioZone.ResidentialLow,
  lightblue: AudioZone.ResidentialLow,
  outer_copper: AudioZone.ResidentialLow,
  outer_amber: AudioZone.ResidentialLow,

  teal: AudioZone.CommercialMid,
  pink: AudioZone.CommercialMid,
  orange: AudioZone.CommercialMid,
  outer_mint: AudioZone.CommercialMid,
  outer_coral: AudioZone.CommercialMid,
  outer_lime: AudioZone.CommercialMid,

  red: AudioZone.Upscale,
  yellow: AudioZone.Upscale,
  outer_violet: AudioZone.Upscale,
  outer_rose: AudioZone.Upscale,

  plum: AudioZone.Premium,
  green: AudioZone.Premium,
  blue: AudioZone.Premium,
  outer_sky: AudioZone.Premium,
  outer_ruby: AudioZone.Premium,
  outer_navy: AudioZone.Premium,
};

// ---- Cached tile positions & zones (computed once) ----

interface CachedTile {
  pos: { x: number; z: number }; // 2D world position
  zone: AudioZone;
}

let cachedTiles: CachedTile[] | null = null;
let cachedGameState: GameState | null = null;

function buildCache(state: GameState): void {
  if (cachedGameState === state && cachedTiles) return;
  cachedGameState = state;
  cachedTiles = [];

  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = state.tiles[i];
    if (!tile) continue;

    const zone = tileToZone(tile);
    if (!zone) continue;

    let pos: { x: number; z: number };

    if (tile.ring === 'inner') {
      // Inner city tiles cluster around center with sector/ring layout
      const localIdx = i - GROUND_INNER_RING_SIZE; // 0-23
      const ringIndex = Math.floor(localIdx / 8); // 0=outer, 1=middle, 2=inner
      const sector = localIdx % 8;
      const angle = (sector / 8) * Math.PI * 2 - Math.PI / 2;
      const radius = 5 + ringIndex * 7; // concentric rings: 5, 12, 19 units
      pos = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      };
    } else {
      pos = getGroundTilePosition(i);
    }

    cachedTiles.push({ pos, zone });
  }
}

// ---- Tile → Zone Classification ----

function tileToZone(tile: Tile): AudioZone | null {
  // Inner city tiles
  if (tile.ring === 'inner') {
    switch (tile.type) {
      case 'inner_cafe': return AudioZone.InnerCafe;
      case 'inner_rest':
      case 'inner_fountain': return AudioZone.InnerRest;
      case 'inner_square':
      case 'inner_shop':
      case 'inner_food':
      case 'inner_community': return AudioZone.InnerMarket;
      case 'inner_chance': return AudioZone.Civic;
      default: return AudioZone.InnerMarket;
    }
  }

  // Ground ring tiles
  switch (tile.type) {
    case 'property': {
      const zone = GROUP_ZONE_MAP[tile.group];
      return zone || AudioZone.CommercialMid;
    }
    case 'railway':
      return AudioZone.Railway;
    case 'utility':
    case 'tax':
      return AudioZone.Industrial;
    case 'go':
    case 'jail':
    case 'goto_jail':
    case 'stock_market':
    case 'wheel':
    case 'chance':
    case 'community_chest':
      return AudioZone.Civic;
    default:
      return null;
  }
}

// ---- Zone Weight Computation ----

const MAX_DISTANCE = 50; // tiles beyond this distance contribute 0
const POWER_FALLOFF = 1.8; // inverse-distance falloff exponent
const THROTTLE_MS = 250; // recompute at most every 250ms

let lastComputeTime = 0;
let lastWeights: Map<AudioZone, number> = new Map();

/**
 * Compute proximity-weighted audio zone contributions from camera position.
 * Returns a Map of AudioZone → weight (0-1, normalized).
 * Throttled: recomputes at most every 250ms; returns cached result between calls.
 */
export function computeZoneWeights(
  cameraPos: THREE.Vector3,
  state: GameState,
): Map<AudioZone, number> {
  const now = performance.now();
  if (now - lastComputeTime < THROTTLE_MS) {
    return lastWeights;
  }
  lastComputeTime = now;

  buildCache(state);

  const rawWeights = new Map<AudioZone, number>();

  for (const tile of cachedTiles!) {
    const dx = cameraPos.x - tile.pos.x;
    const dz = cameraPos.z - tile.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > MAX_DISTANCE) continue;

    // Inverse distance weighting with power falloff
    const weight = Math.pow(1 - Math.min(dist / MAX_DISTANCE, 1), POWER_FALLOFF);

    const current = rawWeights.get(tile.zone) || 0;
    rawWeights.set(tile.zone, current + weight);
  }

  // Normalize to 0-1 range
  let maxWeight = 0;
  for (const w of rawWeights.values()) {
    if (w > maxWeight) maxWeight = w;
  }

  if (maxWeight > 0) {
    for (const [zone, w] of rawWeights) {
      rawWeights.set(zone, Math.min(w / maxWeight, 1));
    }
  }

  // Always ensure at least some zones have weight (fallback)
  if (rawWeights.size === 0) {
    rawWeights.set(AudioZone.Civic, 0.5);
    rawWeights.set(AudioZone.CommercialMid, 0.3);
  }

  lastWeights = rawWeights;
  return rawWeights;
}
