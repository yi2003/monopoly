// ============================================================
// SceneManager — Three.js scene orchestration
// ============================================================

import * as THREE from 'three';
import type { GameState, CameraMode, QualityMode, WeatherType } from '@monopoly/shared';
import { CameraController } from '../camera/CameraController';
import { FirstPersonController } from '../roam/FirstPersonController';
import { RoamCollision } from '../roam/RoamCollision';
import { Board } from './Board';
import { Characters } from './Characters';
import { Houses } from './Houses';
import { Effects } from './Effects';
import { DayNightCycle } from './DayNightCycle';
import { WeatherEffects } from './WeatherEffects';
import { CityBuilder } from './CityBuilder';
import { Pedestrians } from './Pedestrians';
import { Vehicles } from './Vehicles';
import { NightGlow } from './NightGlow';
import { Dice3D } from './Dice3D';
import { audioManager } from '../audio/AudioManager';

export class SceneManager {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  private cameraController!: CameraController;
  private fpsController!: FirstPersonController;
  private roamCollision!: RoamCollision;
  private board!: Board;
  private characters!: Characters;
  private houses!: Houses;
  private effects!: Effects;

  // New systems
  private dayNightCycle!: DayNightCycle;
  private weatherEffects!: WeatherEffects;
  private cityBuilder!: CityBuilder;
  private pedestrians!: Pedestrians;
  private vehicles!: Vehicles;
  private nightGlow!: NightGlow;
  private dice3D!: Dice3D;

  private gameState: GameState | null = null;
  private qualityMode: QualityMode = 'balanced';
  private cameraMode: CameraMode = 'orbit';
  private prevWeather: WeatherType = 'clear';
  private prevDayTime = 0.3;
  private prevDiceVal: string | null = null; // "die1,die2" for comparison
  private initialized = false;

