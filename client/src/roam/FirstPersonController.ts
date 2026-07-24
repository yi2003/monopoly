// ============================================================
// FirstPersonController — WASD + mouse PointerLock FPS controls
// ============================================================

import * as THREE from 'three';
import { RoamCollision } from './RoamCollision';

const WALK_SPEED = 1.8;
const SPRINT_SPEED = 3.2;
const EYE_HEIGHT = 1.65;
const HEAD_BOB_AMP = 0.04;
const HEAD_BOB_FREQ = 10;
const DEFAULT_FOV = 75;
const ACCELERATION = 12;
const MOUSE_SENSITIVITY = 0.002;

export class FirstPersonController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private collision: RoamCollision;

  // Player state
  private position: THREE.Vector3;
  private velocity = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ'); // yaw-pitch order
  private isLocked = false;
  private isSprinting = false;
  private headBobPhase = 0;
  private fov = DEFAULT_FOV;
  private targetFov = DEFAULT_FOV;

  // Input state
  private keys: Record<string, boolean> = {};
  private moveDir = new THREE.Vector3();

  // Click-to-teleport
  private raycaster = new THREE.Raycaster();
  private teleportTarget: THREE.Vector3 | null = null;
  private teleportAlpha = 0;
  private boardGroup: THREE.Group | null = null;

  // Follow target (tracking player position)
  private followTarget: THREE.Vector3 | null = null;
  private followYaw: number | null = null; // target yaw for corner turns

  // Callbacks
  onExit: (() => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  // Smooth transition
  private transitioningIn = false;
  private transitionProgress = 0;
  private transitionFrom = new THREE.Vector3();
  private transitionFromEuler = new THREE.Euler();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, collision: RoamCollision) {
    this.camera = camera;
    this.domElement = domElement;
    this.collision = collision;
    this.position = camera.position.clone();
    this.euler.setFromQuaternion(camera.quaternion);
    this.fov = camera.fov;
    this.targetFov = DEFAULT_FOV;

    this.setupInput();
  }

  private setupInput(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.isSprinting = true;
      if (e.code === 'Escape' && this.isLocked) {
        // Release pointer lock and notify CameraController
        document.exitPointerLock();
        this.isLocked = false;
        this.onExit?.();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.isSprinting = false;
    });

    // Mouse — click to lock pointer for look control
    this.domElement.addEventListener('click', (e) => {
      if (!this.isLocked && !this.transitioningIn) {
        this.lock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= e.movementX * MOUSE_SENSITIVITY;
      this.euler.x -= e.movementY * MOUSE_SENSITIVITY;
      // Clamp pitch
      this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });

    // Pointer lock change — informational only, no side effects
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (!this.isLocked) {
        this.onLockChange?.(false);
      }
    });

    // Touch controls for mobile
    this.setupTouchControls();
  }

  // ---- Mobile Virtual Joystick ----

  private touchState = {
    moveActive: false,
    moveStart: new THREE.Vector2(),
    moveCurrent: new THREE.Vector2(),
    lookActive: false,
    lookPrev: new THREE.Vector2(),
  };

  private setupTouchControls(): void {
    this.domElement.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const rect = this.domElement.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;

        // Left half = move joystick, right half = look
        if (x < rect.width / 2 && !this.touchState.moveActive) {
          this.touchState.moveActive = true;
          this.touchState.moveStart.set(x, y);
          this.touchState.moveCurrent.set(x, y);
        } else if (x >= rect.width / 2 && !this.touchState.lookActive) {
          this.touchState.lookActive = true;
          this.touchState.lookPrev.set(t.clientX, t.clientY);
        }
      }
    });

    this.domElement.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.domElement.getBoundingClientRect();

      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const x = t.clientX - rect.left;

        if (x < rect.width / 2 && this.touchState.moveActive) {
          this.touchState.moveCurrent.set(t.clientX - rect.left, t.clientY - rect.top);
        } else if (x >= rect.width / 2 && this.touchState.lookActive) {
          const dx = t.clientX - this.touchState.lookPrev.x;
          const dy = t.clientY - this.touchState.lookPrev.y;
          this.euler.y -= dx * MOUSE_SENSITIVITY * 1.5;
          this.euler.x -= dy * MOUSE_SENSITIVITY * 1.5;
          this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));
          this.camera.quaternion.setFromEuler(this.euler);
          this.touchState.lookPrev.set(t.clientX, t.clientY);
        }
      }
    });

    this.domElement.addEventListener('touchend', (e) => {
      // Clear ended touches
      this.touchState.moveActive = false;
      this.touchState.lookActive = false;
    });
  }

  // ---- Lifecycle ----

  /** Enter roam mode with smooth transition from current camera to target position, facing targetYaw */
  enter(targetPosition?: THREE.Vector3, fromQuaternion?: THREE.Quaternion, targetYaw?: number): void {
    // Visual transition starts from current camera position (orbit height)
    this.transitionFrom.copy(this.camera.position);
    if (fromQuaternion) {
      this.transitionFromEuler.setFromQuaternion(fromQuaternion);
    }
    this.transitioningIn = true;
    this.transitionProgress = 0;
    // FPS position = target ground position (defaults to camera x,z projected to ground)
    if (targetPosition) {
      this.position.copy(targetPosition);
    } else {
      this.position.set(this.camera.position.x, 0, this.camera.position.z);
    }
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.x = 0; // reset pitch
    // Face toward the street based on which board side the player is on
    if (targetYaw !== undefined) {
      this.euler.y = targetYaw;
      // Also update transition from euler yaw to target yaw (keep pitch transition)
      this.transitionFromEuler.y = this.euler.y;
    }
    this.velocity.set(0, 0, 0);
    this.camera.fov = this.fov;
  }

  setBoardGroup(group: THREE.Group | null): void {
    this.boardGroup = group;
  }

  private tryTeleport(clientX: number, clientY: number): void {
    if (!this.boardGroup) return;

    const rect = this.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(mouse, this.camera);

    // Cast against board group and any walkable surfaces
    const intersects = this.raycaster.intersectObjects(this.boardGroup.children, true);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      // Only teleport if on walkable surface (y near 0-1)
      if (point.y >= -0.5 && point.y <= 2.0) {
        this.teleportTarget = point.clone();
        this.teleportTarget.y = this.collision.getGroundHeight(point.x, point.z) + 0.01;
        this.teleportAlpha = 0;
      }
    }
  }

  exit(): void {
    document.exitPointerLock();
    // isLocked will be set to false by pointerlockchange event
  }

  lock(): void {
    this.domElement.requestPointerLock();
  }

  setCollision(c: RoamCollision): void {
    this.collision = c;
  }

  /** Set a world position for the camera to smoothly follow (player's board position) */
  setFollowTarget(target: THREE.Vector3): void {
    this.followTarget = target.clone();
  }

  /** Set target yaw for corner-turn rotation (radians) */
  setFollowYaw(yaw: number): void {
    this.followYaw = yaw;
  }

  setFov(fov: number): void {
    this.targetFov = Math.max(65, Math.min(90, fov));
  }

  // ---- Update (called each frame) ----

  update(dt: number, boardGroup?: THREE.Group): void {
    if (boardGroup && boardGroup !== this.boardGroup) {
      this.boardGroup = boardGroup;
    }

    const delta = Math.min(dt, 0.1); // cap dt

    // Always process transition and follow-target, even without pointer lock
    if (this.transitioningIn) {
      this.transitionProgress += delta * 2; // 0.5 second transition
      if (this.transitionProgress >= 1) {
        this.transitioningIn = false;
        this.transitionProgress = 1;
      }
    }

    // Track player position — snap tightly for first-person feel (no lerp lag)
    if (this.followTarget && this.moveDir.lengthSq() < 0.01 && !this.transitioningIn) {
      const dx = this.followTarget.x - this.position.x;
      const dz = this.followTarget.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.02) {
        // Snap to character's exact position (no lerp = no behind-the-player lag)
        this.position.x = this.followTarget.x;
        this.position.z = this.followTarget.z;
      }
    }

    // Rotate to follow yaw when not manually looking (corner turns)
    if (this.followYaw !== null && this.moveDir.lengthSq() < 0.01 && !this.transitioningIn) {
      // Normalize angle difference
      let diff = this.followYaw - this.euler.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.05) {
        this.euler.y += diff * Math.min(5 * delta, 1);
      } else if (Math.abs(diff) > 0.005) {
        this.euler.y = this.followYaw;
        this.followYaw = null;
      } else {
        this.followYaw = null;
      }
    }

    // Input & physics only when pointer is locked (or during transition)
    if (this.isLocked || this.transitioningIn) {
      // Handle teleport
      if (this.teleportTarget) {
        this.teleportAlpha = Math.min(1, this.teleportAlpha + delta * 3);
        if (this.teleportAlpha >= 1) {
          this.position.copy(this.teleportTarget);
          this.velocity.set(0, 0, 0);
          this.teleportTarget = null;
          this.teleportAlpha = 0;
        }
      }

      // Compute movement input
      this.moveDir.set(0, 0, 0);
      if (this.keys['KeyW'] || this.keys['ArrowUp']) this.moveDir.z += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) this.moveDir.z -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.moveDir.x -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) this.moveDir.x += 1;

      // Mobile joystick input
      if (this.touchState.moveActive) {
        const dx = this.touchState.moveCurrent.x - this.touchState.moveStart.x;
        const dy = this.touchState.moveCurrent.y - this.touchState.moveStart.y;
        const maxDist = 60;
        this.moveDir.x = THREE.MathUtils.clamp(dx / maxDist, -1, 1);
        this.moveDir.z = THREE.MathUtils.clamp(-dy / maxDist, -1, 1);
        this.isSprinting = Math.sqrt(dx * dx + dy * dy) > maxDist * 0.7;
      }

      if (this.moveDir.lengthSq() > 1) this.moveDir.normalize();

      // Speed
      const maxSpeed = this.isSprinting ? SPRINT_SPEED : WALK_SPEED;
      const targetVel = this.moveDir.clone().multiplyScalar(maxSpeed);

      // Apply movement in camera-relative directions
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.euler.y, 0)),
      );
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.euler.y, 0)),
      );

      const worldMove = new THREE.Vector3()
        .add(forward.clone().multiplyScalar(targetVel.z))
        .add(right.clone().multiplyScalar(targetVel.x));

      // Smooth acceleration
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, worldMove.x, Math.min(ACCELERATION * delta, 1));
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, worldMove.z, Math.min(ACCELERATION * delta, 1));

      // Apply gravity (simple — snap to ground)
      const groundH = this.collision.getGroundHeight(this.position.x, this.position.z);
      if (this.position.y > groundH + 0.05) {
        this.velocity.y -= 9.8 * delta; // gravity
      } else {
        this.velocity.y = 0;
        this.position.y = groundH;
      }

      // Resolve collisions
      const moveDelta = new THREE.Vector3(
        this.velocity.x * delta,
        this.velocity.y * delta,
        this.velocity.z * delta,
      );
      const resolved = this.collision.resolveMovement(this.position, moveDelta);

      this.position.add(resolved);
      this.position.y = Math.max(groundH, this.position.y);
    } else {
      // When unlocked, just apply gravity to bring position to ground
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
      const groundH = this.collision.getGroundHeight(this.position.x, this.position.z);
      if (this.position.y > groundH + 0.05) {
        this.velocity.y -= 9.8 * delta;
      } else {
        this.velocity.y = 0;
        this.position.y = groundH;
      }
      this.position.y += this.velocity.y * delta;
      this.position.y = Math.max(groundH, this.position.y);
    }

    // Head bob
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    if (speed > 0.1) {
      this.headBobPhase += delta * HEAD_BOB_FREQ * (speed / WALK_SPEED);
    } else {
      this.headBobPhase *= 0.9; // decay
    }
    const bob = speed > 0.1 ? Math.sin(this.headBobPhase) * HEAD_BOB_AMP : 0;

    // FOV transition (sprint widens FOV)
    this.targetFov = this.isSprinting && speed > SPRINT_SPEED * 0.5 ? DEFAULT_FOV + 5 : DEFAULT_FOV;
    this.fov = THREE.MathUtils.lerp(this.fov, this.targetFov, 5 * delta);

    // Apply to camera
    const targetCamPos = new THREE.Vector3(
      this.position.x,
      this.position.y + EYE_HEIGHT + bob,
      this.position.z,
    );

    if (this.transitioningIn) {
      const t = this.easeInOutCubic(this.transitionProgress);
      this.camera.position.lerpVectors(this.transitionFrom, targetCamPos, t);
      // Smoothly rotate from orbit orientation to roam (pitch=0, yaw preserved)
      const interpEuler = new THREE.Euler(
        THREE.MathUtils.lerp(this.transitionFromEuler.x, this.euler.x, t),
        THREE.MathUtils.lerp(this.transitionFromEuler.y, this.euler.y, t),
        THREE.MathUtils.lerp(this.transitionFromEuler.z, this.euler.z, t),
        this.transitionFromEuler.order,
      );
      this.camera.quaternion.setFromEuler(interpEuler);
    } else if (this.teleportTarget) {
      // Fade-out/in during teleport
      const fadeT = this.teleportAlpha;
      const midPos = this.position.clone().lerp(this.teleportTarget, 0.5);
      midPos.y += 3 * Math.sin(fadeT * Math.PI); // arc up then down
      this.camera.position.copy(midPos);
      this.camera.quaternion.setFromEuler(this.euler);
    } else {
      this.camera.position.copy(targetCamPos);
      this.camera.quaternion.setFromEuler(this.euler);
    }
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  get isActive(): boolean {
    return this.isLocked || this.transitioningIn;
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  dispose(): void {
    document.exitPointerLock();
  }
}
