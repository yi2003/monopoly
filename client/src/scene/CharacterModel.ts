// ============================================================
// CharacterModel — Pure character geometry builder (no scene/animation)
// Each avatar has a completely different body, outfit, hair, and accessories
// ============================================================

import * as THREE from 'three';
import type { AvatarId } from '@monopoly/shared';

// ---- Materials helper ----

function makeMat(color: string, roughness = 0.5, metalness = 0.1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// ---- Face builder (shared) ----

function addEyes(g: THREE.Group, headY: number, eyeStyle: 'normal' | 'happy' | 'squint' | 'wide' = 'normal'): void {
  const whiteMat = makeMat('#ffffff', 0.2);
  const pupilMat = makeMat('#111111', 0.1);
  const browMat = makeMat('#333333', 0.6);

  // Eye size & position varies by style
  const r = eyeStyle === 'wide' ? 0.045 : eyeStyle === 'happy' ? 0.035 : 0.04;
  const pupilR = r * 0.5;
  const yOff = eyeStyle === 'happy' ? -0.01 : 0; // happy eyes are slightly lower (curved up)

  for (let s = -1; s <= 1; s += 2) {
    // Eye white
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), whiteMat);
    eye.position.set(s * 0.06, headY + 0.04 + yOff, 0.14);
    eye.scale.set(1, eyeStyle === 'squint' ? 0.4 : 0.8, 0.3);
    g.add(eye);

    // Pupil
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(pupilR, 6, 4), pupilMat);
    pupil.position.set(s * 0.06, headY + 0.04 + yOff, 0.155);
    g.add(pupil);

    // Eyebrow (not for squint — already small)
    if (eyeStyle !== 'squint') {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(r * 2.2, r * 0.25, r * 0.4), browMat);
      brow.position.set(s * 0.06, headY + 0.08, 0.14);
      brow.rotation.z = eyeStyle === 'happy' ? s * 0.2 : 0;
      g.add(brow);
    }
  }
}

function addMouth(g: THREE.Group, headY: number, style: 'smile' | 'neutral' | 'bigSmile' = 'smile'): void {
  const mouthMat = makeMat('#c44', 0.4); // reddish

  if (style === 'bigSmile') {
    // Wide arc smile
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 8, Math.PI), mouthMat);
    mouth.position.set(0, headY - 0.02, 0.155);
    mouth.rotation.z = Math.PI;
    mouth.rotation.x = 0.1;
    g.add(mouth);
  } else if (style === 'neutral') {
    // Straight line
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.01), mouthMat);
    mouth.position.set(0, headY - 0.03, 0.155);
    g.add(mouth);
  } else {
    // Small smile
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 8, Math.PI), mouthMat);
    mouth.position.set(0, headY - 0.03, 0.155);
    mouth.rotation.z = Math.PI;
    g.add(mouth);
  }
}

// ---- Builders: each avatar is a completely different character ----