  // Road paths for vehicles (computed from city layout)
  private roadPaths: THREE.Vector3[][] = [];
  // Walk zones for pedestrians
  private walkZones: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
  }

  init(quality: QualityMode): void {
    this.qualityMode = quality;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'performance' ? 1.0 : 1.5));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = quality === 'balanced';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#87CEEB');
    this.scene.fog = new THREE.Fog('#87CEEB', 40, 180);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.5,
      500,
    );
    this.camera.position.set(0, 70, 80);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    this.setupLighting();

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#3a7d3a', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    // Roam collision
    this.roamCollision = new RoamCollision();

    // Sub-systems
    this.board = new Board(this.scene);
    this.characters = new Characters(this.scene);
    this.houses = new Houses(this.scene);
    this.effects = new Effects(this.scene);

    // Day/night cycle (depends on lights)
    const sun = this.scene.userData.sun as THREE.DirectionalLight;
    const ambient = this.scene.userData.ambient as THREE.AmbientLight;
    const hemi = this.scene.userData.hemi as THREE.HemisphereLight;
    this.dayNightCycle = new DayNightCycle(this.scene, sun, ambient, hemi);

    // Weather effects
    this.weatherEffects = new WeatherEffects(this.scene);

    // Night glow manager
    this.nightGlow = new NightGlow();

    // Procedural city
    this.cityBuilder = new CityBuilder(this.scene);
    this.cityBuilder.build();
    this.nightGlow.registerAll(this.cityBuilder.nightGlowMaterials);
    this.nightGlow.autoRegisterFromScene(this.scene);

    // Pedestrians & Vehicles
    this.pedestrians = new Pedestrians(this.scene);
    this.vehicles = new Vehicles(this.scene);

    // Compute road paths and walk zones from board + city layout
    this.computePaths();

    // Camera controller
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    // FPS controller
    this.fpsController = new FirstPersonController(this.camera, this.renderer.domElement, this.roamCollision);
    this.cameraController.setFPSController(this.fpsController);

    // Wire character state callbacks for roam camera follow
    this.cameraController.getCharacterPosition = (playerId: string) => {
      return this.characters.getCharacterPosition(playerId);
    };
    this.cameraController.getCharacterYaw = (playerId: string) => {
      return this.characters.getCharacterYaw(playerId);
    };
    this.cameraController.setCharacterVisible = (playerId: string, visible: boolean) => {
      this.characters.setCharacterVisible(playerId, visible);
    };

    // Register building colliders for roam mode
    this.cityBuilder.registerColliders(
      (center, halfSize) => this.roamCollision.addBox(center, halfSize),
    );

    // Set board group for teleport raycasting
    this.fpsController.setBoardGroup(this.board.boardGroup);

    // 3D Dice
    this.dice3D = new Dice3D(this.scene);
    this.dice3D.setPosition(0, 0, 0);

    // Apply quality mode to city sub-systems
    this.cityBuilder.setQuality(quality);
    this.pedestrians.setDensity(quality === 'performance' ? 0.5 : 1.0);
    this.vehicles.setDensity(quality === 'performance' ? 0.5 : 1.0);

    this.initialized = true;
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight('#ffffff', 0.4);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight('#87CEEB', '#3a7d3a', 0.6);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#ffffff', 1.0);
    sun.position.set(50, 80, 30);
    sun.castShadow = this.qualityMode === 'balanced';
    if (sun.castShadow) {
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 300;
      sun.shadow.camera.left = -80;
      sun.shadow.camera.right = 80;
      sun.shadow.camera.top = 80;
      sun.shadow.camera.bottom = -80;
      sun.shadow.bias = -0.0001;
    }
    this.scene.add(sun);

    this.scene.userData.sun = sun;
    this.scene.userData.ambient = ambient;
    this.scene.userData.hemi = hemi;
  }

  /** Compute road paths and walk zones for NPC navigation */
  private computePaths(): void {
    const BOARD_HALF_TILES = 5.0 + 7 * 2.8;
    const TILE_D = 5.5;
    const SIDEWALK_WIDTH = 2.0;
    const ROAD_WIDTH = 4.0;

    const outerOffset = TILE_D / 2 + SIDEWALK_WIDTH + ROAD_WIDTH / 2;

    // Four road paths around the board (outer ring)
    const paths: THREE.Vector3[][] = [
      // Bottom road (east-west)
      [
        new THREE.Vector3(-BOARD_HALF_TILES - 20, 0, -BOARD_HALF_TILES - outerOffset),
        new THREE.Vector3(BOARD_HALF_TILES + 20, 0, -BOARD_HALF_TILES - outerOffset),
      ],
      // Top road
      [
        new THREE.Vector3(-BOARD_HALF_TILES - 20, 0, BOARD_HALF_TILES + outerOffset),
        new THREE.Vector3(BOARD_HALF_TILES + 20, 0, BOARD_HALF_TILES + outerOffset),
      ],
      // Left road (north-south)
      [
        new THREE.Vector3(-BOARD_HALF_TILES - outerOffset, 0, -BOARD_HALF_TILES - 20),
        new THREE.Vector3(-BOARD_HALF_TILES - outerOffset, 0, BOARD_HALF_TILES + 20),
      ],
      // Right road
      [
        new THREE.Vector3(BOARD_HALF_TILES + outerOffset, 0, -BOARD_HALF_TILES - 20),
        new THREE.Vector3(BOARD_HALF_TILES + outerOffset, 0, BOARD_HALF_TILES + 20),
      ],
      // Inner cross roads
      [
        new THREE.Vector3(-30, 0, 0),
        new THREE.Vector3(30, 0, 0),
      ],
      [
        new THREE.Vector3(0, 0, -30),
        new THREE.Vector3(0, 0, 30),
      ],
    ];

    this.roadPaths = paths;
    this.vehicles.setRoadPaths(paths);

    // Walk zones along sidewalks
    const walkOffset = TILE_D / 2 + SIDEWALK_WIDTH / 2;
    for (let side = 0; side < 4; side++) {
      const isHorizontal = side % 2 === 0;
      const sign = side < 2 ? -1 : 1;
      const length = 60;
      const start = isHorizontal
        ? new THREE.Vector3(-length / 2, 0, sign * (BOARD_HALF_TILES + walkOffset))
        : new THREE.Vector3(sign * (BOARD_HALF_TILES + walkOffset), 0, -length / 2);
      const end = isHorizontal
        ? new THREE.Vector3(length / 2, 0, sign * (BOARD_HALF_TILES + walkOffset))
        : new THREE.Vector3(sign * (BOARD_HALF_TILES + walkOffset), 0, length / 2);
      this.walkZones.push({ start, end });
    }

    this.pedestrians.setWalkZones(this.walkZones);
  }

  // ---- Per-frame update ----

  render(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Advance day/night cycle
    this.dayNightCycle.advance(dt);
    this.dayNightCycle.update();

    // Update weather effects
    this.weatherEffects.update(dt);

    // Update NPCs
    this.pedestrians.update(dt);
    this.vehicles.update(dt);

    // Night glow
    this.nightGlow.setNightFactor(this.dayNightCycle.nightFactor);

    // Notify audio system of night factor
    audioManager.setNightFactor(this.dayNightCycle.nightFactor);

    // Update camera
    this.cameraController.update(dt, this.board.boardGroup);

    // Update characters
    this.characters.update(dt);

    // Update particle effects
    this.effects.update(dt);

    // Board continuous animations (chance cube spin, etc.)
    this.board.updateTime(dt);

    // 3D dice animation
    this.dice3D.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  // ---- State sync ----

  updateState(state: GameState): void {
    this.gameState = state;
    this.board.update(state);
    this.characters.updateState(state);
    this.houses.updateState(state);
    this.effects.updateState(state);
    this.cameraController.setGameState(state);

    // Sync day/night cycle from server
    if (state.dayTime !== this.prevDayTime) {
      this.dayNightCycle.setDayTime(state.dayTime);
      this.prevDayTime = state.dayTime;
    }

    // Sync weather from server
    if (state.weather !== this.prevWeather) {
      this.weatherEffects.setWeather(state.weather);
      audioManager.setWeatherSound(state.weather);
      this.prevWeather = state.weather;
    }

    // Trigger 3D dice roll animation when new dice appear
    const diceId = state.dice !== null
      ? `${state.dice.die1},${state.dice.die2}`
      : null;
    if (diceId !== null && diceId !== this.prevDiceVal) {
      this.dice3D.roll(state.dice!.die1, state.dice!.die2);
      audioManager.playDice();
    }
    this.prevDiceVal = diceId;

    // Sync theme for NPC and city visuals
    this.cityBuilder.setTheme(state.config.theme);
    this.pedestrians.setTheme(state.config.theme);
    this.vehicles.setTheme(state.config.theme);
  }

  // ---- Camera & Quality ----

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.cameraController.setMode(mode);
  }

  setRoamFov(fov: number): void {
    this.fpsController.setFov(fov);
  }

  setQualityMode(quality: QualityMode): void {
    this.qualityMode = quality;
    const isBalanced = quality === 'balanced';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isBalanced ? 1.5 : 1.0));
    this.renderer.shadowMap.enabled = isBalanced;
    if (this.scene.userData.sun) {
      (this.scene.userData.sun as THREE.DirectionalLight).castShadow = isBalanced;
    }
    this.weatherEffects.setEnabled(isBalanced);
    this.cityBuilder.setQuality(quality);
    this.pedestrians.setDensity(isBalanced ? 1.0 : 0.5);
    this.vehicles.setDensity(isBalanced ? 1.0 : 0.5);
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  isRoaming(): boolean {
    return this.cameraController.isRoaming();
  }

  dispose(): void {
    this.dayNightCycle.dispose();
    this.weatherEffects.dispose();
    this.cityBuilder.dispose();
    this.dice3D.dispose();
    this.pedestrians.dispose();
    this.vehicles.dispose();
    this.board.dispose();
    this.characters.dispose();
    this.houses.dispose();
    this.effects.dispose();
    this.fpsController.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
