// ============================================================
// CameraController — Orbit, third-person, and roam cameras
// ============================================================

import * as THREE from 'three';
import type { GameState, CameraMode } from '@monopoly/shared';
import type { FirstPersonController } from '../roam/FirstPersonController';
import { getCharacterTilePos } from '@monopoly/shared';

const ORBIT_MIN = 28;
const ORBIT_MAX = 150;
const ORBIT_DEFAULT = 90;
const THIRD_PERSON_DISTANCE = 18;
const THIRD_PERSON_HEIGHT = 10;

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private mode: CameraMode = 'orbit';

  // Orbit state
  private orbitTarget = new THREE.Vector3(0, 0, 0);
  private orbitDistance = ORBIT_DEFAULT;
  private orbitPhi = Math.PI / 3; // polar angle
  private orbitTheta = Math.PI / 4; // azimuthal angle

  // Input state
  private isDragging = false;
  private prevMouse = new THREE.Vector2();

  private gameState: GameState | null = null;

  // Roam mode
  private fpsController: FirstPersonController | null = null;
  private wasRoaming = false;
  private savedOrbitPos = new THREE.Vector3();
  private savedOrbitQuat = new THREE.Quaternion();
  // Callbacks to get animated character state (set by SceneManager)
  getCharacterPosition: ((playerId: string) => THREE.Vector3 | null) | null = null;
  getCharacterYaw: ((playerId: string) => number | null) | null = null;
  setCharacterVisible: ((playerId: string, visible: boolean) => void) | null = null;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.setupInput();
  }

  private setupInput(): void {
    this.domElement.addEventListener('mousedown', (e) => {
      if (this.mode === 'orbit') this.isDragging = true;
      this.prevMouse.set(e.clientX, e.clientY);
    });
    this.domElement.addEventListener('mouseup', () => { this.isDragging = false; });
    this.domElement.addEventListener('mouseleave', () => { this.isDragging = false; });
    this.domElement.addEventListener('mousemove', (e) => {
      if (!this.isDragging || this.mode !== 'orbit') return;
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.orbitTheta -= dx * 0.005;
      this.orbitPhi -= dy * 0.005;
      this.orbitPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.orbitPhi));
      this.prevMouse.set(e.clientX, e.clientY);
    });
    this.domElement.addEventListener('wheel', (e) => {
      if (this.mode !== 'orbit') return;
      this.orbitDistance += e.deltaY * 0.1;
      this.orbitDistance = Math.max(ORBIT_MIN, Math.min(ORBIT_MAX, this.orbitDistance));
    });

    // Touch
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && this.mode === 'orbit') {
        this.isDragging = true;
        this.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
    this.domElement.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.prevMouse.x;
      const dy = e.touches[0].clientY - this.prevMouse.y;
      this.orbitTheta -= dx * 0.005;
      this.orbitPhi -= dy * 0.005;
      this.orbitPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.orbitPhi));
      this.prevMouse.set(e.touches[0].clientX, e.touches[0].clientY);
    });
    this.domElement.addEventListener('touchend', () => { this.isDragging = false; });
  }

  setFPSController(controller: FirstPersonController): void {
    this.fpsController = controller;
    // When user presses ESC in roam, switch back to orbit
    controller.onExit = () => {
      this.setMode('orbit');
    };
    // When pointer lock is lost (browser Esc key, etc.), also exit roam
    controller.onLockChange = (locked: boolean) => {
      if (!locked && this.mode === 'roam') {
        // Pointer was unlocked externally — switch to orbit without calling exit() again
        this.camera.position.copy(this.savedOrbitPos);
        this.camera.quaternion.copy(this.savedOrbitQuat);
        this.mode = 'orbit';
      }
    };
  }

  setMode(mode: CameraMode): void {
    const prevMode = this.mode;
    this.mode = mode;

    if (prevMode !== 'roam' && mode === 'roam') {
      this.enterRoam();
    } else if (prevMode === 'roam' && mode !== 'roam') {
      this.exitRoam();
    }
  }

  private currentRoamPlayerId: string | null = null;

  private enterRoam(): void {
    if (!this.fpsController) return;
    this.savedOrbitPos.copy(this.camera.position);
    this.savedOrbitQuat.copy(this.camera.quaternion);
    // Start roam at the current player's position on the board
    let groundTarget = new THREE.Vector3(0, 0, 0);
    let targetYaw: number | undefined;
    if (this.gameState) {
      const cp = this.gameState.players[this.gameState.currentPlayerIndex];
      if (cp) {
        // Use character position if available
        const charPos = this.getCharacterPosition?.(cp.id);
        if (charPos) {
          groundTarget.set(charPos.x, 0, charPos.z);
          targetYaw = this.getCharacterYaw?.(cp.id) ?? undefined;
        } else {
          const boardPos = getCharacterTilePos(cp.position);
          groundTarget.set(boardPos.x, 0, boardPos.z);
        }
        // Hide own character for first-person view
        this.currentRoamPlayerId = cp.id;
        this.setCharacterVisible?.(cp.id, false);
      }
    }
    // Camera -Z = forward, character +Z = forward — rotate 180° to align
    if (targetYaw !== undefined) targetYaw += Math.PI;
    this.fpsController.enter(groundTarget, this.savedOrbitQuat, targetYaw);
  }

  private exitRoam(): void {
    if (!this.fpsController) return;
    // Show character again
    if (this.currentRoamPlayerId) {
      this.setCharacterVisible?.(this.currentRoamPlayerId, true);
      this.currentRoamPlayerId = null;
    }
    this.fpsController.exit();
    // Restore camera to the saved orbit position
    this.camera.position.copy(this.savedOrbitPos);
    this.camera.quaternion.copy(this.savedOrbitQuat);
  }

  setGameState(state: GameState): void {
    this.gameState = state;
  }

  update(dt: number, boardGroup?: THREE.Group): void {
    if (this.mode === 'roam' && this.fpsController) {
      if (this.gameState) {
        const cp = this.gameState.players[this.gameState.currentPlayerIndex];
        if (cp) {
          // Use animated character position & yaw
          const charPos = this.getCharacterPosition?.(cp.id);
          if (charPos) {
            this.fpsController.setFollowTarget(new THREE.Vector3(charPos.x, 0, charPos.z));
            // Match camera yaw to character's actual facing direction
            const charYaw = this.getCharacterYaw?.(cp.id);
            if (charYaw !== null && charYaw !== undefined) {
              // Camera -Z = forward, character +Z = forward — rotate 180° to align
              this.fpsController.setFollowYaw(charYaw + Math.PI);
            }
          } else {
            const pos = getCharacterTilePos(cp.position);
            this.fpsController.setFollowTarget(new THREE.Vector3(pos.x, 0, pos.z));
          }
        }
      }
      this.fpsController.update(dt, boardGroup);
      return;
    }

    switch (this.mode) {
      case 'orbit':
        this.updateOrbit();
        break;
      case 'thirdPerson':
        this.updateThirdPerson();
        break;
    }
  }

  private updateOrbit(): void {
    const x = this.orbitTarget.x + this.orbitDistance * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);
    const y = this.orbitTarget.y + this.orbitDistance * Math.cos(this.orbitPhi);
    const z = this.orbitTarget.z + this.orbitDistance * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);

    this.camera.position.lerp(new THREE.Vector3(x, y, z), 0.1);
    this.camera.lookAt(this.orbitTarget);
  }

  private updateThirdPerson(): void {
    if (!this.gameState) { this.updateOrbit(); return; }

    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    if (!currentPlayer) { this.updateOrbit(); return; }

    // Get character position from the board
    const boardPos = getCharacterTilePos(currentPlayer.position);
    const target = new THREE.Vector3(boardPos.x, 0, boardPos.z);

    const behind = new THREE.Vector3(0, THIRD_PERSON_HEIGHT, THIRD_PERSON_DISTANCE);
    const camPos = target.clone().add(behind);

    this.camera.position.lerp(camPos, 0.08);
    this.camera.lookAt(target.clone().add(new THREE.Vector3(0, 2, 0)));
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  isRoaming(): boolean {
    return this.mode === 'roam' && this.fpsController?.isActive === true;
  }
}