function buildTycoon(color: string, g: THREE.Group): void {
  const suit = makeMat('#1a1a2e', 0.4, 0.15);
  const shirt = makeMat('#ffffff', 0.3, 0.05);
  const skin = makeMat('#F5D5B8', 0.5);
  const gold = makeMat('#FFD700', 0.3, 0.6);
  const shoe = makeMat('#1a1a1a', 0.3, 0.2);

  // Tall slim body
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.7, 8), suit);
  torso.position.y = 0.6; torso.castShadow = true; g.add(torso);

  // White shirt collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.08, 8), shirt);
  collar.position.y = 0.95; g.add(collar);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
  head.position.y = 1.08; head.castShadow = true; g.add(head);
  addEyes(g, 1.08, 'normal'); addMouth(g, 1.08, 'smile');

  // Slick hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), suit);
  hair.position.y = 1.12; hair.scale.set(1, 0.4, 1); g.add(hair);

  // Top hat
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.06, 12), suit);
  brim.position.y = 1.25; g.add(brim);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.18, 12), suit);
  top.position.y = 1.36; g.add(top);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.04, 12), makeMat(color));
  band.position.y = 1.28; g.add(band);

  // Monocle
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 12), gold);
  ring.position.set(0.11, 1.10, 0.13); g.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.18, 4), gold);
  chain.position.set(0.11, 1.02, 0.13); g.add(chain);

  // Bowtie
  for (let s = -1; s <= 1; s += 2) {
    const bt = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), makeMat(color));
    bt.position.set(s * 0.04, 0.92, 0.15); bt.rotation.z = s * 0.4; g.add(bt);
  }

  // Legs (long, slim)
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.07, 0.3, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.32, 6), suit);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.32;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.28, 6), suit);
    lower.position.y = -0.14; lowerGrp.add(lower);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.13), shoe);
    foot.position.set(0, -0.29, 0.04); lowerGrp.add(foot);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.2, 0.7, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 6), suit);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.3;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.26, 6), suit);
    lower.position.y = -0.12; handGrp.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.26; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildChef(color: string, g: THREE.Group): void {
  const outfit = makeMat(color, 0.4);
  const apron = makeMat('#f5f5f5', 0.6);
  const skin = makeMat('#E8C9A0', 0.5);
  const pants = makeMat('#444444', 0.6);
  const clog = makeMat('#8B4513', 0.6);

  // Wide rounded body
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.55, 12), outfit);
  torso.position.y = 0.5; torso.castShadow = true; g.add(torso);

  // Apron layer (flat front)
  const apronFront = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.03), apron);
  apronFront.position.set(0, 0.5, 0.23); g.add(apronFront);
  // Apron straps
  for (let s = -1; s <= 1; s += 2) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.02), apron);
    strap.position.set(s * 0.12, 0.65, 0.18); g.add(strap);
  }

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skin);
  head.position.y = 0.92; head.castShadow = true; g.add(head);
  addEyes(g, 0.92, 'happy'); addMouth(g, 0.92, 'bigSmile');

  // Round bald head (no hair, just shiny head)
  const baldTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.3), skin);
  baldTop.position.y = 1.05; baldTop.scale.set(1, 0.6, 1); g.add(baldTop);

  // Chef hat
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.08, 16), outfit);
  hatBand.position.y = 1.12; g.add(hatBand);
  const puff = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.22, 16), apron);
  puff.position.y = 1.28; g.add(puff);
  const topPuff = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), apron);
  topPuff.scale.set(1, 0.6, 1); topPuff.position.y = 1.45; g.add(topPuff);

  // Legs (shorter, wider)
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.1, 0.25, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.25, 6), pants);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.25;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 6), pants);
    lower.position.y = -0.11; lowerGrp.add(lower);

    // Clog shoe
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.14), clog);
    foot.position.set(0, -0.24, 0.04); lowerGrp.add(foot);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms (thicker)
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.24, 0.62, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.26, 6), outfit);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.26;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.22, 6), outfit);
    lower.position.y = -0.11; handGrp.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), skin);
    hand.position.y = -0.23; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildExplorer(color: string, g: THREE.Group): void {
  const vest = makeMat(color, 0.4);
  const shirt = makeMat('#D2B48C', 0.6); // khaki shirt
  const skin = makeMat('#D4A574', 0.5); // tanned
  const pants = makeMat('#5C4033', 0.6); // brown pants
  const boot = makeMat('#3E2723', 0.6);
  const gold = makeMat('#FFD700', 0.3, 0.6);

  // Normal body with vest over shirt
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.58, 8), shirt);
  torso.position.y = 0.52; torso.castShadow = true; g.add(torso);

  // Vest overlay (open front — two strips on sides)
  for (let s = -1; s <= 1; s += 2) {
    const vestSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.1), vest);
    vestSide.position.set(s * 0.13, 0.52, 0.05); g.add(vestSide);
  }

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  head.position.y = 0.95; head.castShadow = true; g.add(head);
  addEyes(g, 0.95, 'normal'); addMouth(g, 0.95, 'smile');

  // Short hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.45), makeMat('#3E2723', 0.7));
  hair.position.y = 0.97; hair.scale.set(1, 0.35, 1); g.add(hair);

  // Pith helmet
  const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.04, 16), shirt);
  helmetBrim.position.y = 1.06; g.add(helmetBrim);
  const helmetDome = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.09, 12), shirt);
  helmetDome.position.y = 1.12; g.add(helmetDome);

  // Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.1), makeMat('#8B4513', 0.5));
  pack.position.set(0, 0.62, -0.28); g.add(pack);
  // Backpack straps
  for (let s = -1; s <= 1; s += 2) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.02), makeMat('#654321', 0.6));
    strap.position.set(s * 0.08, 0.6, -0.15); strap.rotation.x = 0.1; g.add(strap);
  }

  // Binoculars around neck
  const binocs = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), makeMat('#333', 0.3));
  binocs.position.set(0, 0.78, 0.15); binocs.rotation.x = Math.PI / 2; g.add(binocs);

  // Legs
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.08, 0.27, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.28, 6), pants);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.28;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 6), pants);
    lower.position.y = -0.13; lowerGrp.add(lower);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.13), boot);
    foot.position.set(0, -0.28, 0.04); lowerGrp.add(foot);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.21, 0.62, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.27, 6), shirt);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.27;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.24, 6), shirt);
    lower.position.y = -0.12; handGrp.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.25; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildAthlete(color: string, g: THREE.Group): void {
  const tank = makeMat(color, 0.4);
  const skin = makeMat('#E8B88A', 0.5);
  const shorts = makeMat('#2c2c2c', 0.5);
  const sneaker = makeMat('#f0f0f0', 0.3);
  const accent = makeMat('#ffffff', 0.3);

  // Muscular torso: wide at shoulders, narrow at waist
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.55, 8), tank);
  torso.position.y = 0.52; torso.castShadow = true; g.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  head.position.y = 0.93; head.castShadow = true; g.add(head);
  addEyes(g, 0.93, 'squint'); addMouth(g, 0.93, 'neutral');

  // Spiky hair — multiple small cones
  const hairMat = makeMat('#1a1a1a', 0.7);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), hairMat);
    spike.position.set(Math.cos(angle) * 0.13, 1.06, Math.sin(angle) * 0.13);
    spike.rotation.z = 0.15; g.add(spike);
  }
  const frontSpike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), hairMat);
  frontSpike.position.set(0, 1.07, 0.12); frontSpike.rotation.x = -0.5; g.add(frontSpike);

  // Headband
  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 16), accent);
  headband.rotation.x = Math.PI / 2; headband.position.y = 1.05; g.add(headband);

  // Number on chest
  const number = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.01), accent);
  number.position.set(0, 0.52, 0.18); g.add(number);

  // Legs (athletic, longer)
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.07, 0.28, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    // Shorts
    const short = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.15, 6), shorts);
    short.position.y = 0; short.castShadow = true; legGrp.add(short);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.15;
    // Bare calf
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), skin);
    calf.position.y = -0.1; lowerGrp.add(calf);

    // Sneaker
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), sneaker);
    shoe.position.set(0, -0.22, 0.04); lowerGrp.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.15), makeMat('#ddd', 0.3));
    sole.position.set(0, -0.25, 0.04); lowerGrp.add(sole);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms (muscular)
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.22, 0.6, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.28, 6), skin);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    // Wristband
    const wristband = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.015, 8, 8), accent);
    wristband.position.y = -0.28; armGrp.add(wristband);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.28;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.22, 6), skin);
    forearm.position.y = -0.11; handGrp.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.23; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildRoyal(color: string, g: THREE.Group): void {
  const robe = makeMat(color, 0.3, 0.2);
  const gold = makeMat('#FFD700', 0.2, 0.8);
  const skin = makeMat('#FDEBD0', 0.5);
  const trim = makeMat('#ffffff', 0.3, 0.1); // ermine trim

  // Tall slender body with robe
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.65, 8), robe);
  torso.position.y = 0.56; torso.castShadow = true; g.add(torso);

  // Gold belt
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16), gold);
  belt.position.y = 0.55; belt.rotation.x = Math.PI / 2; g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), gold);
  buckle.position.set(0, 0.55, 0.18); g.add(buckle);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
  head.position.y = 1.02; head.castShadow = true; g.add(head);
  addEyes(g, 1.02, 'normal'); addMouth(g, 1.02, 'smile');

  // Fancy curled hair
  const hairMat = makeMat('#C9A96E', 0.5);
  for (let s = -1; s <= 1; s += 2) {
    const curl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), hairMat);
    curl.position.set(s * 0.12, 0.98, 0.06); g.add(curl);
  }
  const topHair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat);
  topHair.position.y = 1.04; topHair.scale.set(1, 0.4, 1); g.add(topHair);

  // Crown
  const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.06, 16), gold);
  crownRing.position.y = 1.13; g.add(crownRing);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), gold);
    spike.position.set(Math.cos(angle) * 0.14, 1.21, Math.sin(angle) * 0.14); g.add(spike);
  }
  // Ruby on crown
  const ruby = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), makeMat('#E53935', 0.2, 0.7));
  ruby.position.set(0, 1.14, 0.15); g.add(ruby);

  // Cape (large, dramatic)
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.03), robe);
  cape.position.set(0, 0.75, -0.28); cape.rotation.x = -0.12; g.add(cape);
  // Ermine trim on cape
  const ermine = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.06, 0.035), trim);
  ermine.position.set(0, 0.5, -0.28); ermine.rotation.x = -0.12; g.add(ermine);

  // Legs (elegant, slim)
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.07, 0.28, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.3, 6), robe);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.3;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.28, 6), robe);
    lower.position.y = -0.14; lowerGrp.add(lower);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.12), gold);
    shoe.position.set(0, -0.28, 0.02); lowerGrp.add(shoe);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.2, 0.68, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 6), robe);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    // Gold bracelet
    const bracelet = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 8), gold);
    bracelet.position.y = -0.1; armGrp.add(bracelet);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.28;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.24, 6), robe);
    lower.position.y = -0.12; handGrp.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.25; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildCowboy(color: string, g: THREE.Group): void {
  const shirt = makeMat(color, 0.4);
  const jeans = makeMat('#1565C0', 0.5); // blue jeans
  const skin = makeMat('#E8C9A0', 0.5);
  const boot = makeMat('#5D4037', 0.5);
  const bandana = makeMat('#D32F2F', 0.6); // red bandana

  // Normal build
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.58, 8), shirt);
  torso.position.y = 0.52; torso.castShadow = true; g.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  head.position.y = 0.95; head.castShadow = true; g.add(head);
  addEyes(g, 0.95, 'squint'); addMouth(g, 0.95, 'smile');

  // Short brown hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.4), makeMat('#5D4037', 0.7));
  hair.position.y = 0.97; hair.scale.set(1, 0.3, 1); g.add(hair);

  // Bandana around neck
  const bandanaRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 12), bandana);
  bandanaRing.rotation.x = Math.PI / 2; bandanaRing.position.y = 0.8; g.add(bandanaRing);
  // Bandana knot at back
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), bandana);
  knot.position.set(0, 0.8, -0.13); g.add(knot);

  // Cowboy hat
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.04, 16), makeMat('#5D4037', 0.5));
  hatBrim.position.y = 1.08; g.add(hatBrim);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.11, 12), makeMat('#5D4037', 0.5));
  hatTop.position.y = 1.15; g.add(hatTop);
  const hatCrease = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.07), makeMat('#5D4037', 0.5));
  hatCrease.position.y = 1.21; g.add(hatCrease);
  // Hat band
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12), makeMat(color));
  hatBand.position.y = 1.12; g.add(hatBand);

  // Belt with big buckle
  const beltRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 12), makeMat('#3E2723', 0.5));
  beltRing.rotation.x = Math.PI / 2; beltRing.position.y = 0.48; g.add(beltRing);
  const bigBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), makeMat('#FFD700', 0.3, 0.7));
  bigBuckle.position.set(0, 0.48, 0.2); g.add(bigBuckle);

  // Legs
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.08, 0.27, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.28, 6), jeans);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.28;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 6), jeans);
    lower.position.y = -0.13; lowerGrp.add(lower);

    // Cowboy boot
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.14), boot);
    foot.position.set(0, -0.28, 0.04); lowerGrp.add(foot);
    const bootTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.06, 6), boot);
    bootTop.position.set(0, -0.22, 0.04); lowerGrp.add(bootTop);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.21, 0.62, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.27, 6), shirt);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.27;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.24, 6), shirt);
    lower.position.y = -0.12; handGrp.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.25; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildArtist(color: string, g: THREE.Group): void {
  const smock = makeMat(color, 0.5);
  const skin = makeMat('#F5D5B8', 0.5);
  const pants = makeMat('#333', 0.6);
  const scarf = makeMat('#E53935', 0.6); // red scarf for contrast

  // Slim body with smock
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.55, 8), smock);
  torso.position.y = 0.5; torso.castShadow = true; g.add(torso);

  // Paint splatters on smock
  const paintColors = ['#E53935', '#1E88E5', '#FFC107', '#43A047'];
  for (let i = 0; i < 6; i++) {
    const splat = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 2), makeMat(paintColors[i % 4], 0.3));
    splat.position.set((Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.4, 0.15 + Math.random() * 0.1);
    splat.scale.set(1, 0.3, 1); g.add(splat);
  }

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  head.position.y = 0.92; head.castShadow = true; g.add(head);
  addEyes(g, 0.92, 'wide'); addMouth(g, 0.92, 'bigSmile');

  // Messy hair (multiple overlapping shapes)
  const hairMat = makeMat('#2c1810', 0.7);
  const hairBase = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairBase.position.y = 0.94; hairBase.scale.set(1, 0.5, 1); g.add(hairBase);
  for (let i = 0; i < 5; i++) {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), hairMat);
    lock.position.set((Math.random() - 0.5) * 0.2, 0.98 + Math.random() * 0.06, (Math.random() - 0.5) * 0.15);
    lock.rotation.z = (Math.random() - 0.5) * 0.5; lock.rotation.x = (Math.random() - 0.5) * 0.5; g.add(lock);
  }

  // Beret
  const beret = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.35), smock);
  beret.position.y = 1.08; beret.scale.set(1, 0.4, 1); g.add(beret);
  const beretNub = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), smock);
  beretNub.position.y = 1.12; g.add(beretNub);

  // Scarf
  const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), scarf);
  scarfRing.rotation.x = Math.PI / 2; scarfRing.position.y = 0.78; g.add(scarfRing);
  // Scarf tail
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.02), scarf);
  scarfTail.position.set(0.1, 0.55, 0.1); scarfTail.rotation.z = 0.3; g.add(scarfTail);

  // Paint palette in left hand area
  const palette = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.1), makeMat('#8D6E63', 0.4));
  palette.position.set(-0.3, 0.35, 0.12); palette.rotation.x = -0.3; g.add(palette);
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 2), makeMat(paintColors[i], 0.3));
    dot.position.set(-0.3 + (i - 1) * 0.04, 0.36, 0.16); g.add(dot);
  }

  // Legs
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.07, 0.26, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.27, 6), pants);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.27;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.25, 6), pants);
    lower.position.y = -0.12; lowerGrp.add(lower);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.12), makeMat('#5D4037', 0.5));
    shoe.position.set(0, -0.26, 0.03); lowerGrp.add(shoe);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms (slim)
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.2, 0.6, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.26, 6), smock);
    upper.position.y = 0; upper.castShadow = true; armGrp.add(upper);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.26;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.23, 6), smock);
    lower.position.y = -0.11; handGrp.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.24; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

