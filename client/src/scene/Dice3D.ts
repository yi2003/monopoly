// ============================================================
// Dice3D — Realistic physics-based dice rolling on a table
// ============================================================

import * as THREE from 'three';

// ---- Constants ----

const DICE_SIZE = 0.8;
const HALF = DICE_SIZE / 2;
const TABLE_Y = 2.1;        // table surface height
const TABLE_SIZE = 3.5;     // table half-width
const GRAVITY = 12;
const RESTITUTION = 0.55;   // bounce energy retention
const FRICTION = 0.7;       // surface friction (per second)
const AIR_DAMPING = 0.3;    // angular velocity air damping
const ROLL_COUPLING = 0.6;  // how much linear velocity converts to spin on contact
const ANIM_DURATION = 2.5;  // total animation seconds
const SETTLE_START = 1.8;   // when to start blending to target

// ---- Dot patterns & face mapping ----

const DOT_PATTERNS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

// Face 0=+Z(1), 1=-Z(6), 2=+Y(2), 3=-Y(5), 4=+X(3), 5=-X(4)
const FACE_VALUES = [1, 6, 2, 5, 3, 4];
const FACE_DIRS = [
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
];

function getTargetQuat(value: number): THREE.Quaternion {
  const faceIdx = FACE_VALUES.indexOf(value);
  if (faceIdx < 0) {
    // Fallback: just use identity
    return new THREE.Quaternion().identity();
  }
  return new THREE.Quaternion().setFromUnitVectors(
    FACE_DIRS[faceIdx], new THREE.Vector3(0, 1, 0),
  );
}

// ---- Die physics state ----

interface DiePhysics {
  group: THREE.Group;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;      // world position
  vel: THREE.Vector3;      // linear velocity
  angVel: THREE.Vector3;   // angular velocity (axis * rad/s)
  quat: THREE.Quaternion;  // current rotation
  onGround: boolean;
  targetQuat: THREE.Quaternion;
  settleStartQuat: THREE.Quaternion;
}

export class Dice3D {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private tableGroup: THREE.Group;
  private die1: DiePhysics;
  private die2: DiePhysics;

  private animating = false;
  private animTime = 0;
  private settling = false;
  private started = false;

  onAnimationDone: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'dice3D';
    this.group.visible = false;
    this.scene.add(this.group);

    // ---- Rolling table ----
    this.tableGroup = new THREE.Group();

    // Table surface (green felt)
    const tableGeo = new THREE.BoxGeometry(TABLE_SIZE * 2, 0.15, TABLE_SIZE * 2);
    const tableMat = new THREE.MeshStandardMaterial({ color: '#2E5D2E', roughness: 0.85 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = TABLE_Y - 0.075;
    table.receiveShadow = true;
    table.name = 'diceTable';
    this.tableGroup.add(table);

    // Felt border/rail
    const railGeo = new THREE.BoxGeometry(TABLE_SIZE * 2 + 0.4, 0.5, 0.4);
    const railMat = new THREE.MeshStandardMaterial({ color: '#4E342E', roughness: 0.4, metalness: 0.2 });
    for (const [dx, dz] of [[0, TABLE_SIZE], [0, -TABLE_SIZE], [TABLE_SIZE, 0], [-TABLE_SIZE, 0]]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(dx, TABLE_Y + 0.25, dz);
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.tableGroup.add(rail);
    }

    // Corner posts
    const postGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.8, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: '#3E2723', roughness: 0.3, metalness: 0.3 });
    for (const [cx, cz] of [
      [TABLE_SIZE + 0.2, TABLE_SIZE + 0.2], [TABLE_SIZE + 0.2, -TABLE_SIZE - 0.2],
      [-TABLE_SIZE - 0.2, TABLE_SIZE + 0.2], [-TABLE_SIZE - 0.2, -TABLE_SIZE - 0.2],
    ]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(cx, TABLE_Y + 0.35, cz);
      post.castShadow = true;
      this.tableGroup.add(post);
    }

    this.group.add(this.tableGroup);

    // ---- Dice ----
    this.die1 = this.createDiePhysics(0, TABLE_Y + 2.5, 0);
    this.die2 = this.createDiePhysics(999, -999, 999); // hidden off-screen

    this.group.add(this.die1.group);
    this.group.add(this.die2.group);

