// ============================================================
// boardLayout — Single source of truth for tile-to-3D-world mapping
// Used by: Board, Characters, Houses, CityBuilder, SceneManager, CameraController
// ============================================================

import { OUTER_RING_OFFSET } from './constants';

export const TILE_W = 2.8;
export const TILE_D = 5.5;
export const CORNER_SIZE = 5.0;
export const SIDE_LENGTH = 12; // tiles per side
export const SPACING = 0.15;   // gap between adjacent tiles

export const INNER_BOARD_HALF = CORNER_SIZE + 7 * TILE_W; // 24.6
export const ROAD_GAP = 4.0; // road width between inner and outer ring
export const OUTER_BOARD_HALF = INNER_BOARD_HALF + TILE_D + ROAD_GAP; // 34.1

export interface TilePos3D {
  x: number;
  z: number;
  rotation: number; // Y-axis rotation (radians), tile faces outward
}

// ---- Tile center position (matches Board.ts, Houses.ts, CityBuilder.ts) ----

export function getGroundTilePosition(index: number): TilePos3D {
  const isOuter = index >= OUTER_RING_OFFSET;
  const boardHalf = isOuter ? OUTER_BOARD_HALF : INNER_BOARD_HALF;
  const localIdx = isOuter ? index - OUTER_RING_OFFSET : index;
  const side = Math.floor(localIdx / SIDE_LENGTH);
  const sideIdx = localIdx % SIDE_LENGTH;
  const offset = CORNER_SIZE / 2 + sideIdx * (TILE_W + SPACING);

  switch (side) {
    case 0: // Bottom — going RIGHT (+X)
      return { x: -boardHalf + offset, z: -boardHalf, rotation: 0 };
    case 1: // Right — going UP (+Z)
      return { x: boardHalf, z: -boardHalf + offset, rotation: Math.PI / 2 };
    case 2: // Top — going LEFT (-X)
      return { x: boardHalf - offset, z: boardHalf, rotation: Math.PI };
    case 3: // Left — going DOWN (-Z)
      return { x: -boardHalf, z: boardHalf - offset, rotation: -Math.PI / 2 };
    default:
      return { x: 0, z: 0, rotation: 0 };
  }
}

// ---- Corner check ----

export function isCornerIndex(index: number): boolean {
  if (index >= OUTER_RING_OFFSET) {
    const local = index - OUTER_RING_OFFSET;
    return local % SIDE_LENGTH === 0;
  }
  return index % SIDE_LENGTH === 0;
}

// ---- Character standing position (matches Characters.ts getTileWorldPos) ----
// Characters stand inset from the board edge, on the inward-facing side of the tile.

export function getCharacterTilePos(index: number): { x: number; z: number } {
  const isOuter = index >= OUTER_RING_OFFSET;
  const boardHalf = isOuter ? OUTER_BOARD_HALF : INNER_BOARD_HALF;
  const localIdx = isOuter ? index - OUTER_RING_OFFSET : index;
  const side = Math.floor(localIdx / SIDE_LENGTH);
  const sideIdx = localIdx % SIDE_LENGTH;
  const offset = CORNER_SIZE / 2 + sideIdx * (TILE_W + SPACING) + 1.4;
  const inner = 1.8; // radial inset from board edge toward center

  switch (side) {
    case 0: return { x: -boardHalf + offset, z: -boardHalf + inner };
    case 1: return { x: boardHalf - inner, z: -boardHalf + offset };
    case 2: return { x: boardHalf - offset, z: boardHalf - inner };
    case 3: return { x: -boardHalf + inner, z: boardHalf - offset };
    default: return { x: 0, z: 0 };
  }
}
