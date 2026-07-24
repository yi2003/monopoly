// ============================================================
// RoamCollision — AABB/sphere colliders & sliding response
// ============================================================

import * as THREE from 'three';

export interface Collider {
  type: 'box' | 'sphere' | 'cylinder';
  center: THREE.Vector3;
  // Box
  halfSize?: THREE.Vector3;
  // Sphere
  radius?: number;
  // Cylinder
  height?: number;
}

const PLAYER_RADIUS = 0.35;
const PLAYER_HEIGHT = 1.7;
const SLIDE_ITERATIONS = 3;

export class RoamCollision {
  private colliders: Collider[] = [];

  /** Register scene obstacles for collision */
  addCollider(c: Collider): void {
    this.colliders.push(c);
  }

  addBox(center: THREE.Vector3, halfSize: THREE.Vector3): void {
    this.colliders.push({ type: 'box', center: center.clone(), halfSize: halfSize.clone() });
  }

  addSphere(center: THREE.Vector3, radius: number): void {
    this.colliders.push({ type: 'sphere', center: center.clone(), radius });
  }

  addCylinder(center: THREE.Vector3, radius: number, height: number): void {
    this.colliders.push({ type: 'cylinder', center: center.clone(), radius, height });
  }

  clear(): void {
    this.colliders = [];
  }

  /** Get ground height at a point (for step-up onto sidewalks, curbs, etc.) */
  getGroundHeight(x: number, z: number): number {
    // Check against all colliders for standing-on-top
    let groundY = 0;
    const footPos = new THREE.Vector3(x, 0.5, z);

    for (const c of this.colliders) {
      if (c.type === 'box' && c.halfSize) {
        // Can we stand on this box?
        const top = c.center.y + c.halfSize.y;
        if (top <= 1.5 && top > groundY) {
          const withinX = Math.abs(x - c.center.x) < c.halfSize.x + PLAYER_RADIUS;
          const withinZ = Math.abs(z - c.center.z) < c.halfSize.z + PLAYER_RADIUS;
          if (withinX && withinZ && top > groundY) {
            groundY = top;
          }
        }
      }
    }
    return groundY;
  }

  /**
   * Attempt to move the player from `pos` by `delta`.
   * Returns the actual allowed movement vector after collision resolution.
   */
  resolveMovement(pos: THREE.Vector3, delta: THREE.Vector3): THREE.Vector3 {
    const result = delta.clone();
    const playerCenter = pos.clone();
    playerCenter.y += PLAYER_HEIGHT / 2;

    for (let iter = 0; iter < SLIDE_ITERATIONS; iter++) {
      let collided = false;

      for (const c of this.colliders) {
        const penetration = this.checkPenetration(
          playerCenter.clone().add(result),
          c,
        );

        if (penetration !== null) {
          // Push player out along penetration normal
          result.add(penetration);
          collided = true;
        }
      }

      if (!collided) break;
    }

    // Clamp y so player doesn't fall through the ground
    const groundH = this.getGroundHeight(pos.x + result.x, pos.z + result.z);
    const minY = groundH - pos.y;
    if (result.y < minY) result.y = Math.max(result.y, minY);

    return result;
  }

  private checkPenetration(playerCenter: THREE.Vector3, collider: Collider): THREE.Vector3 | null {
    switch (collider.type) {
      case 'box':
        return this.penetrateBox(playerCenter, collider);
      case 'sphere':
        return this.penetrateSphere(playerCenter, collider);
      case 'cylinder':
        return this.penetrateCylinder(playerCenter, collider);
      default:
        return null;
    }
  }

  private penetrateBox(pc: THREE.Vector3, c: Collider): THREE.Vector3 | null {
    const hs = c.halfSize!;
    const closest = new THREE.Vector3(
      Math.max(c.center.x - hs.x, Math.min(pc.x, c.center.x + hs.x)),
      Math.max(c.center.y - hs.y, Math.min(pc.y, c.center.y + hs.y)),
      Math.max(c.center.z - hs.z, Math.min(pc.z, c.center.z + hs.z)),
    );

    const diff = pc.clone().sub(closest);
    const dist = diff.length();

    if (dist < PLAYER_RADIUS && dist > 0.001) {
      return diff.normalize().multiplyScalar(PLAYER_RADIUS - dist);
    }
    return null;
  }

  private penetrateSphere(pc: THREE.Vector3, c: Collider): THREE.Vector3 | null {
    const diff = pc.clone().sub(c.center);
    const dist = diff.length();
    const minDist = PLAYER_RADIUS + c.radius!;

    if (dist < minDist && dist > 0.001) {
      return diff.normalize().multiplyScalar(minDist - dist);
    }
    return null;
  }

  private penetrateCylinder(pc: THREE.Vector3, c: Collider): THREE.Vector3 | null {
    // Use XZ plane distance for cylinder
    const dx = pc.x - c.center.x;
    const dz = pc.z - c.center.z;
    const xzDist = Math.sqrt(dx * dx + dz * dz);
    const minXZ = PLAYER_RADIUS + c.radius!;

    if (xzDist < minXZ && xzDist > 0.001) {
      const pushX = (dx / xzDist) * (minXZ - xzDist);
      const pushZ = (dz / xzDist) * (minXZ - xzDist);
      return new THREE.Vector3(pushX, 0, pushZ);
    }
    return null;
  }
}