    // ---- Lighting ----
    const spotGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const spotMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.1, emissive: '#FFFFFF', emissiveIntensity: 2.5 });
    for (const [sx, sz] of [[-4, 3], [4, 3], [0, -4]]) {
      const spot = new THREE.Mesh(spotGeo, spotMat);
      spot.position.set(sx, TABLE_Y + 5, sz);
      this.group.add(spot);
    }
  }

  private createDiePhysics(x: number, y: number, z: number): DiePhysics {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const mesh = this.createDieMesh();
    group.add(mesh);

    return {
      group, mesh,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      onGround: false,
      targetQuat: new THREE.Quaternion(),
      settleStartQuat: new THREE.Quaternion(),
    };
  }

  private createDieMesh(): THREE.Mesh {
    const size = DICE_SIZE;
    // Use a box with rounded look via beveled segments
    const geo = new THREE.BoxGeometry(size, size, size, 2, 2, 2);

    // Slightly round corners by displacing vertices
    const positions = geo.attributes.position;
    const rounded = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      // Pull corners inward slightly for rounded effect
      const fx = Math.abs(x) / (size / 2);
      const fy = Math.abs(y) / (size / 2);
      const fz = Math.abs(z) / (size / 2);
      const cornerFactor = fx * fy * fz; // high only at corners
      const pull = 1 - cornerFactor * 0.12;
      rounded[i * 3] = x * pull;
      rounded[i * 3 + 1] = y * pull;
      rounded[i * 3 + 2] = z * pull;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(rounded, 3));
    geo.computeVertexNormals();

    // Face textures
    const materials: THREE.MeshStandardMaterial[] = [];
    for (let face = 0; face < 6; face++) {
      const canvas = this.createFaceTexture(FACE_VALUES[face]);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      materials.push(new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.02,
      }));
    }

    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createFaceTexture(value: number): HTMLCanvasElement {
    const sz = 128;
    const canvas = document.createElement('canvas');
    canvas.width = sz;
    canvas.height = sz;
    const ctx = canvas.getContext('2d')!;

    // Ivory background with subtle gradient
    const grad = ctx.createRadialGradient(sz / 2, sz / 2, sz * 0.1, sz / 2, sz / 2, sz * 0.7);
    grad.addColorStop(0, '#FFFFF0');
    grad.addColorStop(0.7, '#F5F0E0');
    grad.addColorStop(1, '#E8E0C8');
    ctx.fillStyle = grad;
    ctx.fillRect(2, 2, sz - 4, sz - 4);

    // Subtle rounded border
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, sz - 8, sz - 8, 14);
    ctx.stroke();

    // Dots with slight 3D shading
    const dots = DOT_PATTERNS[value] || [];
    const dotR = 13;
    const margin = 26;
    const spacing = (sz - margin * 2) / 2;

    for (const [row, col] of dots) {
      const cx = margin + col * spacing;
      const cy = margin + row * spacing;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy + 1.5, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      const dotGrad = ctx.createRadialGradient(cx - dotR * 0.3, cy - dotR * 0.3, dotR * 0.1, cx, cy, dotR);
      dotGrad.addColorStop(0, '#3a3a3a');
      dotGrad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  }

  // ---- Public API ----

  roll(die1: number, die2: number): void {
    // Target rotations (final face-up values)
    this.die1.targetQuat.copy(getTargetQuat(die1));
    this.die2.targetQuat.copy(getTargetQuat(die2));

    // Random initial toss for each die, offset left and right
    const tossHeight1 = TABLE_Y + 2.5 + Math.random() * 2;
    const tossX1 = -1.2 + (Math.random() - 0.5) * 0.8;
    const tossZ1 = (Math.random() - 0.5) * 1.0;
    this.resetDie(this.die1, tossX1, tossHeight1, tossZ1);

    const tossHeight2 = TABLE_Y + 2.5 + Math.random() * 2;
    const tossX2 = 1.2 + (Math.random() - 0.5) * 0.8;
    const tossZ2 = (Math.random() - 0.5) * 1.0;
    this.resetDie(this.die2, tossX2, tossHeight2, tossZ2);

    // Show both dice
    this.die2.group.visible = true;

    // Show the table
    this.group.visible = true;
    this.animating = true;
    this.settling = false;
    this.animTime = 0;
    this.started = false;

    // Small delay before physics starts (like hand releasing)
  }

  private resetDie(d: DiePhysics, x: number, y: number, z: number): void {
    d.pos.set(x, y, z);
    // Random initial spin
    d.angVel.set(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 10,
    );
    // Initial horizontal velocity toward center
    d.vel.set(
      -x * 0.3 + (Math.random() - 0.5) * 2,
      0,
      -z * 0.3 + (Math.random() - 0.5) * 2,
    );
    d.quat.random(); // random initial rotation
    d.onGround = false;
    d.group.position.copy(d.pos);
    d.group.quaternion.copy(d.quat);
  }

  update(dt: number): void {
    if (!this.animating) return;

    // Small startup delay
    if (!this.started) {
      this.animTime += dt;
      if (this.animTime < 0.15) return; // brief hold before release
      this.started = true;
    }

    this.animTime += dt;
    const progress = Math.min(this.animTime / ANIM_DURATION, 1);

    // Physics step (sub-step for stability)
    const subSteps = 2;
    const subDt = dt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this.stepDie(this.die1, subDt, progress);
      this.stepDie(this.die2, subDt, progress);
    }

    // Check if settling phase
    if (progress >= SETTLE_START / ANIM_DURATION && !this.settling) {
      this.settling = true;
      this.die1.settleStartQuat.copy(this.die1.quat);
      this.die2.settleStartQuat.copy(this.die2.quat);
    }

    // Settling: blend to target rotation
    if (this.settling) {
      const settleProgress = (progress - SETTLE_START / ANIM_DURATION) / (1 - SETTLE_START / ANIM_DURATION);
      const t = this.smoothstep(settleProgress);
      this.die1.quat.slerpQuaternions(this.die1.settleStartQuat, this.die1.targetQuat, t);
      this.die2.quat.slerpQuaternions(this.die2.settleStartQuat, this.die2.targetQuat, t);

      // Gently push dice down to table surface during settle
      this.die1.pos.y = THREE.MathUtils.lerp(this.die1.pos.y, TABLE_Y + HALF, t * 0.5);
      this.die2.pos.y = THREE.MathUtils.lerp(this.die2.pos.y, TABLE_Y + HALF, t * 0.5);
    }

    // Apply rotations
    this.die1.group.position.copy(this.die1.pos);
    this.die2.group.position.copy(this.die2.pos);
    this.die1.group.quaternion.copy(this.die1.quat);
    this.die2.group.quaternion.copy(this.die2.quat);

    // Done
    if (progress >= 1) {
      // Snap to exact final positions
      this.die1.pos.set(-1.2, TABLE_Y + HALF, 0);
      this.die1.quat.copy(this.die1.targetQuat);
      this.die1.group.position.copy(this.die1.pos);
      this.die1.group.quaternion.copy(this.die1.quat);

      this.die2.pos.set(1.2, TABLE_Y + HALF, 0);
      this.die2.quat.copy(this.die2.targetQuat);
      this.die2.group.position.copy(this.die2.pos);
      this.die2.group.quaternion.copy(this.die2.quat);

      // Hold then hide
      setTimeout(() => {
        this.group.visible = false;
        this.animating = false;
        this.onAnimationDone?.();
      }, 700);
    }
  }

  /** Single die physics step */
  private stepDie(d: DiePhysics, dt: number, _progress: number): void {
    // Gravity
    d.vel.y -= GRAVITY * dt;

    // Update position
    d.pos.x += d.vel.x * dt;
    d.pos.y += d.vel.y * dt;
    d.pos.z += d.vel.z * dt;

    // Angular velocity damping (air resistance)
    d.angVel.multiplyScalar(1 - AIR_DAMPING * dt);

    // Update rotation from angular velocity
    const angSpeed = d.angVel.length();
    if (angSpeed > 0.001) {
      const axis = d.angVel.clone().normalize();
      const angle = angSpeed * dt;
      const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      d.quat.multiply(dq);
      d.quat.normalize();
    }

    // ---- Ground collision ----
    const groundY = TABLE_Y + HALF;
    if (d.pos.y <= groundY) {
      d.pos.y = groundY;
      d.onGround = true;

      // Bounce
      if (d.vel.y < 0) {
        d.vel.y = Math.abs(d.vel.y) * RESTITUTION;
        // Reduce bounce if very small
        if (Math.abs(d.vel.y) < 0.5) d.vel.y = 0;
      }

      // Friction on horizontal velocity
      const frictionFactor = Math.pow(1 - FRICTION, dt * 60);
      d.vel.x *= frictionFactor;
      d.vel.z *= frictionFactor;

      // Rolling coupling: surface motion transfers to spin
      const surfSpeed = Math.sqrt(d.vel.x ** 2 + d.vel.z ** 2);
      if (surfSpeed > 0.01) {
        const rollAxis = new THREE.Vector3(-d.vel.z, 0, d.vel.x).normalize();
        const rollAngVel = (surfSpeed / HALF) * ROLL_COUPLING;
        // Apply rolling spin
        d.angVel.add(rollAxis.multiplyScalar(rollAngVel * dt * 8));
        // Clamp angular velocity
        const maxAng = 25;
        if (d.angVel.length() > maxAng) {
          d.angVel.normalize().multiplyScalar(maxAng);
        }
      }
    } else {
      d.onGround = false;
    }

    // Contain within table bounds
    const boundX = TABLE_SIZE - HALF - 0.2;
    const boundZ = TABLE_SIZE - HALF - 0.2;
    if (Math.abs(d.pos.x) > boundX) {
      d.pos.x = Math.sign(d.pos.x) * boundX;
      d.vel.x *= -RESTITUTION * 0.6;
    }
    if (Math.abs(d.pos.z) > boundZ) {
      d.pos.z = Math.sign(d.pos.z) * boundZ;
      d.vel.z *= -RESTITUTION * 0.6;
    }

    // When settling, dampen everything more
    if (this.settling) {
      d.vel.multiplyScalar(0.85);
      d.angVel.multiplyScalar(0.85);
    }
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  dispose(): void {
    this.scene.remove(this.group);
    const disposeMesh = (m: THREE.Mesh) => {
      m.geometry.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach(mat => {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (stdMat.map) stdMat.map.dispose();
          stdMat.dispose();
        });
      }
    };
    disposeMesh(this.die1.mesh);
    disposeMesh(this.die2.mesh);
    this.group.traverse(c => {
      if (c instanceof THREE.Mesh && c.name !== '') {
        c.geometry.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
    this.group.clear();
  }
}
