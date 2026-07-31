// ============================================================
// SceneManager — Three.js scene orchestration
// ============================================================

import * as THREE from 'three';
import type { GameState, CameraMode, QualityMode, WeatherType } from '@monopoly/shared';
import { INNER_BOARD_HALF, TILE_D, OUTER_BOARD_HALF, OUTER_RING_OFFSET, getEra, getCharacterTilePos } from '@monopoly/shared';
import { CameraController } from '../camera/CameraController';
import { FirstPersonController } from '../roam/FirstPersonController';
import { RoamCollision } from '../roam/RoamCollision';
import { Board } from './Board';
import { Characters } from './Characters';
import { Houses } from './Houses';
import { Effects } from './Effects';
import { DayNightCycle } from './DayNightCycle';
import { WeatherEffects } from './WeatherEffects';
import { CityBuilder, PRELOAD_MODEL_URLS } from './CityBuilder';
import { Pedestrians } from './Pedestrians';
import { Vehicles } from './Vehicles';
import { NightGlow } from './NightGlow';
import { Dice3D, getDice3DInstance } from './Dice3D';
import { getSocket } from '../network/socket';
import { SkyEnvironment } from './SkyEnvironment';
import { PostProcessing } from './PostProcessing';
import { preloadModels } from './ModelLoader';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { audioManager } from '../audio/AudioManager';
import { computeZoneWeights } from '../audio/ZoneDetector';

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
  private skyEnv!: SkyEnvironment;
  private post!: PostProcessing;

  private gameState: GameState | null = null;
  private qualityMode: QualityMode = 'balanced';
  private cameraMode: CameraMode = 'orbit';
  private prevWeather: WeatherType = 'clear';
  private prevDayTime = 0.3;
  private prevDiceVal: string | null = null; // "die1,die2" for comparison
  private initialized = false;
  private initialBuildDone = false;
  private groundMat!: THREE.MeshStandardMaterial;

  // Road paths for vehicles (computed from city layout)
  private roadPaths: THREE.Vector3[][] = [];
  // Walk zones for pedestrians
  private walkZones: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

  // Event trigger dedup counter (synced with uiStore.eventTriggerId)
  private lastEventTriggerId = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
  }

  async init(quality: QualityMode): Promise<void> {
    this.qualityMode = quality;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'performance' ? 1.0 : 1.5));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = quality === 'balanced';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
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
    this.groundMat = new THREE.MeshStandardMaterial({ color: '#3a7d3a', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
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

    // Procedural city (deferred build — wait for era from game state)
    this.cityBuilder = new CityBuilder(this.scene);
    await preloadModels([...PRELOAD_MODEL_URLS]);
    this.board.plantTrees();

    // Pedestrians & Vehicles
    this.pedestrians = new Pedestrians(this.scene);
    this.vehicles = new Vehicles(this.scene);

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
    this.dice3D.onManualStop = (die1, die2) => {
      const socket = getSocket();
      if (socket) {
        socket.emit('rollDice', { die1, die2 });
      }
      // Set prevDiceVal so server echo doesn't re-animate
      this.prevDiceVal = `${die1},${die2}`;
    };

    // Sky environment (sun, moon, stars, clouds, birds)
    this.skyEnv = new SkyEnvironment(this.scene);

    // Post-processing (film grade + bloom)
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);

    // Apply quality mode to city sub-systems
    this.cityBuilder.setQuality(quality);
    this.pedestrians.setDensity(quality === 'performance' ? 0.5 : 1.0);
    this.vehicles.setDensity(quality === 'performance' ? 0.5 : 1.0);

    this.initialized = true;

    // Start persistent city audio
    audioManager.startCityAmbience();
    audioManager.startCitySounds();
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight('#ffffff', 0.55);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight('#87CEEB', '#3a7d3a', 0.75);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#ffffff', 1.2);
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
    const BOARD_HALF_TILES = INNER_BOARD_HALF;
    const OUTER_HALF = OUTER_BOARD_HALF;
    const SIDEWALK_WIDTH = 2.0;
    const ROAD_WIDTH = 4.0;

    // Road is OUTSIDE the outer-ring buildings (outermost element)
    // outer-ring tile → sidewalk → buildings → ROAD
    const roadOffset = TILE_D / 2 + SIDEWALK_WIDTH + 0.5 + 2.0 + ROAD_WIDTH / 2;
    // 2.75 + 2.0 + 0.5 + 2.0 + 2.0 = 9.25

    // Road paths: outermost ring road (4 sides) + inner city cross roads
    const paths: THREE.Vector3[][] = [
      // Outer ring — Bottom road
      [
        new THREE.Vector3(-OUTER_HALF - 20, 0, -OUTER_HALF - roadOffset),
        new THREE.Vector3(OUTER_HALF + 20, 0, -OUTER_HALF - roadOffset),
      ],
      // Outer ring — Top road
      [
        new THREE.Vector3(-OUTER_HALF - 20, 0, OUTER_HALF + roadOffset),
        new THREE.Vector3(OUTER_HALF + 20, 0, OUTER_HALF + roadOffset),
      ],
      // Outer ring — Left road
      [
        new THREE.Vector3(-OUTER_HALF - roadOffset, 0, -OUTER_HALF - 20),
        new THREE.Vector3(-OUTER_HALF - roadOffset, 0, OUTER_HALF + 20),
      ],
      // Outer ring — Right road
      [
        new THREE.Vector3(OUTER_HALF + roadOffset, 0, -OUTER_HALF - 20),
        new THREE.Vector3(OUTER_HALF + roadOffset, 0, OUTER_HALF + 20),
      ],
      // Inner city cross roads (N-S and E-W through center)
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

    // Walk zones along sidewalks:
    // Inner ring: tile → sidewalk → buildings
    // Outer ring: tile → sidewalk → buildings
    const walkOffset = TILE_D / 2 + SIDEWALK_WIDTH / 2; // 3.75

    const walkZoneConfigs = [
      { half: BOARD_HALF_TILES },
      { half: OUTER_HALF },
    ];

    for (const wz of walkZoneConfigs) {
      for (let side = 0; side < 4; side++) {
        const isHorizontal = side % 2 === 0;
        const sign = side < 2 ? -1 : 1;
        const length = 60;
        const start = isHorizontal
          ? new THREE.Vector3(-length / 2, 0, sign * (wz.half + walkOffset))
          : new THREE.Vector3(sign * (wz.half + walkOffset), 0, -length / 2);
        const end = isHorizontal
          ? new THREE.Vector3(length / 2, 0, sign * (wz.half + walkOffset))
          : new THREE.Vector3(sign * (wz.half + walkOffset), 0, length / 2);
        this.walkZones.push({ start, end });
      }
    }

    // Also add walk zones along inner city cross roads (center)
    for (const axis of ['x', 'z']) {
      const half = 25;
      const offset = 2.5; // sidewalk offset from road center
      this.walkZones.push({
        start: new THREE.Vector3(axis === 'x' ? -half : -offset, 0, axis === 'z' ? -half : -offset),
        end: new THREE.Vector3(axis === 'x' ? half : offset, 0, axis === 'z' ? half : offset),
      });
      this.walkZones.push({
        start: new THREE.Vector3(axis === 'x' ? -half : offset, 0, axis === 'z' ? -half : offset),
        end: new THREE.Vector3(axis === 'x' ? half : -offset, 0, axis === 'z' ? half : -offset),
      });
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
    this.pedestrians.setNightFactor(this.dayNightCycle.nightFactor);
    this.pedestrians.update(dt);
    this.vehicles.update(dt);

    // Night glow
    this.nightGlow.setNightFactor(this.dayNightCycle.nightFactor);

    // Sky environment (sun, moon, stars, clouds, birds)
    this.skyEnv.update(dt, this.dayNightCycle.dayTime, this.camera.position);

    // Notify audio system of night factor
    audioManager.setNightFactor(this.dayNightCycle.nightFactor);

    // Compute zone weights from camera position & update ambient layers
    if (this.gameState) {
      const zoneWeights = computeZoneWeights(this.camera.position, this.gameState);
      audioManager.setZoneWeights(zoneWeights);
    }
    audioManager.update(dt);

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

    // Update post-processing (grade transition, grain animation)
    this.post.update(dt);

    // Trigger 3D effects for game events (camera shake, particles, reactions)
    this.checkAndTriggerEventEffects();

    this.post.render();
  }

  // ---- State sync ----

  updateState(state: GameState): void {
    const isFirstState = !this.initialBuildDone;
    this.gameState = state;
    this.board.update(state);
    this.characters.updateState(state);
    this.houses.updateState(state);
    this.effects.updateState(state);
    this.cameraController.setGameState(state);
    // Sync spectator flag every state update so camera follows bots when spectating
    this.cameraController.setSpectator(useGameStore.getState().isSpectator);

    // ── Deferred initial build — only after we have the real era ──
    if (!this.initialBuildDone) {
      this.initialBuildDone = true;
      // Set era BEFORE building so everything uses correct era from frame 1
      this.cityBuilder.setTheme(state.config.theme);
      this.cityBuilder.setEra(state.config.era);
      this.pedestrians.setTheme(state.config.theme);
      this.pedestrians.setEra(state.config.era);
      this.vehicles.setTheme(state.config.theme);
      this.vehicles.setEra(state.config.era);
      this.dayNightCycle.setEra(state.config.era);
      audioManager.setEra(state.config.era);

      // Build city with real era
      this.cityBuilder.build();
      this.nightGlow.registerAll(this.cityBuilder.nightGlowMaterials);
      this.nightGlow.autoRegisterFromScene(this.scene);
      this.computePaths();
      this.cityBuilder.registerColliders(
        (center, halfSize) => this.roamCollision.addBox(center, halfSize),
      );

      // Apply era to board and ground
      const eraDef = getEra(state.config.era);
      this.post.setGrade(eraDef.palette.grade, true);
      this.post.setBloomStrength(eraDef.palette.bloom);
      this.board.setEra(state.config.era);
      const groundColors: Record<string, string> = {
        '1945': '#3a4a28', '1985': '#2a3a28', '2025': '#3a7d3a', '2055': '#1a3830',
      };
      this.groundMat.color.set(groundColors[state.config.era] || '#3a7d3a');
      return;
    }

    // ── Subsequent updates ──

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

    // Trigger 3D dice animation
    const diceId = state.dice !== null
      ? `${state.dice.die1},${state.dice.die2}`
      : null;

    // Start spinning when player enters rolling phase
    if (state.phase === 'rolling' && !state.diceRolled && !this.dice3D.isSpinning()) {
      // Only auto-spin for human player's turn
      const cp = state.players[state.currentPlayerIndex];
      const playerId = useGameStore.getState().playerId;
      if (cp && !cp.isBot && cp.id === playerId) {
        this.dice3D.startSpinning();
      }
    }

    // Stop spinning when dice values arrive
    if (diceId !== null && diceId !== this.prevDiceVal) {
      if (this.dice3D.isSpinning()) {
        this.dice3D.settleTo(state.dice!.die1, state.dice!.die2);
      } else {
        this.dice3D.roll(state.dice!.die1, state.dice!.die2);
      }
      audioManager.playDice();
    }
    this.prevDiceVal = diceId;

    // Sync theme and era for NPC and city visuals
    this.cityBuilder.setTheme(state.config.theme);
    const eraChanged = this.cityBuilder.setEra(state.config.era);
    this.pedestrians.setTheme(state.config.theme);
    this.pedestrians.setEra(state.config.era);
    this.vehicles.setTheme(state.config.theme);
    this.vehicles.setEra(state.config.era);
    this.dayNightCycle.setEra(state.config.era);

    // Apply era film grade & bloom to post-processing
    if (eraChanged) {
      const eraDef = getEra(state.config.era);
      this.post.setGrade(eraDef.palette.grade, false);
      this.post.setBloomStrength(eraDef.palette.bloom);
      audioManager.setEra(state.config.era);
    }

    // Apply era to board base/frame/slabs and ground plane
    if (eraChanged) {
      this.board.setEra(state.config.era);
      const groundColors: Record<string, string> = {
        '1945': '#3a4a28', '1985': '#2a3a28', '2025': '#3a7d3a', '2055': '#1a3830',
      };
      this.groundMat.color.set(groundColors[state.config.era] || '#3a7d3a');
    }

    // If era triggered a city rebuild, re-register night glow & colliders
    if (eraChanged) {
      this.nightGlow.clear();
      this.nightGlow.registerAll(this.cityBuilder.nightGlowMaterials);
      this.nightGlow.autoRegisterFromScene(this.scene);
      this.roamCollision.clear();
      this.cityBuilder.registerColliders(
        (center, halfSize) => this.roamCollision.addBox(center, halfSize),
      );
      // Rebuild vehicles & pedestrians with new era types
      if (this.roadPaths.length > 0) {
        this.vehicles.setRoadPaths(this.roadPaths);
        this.pedestrians.rebuildWithEra();
      }
    }
  }

  // ── Event-driven 3D effects orchestration ──
  /** Called each frame to detect new game events and trigger coordinated effects */
  private checkAndTriggerEventEffects(): void {
    const ui = useUIStore.getState();
    if (!ui.showEventCard || !ui.gameEvent || ui.eventTriggerId === this.lastEventTriggerId) return;
    if (ui.gameEvent.kind === 'game_over') return;
    this.lastEventTriggerId = ui.eventTriggerId;

    const ev = ui.gameEvent;

    switch (ev.kind) {
      case 'rent': {
        // 1. Impact ring + burst coins at the property tile position
        const tilePos = getCharacterTilePos(ev.tileIndex);
        const spawnPos = new THREE.Vector3(tilePos.x, 1.2, tilePos.z);
        this.effects.spawnImpactRing(spawnPos, '#FFD700');
        const coinCount = Math.min(8 + Math.floor(ev.amount / 50), 25);
        this.effects.spawnBurstCoins(spawnPos, '#FFD700', coinCount);

        // 2. Flying coins from payer to payee
        const payerPos = this.characters.getCharacterPosition(ev.playerId);
        const payeePos = this.characters.getCharacterPosition(ev.targetId);
        if (payerPos && payeePos) {
          const from = payerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
          const to = payeePos.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnFlyingCoins(from, to, '#E53935', 5);
        }

        // 3. Camera shake (intensity proportional to amount, capped)
        const shakeIntensity = Math.min(ev.amount / 400, 2.0);
        this.cameraController.shake(shakeIntensity, 0.6);

        // 4. Character reactions
        this.characters.playReaction(ev.playerId, 'hurt');
        this.characters.playReaction(ev.targetId, 'celebrate');
        break;
      }
      case 'tax': {
        const playerPos = this.characters.getCharacterPosition(ev.playerId);
        if (playerPos) {
          const pos = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnBurstCoins(pos, '#FF5722', 8);
        }
        this.cameraController.shake(Math.min(ev.amount / 300, 1.5), 0.5);
        this.characters.playReaction(ev.playerId, 'hurt');
        break;
      }
      case 'go_salary': {
        const playerPos = this.characters.getCharacterPosition(ev.playerId);
        if (playerPos) {
          const pos = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnBurstCoins(pos, '#4CAF50', 10);
        }
        this.characters.playReaction(ev.playerId, 'celebrate');
        break;
      }
      case 'jail_in': {
        this.cameraController.shake(1.0, 0.4);
        const playerPos = this.characters.getCharacterPosition(ev.playerId);
        if (playerPos) {
          this.effects.spawnImpactRing(
            playerPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
            '#9E9E9E',
          );
        }
        this.characters.playReaction(ev.playerId, 'hurt');
        break;
      }
      case 'jail_out': {
        const playerPos = this.characters.getCharacterPosition(ev.playerId);
        if (playerPos) {
          const pos = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnBurstCoins(pos, '#FFD700', 6);
        }
        this.characters.playReaction(ev.playerId, 'celebrate');
        break;
      }
      case 'dividend': {
        const playerPos = this.characters.getCharacterPosition(ev.playerId);
        if (playerPos) {
          const pos = playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnBurstCoins(pos, '#2196F3', 8);
        }
        this.characters.playReaction(ev.playerId, 'celebrate');
        break;
      }
      case 'maintenance': {
        const playerPos = this.characters.getCharacterPosition(ev.playerId);
        if (playerPos) {
          this.effects.spawnImpactRing(
            playerPos.clone().add(new THREE.Vector3(0, 0.5, 0)),
            '#FF9800',
          );
        }
        break;
      }
      // weather — no 3D effects needed
    }
  }

  // ---- Camera & Quality ----

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.cameraController.setMode(mode);
  }

  setSpectator(spectator: boolean): void {
    this.cameraController.setSpectator(spectator);
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
    this.post.resize(w, h);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  isRoaming(): boolean {
    return this.cameraController.isRoaming();
  }

  dispose(): void {
    this.dayNightCycle?.dispose();
    this.weatherEffects?.dispose();
    this.cityBuilder?.dispose();
    this.dice3D?.dispose();
    this.skyEnv?.dispose();
    this.post?.dispose();
    this.pedestrians?.dispose();
    this.vehicles?.dispose();
    this.board?.dispose();
    this.characters?.dispose();
    this.houses?.dispose();
    this.effects?.dispose();
    this.fpsController?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
