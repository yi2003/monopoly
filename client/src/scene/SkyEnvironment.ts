// ============================================================
// SkyEnvironment — Sun, Moon, Stars, Clouds, Birds
// ============================================================

import * as THREE from 'three';

export class SkyEnvironment {
  private scene: THREE.Scene;
  private skyGroup: THREE.Group;

  // Celestial bodies
  private sunGroup!: THREE.Group;
  private sunGlow!: THREE.Mesh;
  private moonGroup!: THREE.Group;
  private moonGlow!: THREE.Mesh;
  private stars!: THREE.Points;

  // Clouds
  private cloudGroups: THREE.Group[] = [];

  // Birds
  private birdFlocks: { group: THREE.Group; birds: THREE.Group[]; pathRadius: number; pathY: number; speed: number; phase: number }[] = [];

  // Current state
  nightFactor = 0;
  private dayTime = 0.3;
  private skyRadius = 160;

  // Quality
  private quality: 'performance' | 'balanced' = 'balanced';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.skyGroup = new THREE.Group();
    this.skyGroup.name = 'skyEnvironment';
    this.scene.add(this.skyGroup);

    this.createSun();
    this.createMoon();
    this.createStars();
    this.createClouds();
    this.createBirds();
  }

  // ======================== SUN ========================

  private createSun(): void {
    this.sunGroup = new THREE.Group();
    this.sunGroup.name = 'sun';

    // Sun disc — large flat circle that always faces camera via sprite-like positioning
    const discGeo = new THREE.CircleGeometry(6, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: '#FFF9C4',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    this.sunGroup.add(disc);

    // Outer glow ring
    const glowGeo = new THREE.RingGeometry(5.5, 12, 48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: '#FFE082',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.sunGlow = new THREE.Mesh(glowGeo, glowMat);
    this.sunGroup.add(this.sunGlow);

    // Inner bright core
    const coreGeo = new THREE.CircleGeometry(3, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    this.sunGroup.add(core);

    this.skyGroup.add(this.sunGroup);
  }

  // ======================== MOON ========================

  private createMoon(): void {
    this.moonGroup = new THREE.Group();
    this.moonGroup.name = 'moon';

    // Moon disc
    const discGeo = new THREE.CircleGeometry(4, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: '#E8EAF6',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    this.moonGroup.add(disc);

    // Craters (small darker circles on the moon)
    const craterPositions = [
      [0.8, 0.5], [-1.2, -0.3], [0.3, -1.5], [-0.9, 1.2], [1.5, -1.0],
    ];
    const craterMat = new THREE.MeshBasicMaterial({
      color: '#C5CAE9',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    for (const [cx, cy] of craterPositions) {
      const craterGeo = new THREE.CircleGeometry(0.5 + Math.random() * 0.4, 16);
      const crater = new THREE.Mesh(craterGeo, craterMat);
      crater.position.set(cx, cy, 0.01);
      this.moonGroup.add(crater);
    }

    // Moon glow
    const glowGeo = new THREE.RingGeometry(3.5, 7, 48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: '#B0BEC5',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.moonGlow = new THREE.Mesh(glowGeo, glowMat);
    this.moonGroup.add(this.moonGlow);

    this.skyGroup.add(this.moonGroup);
  }

  // ======================== STARS ========================

  private createStars(): void {
    const starCount = this.quality === 'performance' ? 300 : 800;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Random position on upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6; // 0 to ~70° from zenith
      const r = this.skyRadius - 10;

      positions[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r;
      positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;

      sizes[i] = 0.5 + Math.random() * 2.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: '#FFFFFF',
      size: 0.7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.stars = new THREE.Points(geo, mat);
    this.stars.name = 'stars';
    this.skyGroup.add(this.stars);
  }

  // ======================== CLOUDS ========================

  private createClouds(): void {
    const cloudCount = this.quality === 'performance' ? 12 : 25;

    for (let i = 0; i < cloudCount; i++) {
      const group = new THREE.Group();
      group.name = `cloud-${i}`;

      // Each cloud is a cluster of white ellipsoids
      const blobCount = 3 + Math.floor(Math.random() * 6);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      for (let b = 0; b < blobCount; b++) {
        const rx = 0.6 + Math.random() * 2.5;
        const ry = 0.3 + Math.random() * 1.0;
        const rz = 0.4 + Math.random() * 1.5;
        const blobGeo = new THREE.SphereGeometry(1, 8, 6);
        const blob = new THREE.Mesh(blobGeo, cloudMat);
        blob.scale.set(rx, ry, rz);
        blob.position.set(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.3) * 1.5,
          (Math.random() - 0.5) * 4,
        );
        blob.rotation.z = Math.random() * Math.PI;
        group.add(blob);
      }

      // Random position in the sky
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 100;
      const height = 50 + Math.random() * 70;
      group.position.set(
        Math.cos(angle) * dist,
        height,
        Math.sin(angle) * dist,
      );
      group.userData = {
        speed: 0.3 + Math.random() * 1.5,
        angle,
        dist,
        height,
        wobbleAmp: 0.1 + Math.random() * 0.3,
        wobbleSpeed: 0.2 + Math.random() * 0.5,
        wobbleOffset: Math.random() * Math.PI * 2,
      };

      this.cloudGroups.push(group);
      this.skyGroup.add(group);
    }
  }

  // ======================== BIRDS ========================

  private createBirds(): void {
    const flockCount = this.quality === 'performance' ? 2 : 4;
    const birdsPerFlock = this.quality === 'performance' ? 3 : 6;

    for (let f = 0; f < flockCount; f++) {
      const flockGroup = new THREE.Group();
      flockGroup.name = `birdFlock-${f}`;

      const birds: THREE.Group[] = [];
      const birdBodyMat = new THREE.MeshStandardMaterial({
        color: '#212121',
        roughness: 0.5,
        depthWrite: true,
      });

      for (let b = 0; b < birdsPerFlock; b++) {
        const bird = this.createSingleBird(birdBodyMat);
        bird.position.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 6,
        );
        bird.rotation.y = Math.random() * Math.PI * 2;
        bird.scale.setScalar(0.08 + Math.random() * 0.04);
        flockGroup.add(bird);
        birds.push(bird);
      }

      const pathRadius = 15 + Math.random() * 40;
      const pathY = 30 + Math.random() * 50;
      const speed = 0.15 + Math.random() * 0.35;
      const phase = Math.random() * Math.PI * 2;

      flockGroup.position.set(
        Math.cos(phase) * pathRadius,
        pathY,
        Math.sin(phase) * pathRadius,
      );

      this.skyGroup.add(flockGroup);
      this.birdFlocks.push({ group: flockGroup, birds, pathRadius, pathY, speed, phase });
    }
  }

  private createSingleBird(bodyMat: THREE.MeshStandardMaterial): THREE.Group {
    const bird = new THREE.Group();

    // Body — small ellipsoid
    const bodyGeo = new THREE.SphereGeometry(1, 6, 4);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.5, 0.6, 0.5);
    body.castShadow = true;
    bird.add(body);

    // Wings — V-shape
    const wingMat = new THREE.MeshStandardMaterial({
      color: '#333333',
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    for (let s = -1; s <= 1; s += 2) {
      const wingGeo = new THREE.BoxGeometry(2.5, 0.05, 0.6);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0.3, 0.2, s * 0.6);
      wing.rotation.z = s * 0.5;
      wing.rotation.x = -0.3;
      wing.name = `wing-${s}`;
      bird.add(wing);
    }

    // Tail
    const tailGeo = new THREE.ConeGeometry(0.3, 0.8, 4);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(-1.2, 0, 0);
    tail.rotation.z = Math.PI / 2;
    bird.add(tail);

    return bird;
  }

  // ======================== UPDATE ========================

  setNightFactor(factor: number): void {
    this.nightFactor = factor;
  }

  update(dt: number, dayTime: number, cameraPos: THREE.Vector3): void {
    this.dayTime = dayTime % 1;
    this.nightFactor = 1 - Math.sin(this.dayTime * Math.PI);

    this.updateSunMoon(cameraPos);
    this.updateStars(cameraPos);
    this.updateClouds(dt, cameraPos);
    this.updateBirds(dt, cameraPos);
  }

  /** Position sun and moon opposite each other, move across the sky */
  private updateSunMoon(cameraPos: THREE.Vector3): void {
    // Sun rises in east (-X), sets in west (+X)
    // dayTime 0 = midnight, 0.25 = dawn (sun east), 0.5 = noon (sun overhead), 0.75 = dusk (sun west)
    const sunAngle = this.dayTime * Math.PI * 2 - Math.PI / 2; // offset so 0.25=dawn
    const sunX = Math.cos(sunAngle) * this.skyRadius * 0.9;
    const sunY = Math.sin(sunAngle) * this.skyRadius * 0.7;
    const sunZ = cameraPos.z; // follow camera

    this.sunGroup.position.set(
      cameraPos.x + sunX,
      Math.max(sunY, 5),
      sunZ + 30,
    );
    this.sunGroup.lookAt(new THREE.Vector3(cameraPos.x, cameraPos.y + 30, cameraPos.z));

    // Sun visibility — fade below horizon
    const sunAlpha = THREE.MathUtils.smoothstep(sunY, -10, 20);
    this.sunGroup.children.forEach(c => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
        c.material.opacity = sunAlpha * (c === this.sunGlow ? 0.35 : 0.9);
      }
    });
    this.sunGroup.visible = sunAlpha > 0.02;

    // Moon opposite the sun
    const moonAngle = sunAngle + Math.PI;
    const moonX = Math.cos(moonAngle) * this.skyRadius * 0.85;
    const moonY = Math.sin(moonAngle) * this.skyRadius * 0.65;

    this.moonGroup.position.set(
      cameraPos.x + moonX,
      Math.max(moonY, 5),
      cameraPos.z + 25,
    );
    this.moonGroup.lookAt(new THREE.Vector3(cameraPos.x, cameraPos.y + 25, cameraPos.z));

    const moonAlpha = THREE.MathUtils.smoothstep(moonY, -10, 20);
    this.moonGroup.children.forEach(c => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
        const base = c === this.moonGlow ? 0.25 : 0.9;
        c.material.opacity = moonAlpha * base;
      }
    });
    this.moonGroup.visible = moonAlpha > 0.02;
  }

  /** Fade stars in/out based on night factor + moon position */
  private updateStars(cameraPos: THREE.Vector3): void {
    this.stars.position.copy(cameraPos);

    const starsAlpha = this.nightFactor;
    (this.stars.material as THREE.PointsMaterial).opacity = starsAlpha * 0.85;
    this.stars.visible = starsAlpha > 0.05;
  }

  /** Drift clouds slowly around the sky */
  private updateClouds(dt: number, _cameraPos: THREE.Vector3): void {
    for (const cloud of this.cloudGroups) {
      const ud = cloud.userData;
      ud.angle += ud.speed * dt * 0.05;
      cloud.position.x = Math.cos(ud.angle) * ud.dist;
      cloud.position.z = Math.sin(ud.angle) * ud.dist;
      cloud.position.y = ud.height + Math.sin(ud.angle * ud.wobbleSpeed + ud.wobbleOffset) * ud.wobbleAmp * 2;

      // Tint clouds slightly at night
      const r = 1 - this.nightFactor * 0.5;
      const g = 1 - this.nightFactor * 0.4;
      const b = 1 - this.nightFactor * 0.2;
      cloud.children.forEach(c => {
        if (c instanceof THREE.Mesh && !Array.isArray(c.material)) {
          (c.material as THREE.MeshStandardMaterial).color.setRGB(r, g, b);
          (c.material as THREE.MeshStandardMaterial).emissive?.setRGB(
            this.nightFactor * 0.3,
            this.nightFactor * 0.35,
            this.nightFactor * 0.5,
          );
        }
      });
    }
  }

  /** Flocks circle overhead */
  private updateBirds(dt: number, _cameraPos: THREE.Vector3): void {
    for (const flock of this.birdFlocks) {
      flock.phase += flock.speed * dt * 0.3;
      flock.group.position.x = Math.cos(flock.phase) * flock.pathRadius;
      flock.group.position.z = Math.sin(flock.phase) * flock.pathRadius * 0.6;
      flock.group.position.y = flock.pathY + Math.sin(flock.phase * 1.7) * 8;

      // Face direction of travel
      const tangent = new THREE.Vector3(
        -Math.sin(flock.phase),
        0,
        Math.cos(flock.phase) * 0.6,
      ).normalize();
      flock.group.lookAt(flock.group.position.clone().add(tangent));

      // Flap wings
      const flapSpeed = 8 + Math.random() * 3;
      for (const bird of flock.birds) {
        bird.children.forEach(child => {
          if (child.name.startsWith('wing-')) {
            const s = child.name === 'wing--1' ? -1 : 1;
            child.rotation.z = s * Math.sin(Date.now() * 0.001 * flapSpeed + flock.phase) * 0.6;
          }
        });
      }
    }
  }

  // ======================== QUALITY ========================

  setQuality(quality: 'performance' | 'balanced'): void {
    this.quality = quality;
  }

  // ======================== DISPOSE ========================

  dispose(): void {
    this.skyGroup.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    if (this.stars) {
      this.stars.geometry.dispose();
      (this.stars.material as THREE.PointsMaterial).dispose();
    }
    this.scene.remove(this.skyGroup);
  }
}