function buildWizard(color: string, g: THREE.Group): void {
  const robe = makeMat(color, 0.3, 0.15);
  const darkRobe = makeMat('#1a1a3e', 0.4, 0.1);
  const skin = makeMat('#FDEBD0', 0.5);
  const gold = makeMat('#FFD700', 0.2, 0.8);
  const staff = makeMat('#5D4037', 0.6);

  // Tall slender body with robe
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.65, 8), robe);
  torso.position.y = 0.56; torso.castShadow = true; g.add(torso);

  // Gold sash
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.04), gold);
  sash.position.set(0.14, 0.5, 0.08); sash.rotation.z = 0.3; g.add(sash);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  head.position.y = 1.02; head.castShadow = true; g.add(head);
  addEyes(g, 1.02, 'normal'); addMouth(g, 1.02, 'smile');

  // Long white hair
  const hairMat = makeMat('#e8e8e8', 0.6);
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat);
  hairTop.position.y = 1.04; hairTop.scale.set(1, 0.35, 1); g.add(hairTop);
  // Side hair
  for (let s = -1; s <= 1; s += 2) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.06), hairMat);
    side.position.set(s * 0.14, 0.88, 0); g.add(side);
  }

  // Long white beard
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), hairMat);
  beard.position.set(0, 0.82, 0.12); beard.rotation.x = -0.2; g.add(beard);
  const beardTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), hairMat);
  beardTip.position.set(0, 0.72, 0.16); g.add(beardTip);

  // Wizard hat
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.05, 12), darkRobe);
  hatBrim.position.y = 1.14; g.add(hatBrim);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 12), darkRobe);
  cone.position.y = 1.32; g.add(cone);
  // Gold stars on hat
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), gold);
  star.position.y = 1.5; g.add(star);

  // Staff (held in right hand area)
  const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.8, 6), staff);
  staffPole.position.set(0.28, 0.5, 0.1); g.add(staffPole);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gold);
  orb.position.set(0.28, 0.9, 0.1); g.add(orb);

  // Legs (robe covers most)
  for (let s = -1; s <= 1; s += 2) {
    const legGrp = new THREE.Group();
    legGrp.position.set(s * 0.07, 0.28, 0);
    legGrp.name = s === -1 ? 'legL' : 'legR';

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.28, 6), darkRobe);
    upper.position.y = 0; upper.castShadow = true; legGrp.add(upper);

    const lowerGrp = new THREE.Group(); lowerGrp.position.y = -0.28;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 6), darkRobe);
    lower.position.y = -0.12; lowerGrp.add(lower);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.12), darkRobe);
    shoe.position.set(0, -0.26, 0.02); lowerGrp.add(shoe);

    legGrp.add(lowerGrp); g.add(legGrp);
  }

  // Arms (robe sleeves — wide)
  for (let s = -1; s <= 1; s += 2) {
    const armGrp = new THREE.Group();
    armGrp.position.set(s * 0.2, 0.66, 0);
    armGrp.name = s === -1 ? 'armL' : 'armR';

    // Wide sleeve
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 6), robe);
    sleeve.position.y = 0; sleeve.castShadow = true; armGrp.add(sleeve);

    const handGrp = new THREE.Group(); handGrp.position.y = -0.26;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 6), robe);
    forearm.position.y = -0.11; handGrp.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), skin);
    hand.position.y = -0.23; handGrp.add(hand);

    armGrp.add(handGrp); g.add(armGrp);
  }
}

// ---- Main Builder: dispatch to per-avatar builder ----

const BUILDERS: Record<AvatarId, (color: string, g: THREE.Group) => void> = {
  tycoon: buildTycoon,
  chef: buildChef,
  explorer: buildExplorer,
  athlete: buildAthlete,
  royal: buildRoyal,
  cowboy: buildCowboy,
  artist: buildArtist,
  wizard: buildWizard,
};

export function buildCharacterModel(color: string, avatar?: AvatarId): THREE.Group {
  const group = new THREE.Group();
  const builder = BUILDERS[avatar || 'tycoon'];
  builder(color, group);
  return group;
}
