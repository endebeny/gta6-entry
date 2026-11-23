// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, flee from
// gunfire and speeding cars, and go down (then get back up elsewhere) when hit.
// Each one is built like a person — head with hair and eyes, neck, a torso
// with shoulders, arms and legs that swing as they walk, and shoes — with
// skin, hair, clothes and build varied so the crowd reads like GTA 5's,
// not a row of clones.
import { HALF, ROAD_CENTRES } from './config.js';

const SHIRTS = [0xe85a4a, 0x4a8ae8, 0x4ae88a, 0xe8d24a, 0x9a4ae8, 0xe84a9a, 0xffffff, 0x333333, 0xe87a2a, 0x2a8a7a, 0xc84a6a, 0x6a8a2a, 0x4a6a8a, 0xd8b8e8];
const SKINS = [0xf0c8a0, 0xc89878, 0xa06848, 0x6e4530, 0xe8b088];
const HAIRS = [0x1a1210, 0x4a2e18, 0x8a6a3a, 0x9a9a9a, 0x7a2a1a, 0x2a2a2a];
const PANTS = [0x2e3a4a, 0x3a4a5a, 0x1a1a1a, 0x6a5a3a, 0x4a4a4a, 0x5a3a2a];
const CAPS = [0x222226, 0x8a2a2a, 0x2a4a8a, 0x3a6a3a, 0xd8d8d8];
const HAIRSTYLES = ['short', 'long', 'bun', 'cap', 'bald'];
const SHOE = 0x1c1c20;

// One shared material per colour: the crowd reuses a handful of colours,
// so a cache keeps the material count (and the draw setup) small.
const matCache = new Map();
function lambert(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}
const EYE = lambert(0x1a1210);

// Body builds: slim, average, stocky — width and height factors.
const BUILDS = {
  slim: { w: 0.85, h: 0.95 },
  avg: { w: 1.0, h: 1.0 },
  stocky: { w: 1.28, h: 0.98 },
};

export function makePedMesh(o) {
  const build = BUILDS[o.build || 'avg'] || BUILDS.avg;
  const h = build.h;
  const w = build.w;
  const g = new THREE.Group();
  const shirt = lambert(o.shirt);
  const skin = lambert(o.skin || 0xc89878);
  const pants = lambert(o.pants || 0x2e3a4a);
  const hairMat = lambert(o.hair || 0x1a1210);

  // Legs: pivoted at the hip so they swing while walking. Each leg is a
  // cylinder with a shoe box at its foot.
  const hipY = 0.92 * h;
  const legLen = 0.86 * h;
  const legRad = 0.11 * w;
  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.13 * w * side, hipY, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legRad, legRad * 0.9, legLen, 8), pants);
    leg.position.y = -legLen / 2;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16 * w, 0.09, 0.3), lambert(SHOE));
    shoe.position.set(0, -legLen + 0.02, 0.05);
    pivot.add(shoe);
    g.add(pivot);
    return pivot;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // Torso: a tapered cylinder, wider at the waist than the shoulders, so the
  // silhouette reads as a jacket over hips rather than a tube.
  const torsoH = 0.62 * h;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20 * w, 0.24 * w, torsoH, 10),
    shirt
  );
  torso.position.y = hipY + torsoH / 2;
  g.add(torso);

  // Arms: pivoted at the shoulder so they swing against the legs, with a
  // skin hand at the end of each sleeve.
  const shoulderY = hipY + torsoH - 0.06 * h;
  const armLen = 0.6 * h;
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.27 * w * side, shoulderY, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * w, 0.06 * w, armLen, 8), shirt);
    arm.position.y = -armLen / 2;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07 * w, 8, 6), skin);
    hand.position.y = -armLen;
    pivot.add(hand);
    g.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Neck and head.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 8), skin);
  neck.position.y = hipY + torsoH + 0.05;
  g.add(neck);
  const headY = hipY + torsoH + 0.26 * h;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = headY;
  g.add(head);
  // Eyes: two dark dots on the front of the face, so the head reads as a
  // face at a glance instead of a blank ball.
  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, EYE);
  eyeL.position.set(-0.09, headY + 0.02, 0.205);
  g.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, EYE);
  eyeR.position.set(0.09, headY + 0.02, 0.205);
  g.add(eyeR);

  // Hair, by style. The face stays clear: hair frames the top and back.
  const style = o.hairStyle || 'short';
  if (style === 'short') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), hairMat);
    hair.scale.set(1, 0.62, 1);
    hair.position.set(0, headY + 0.1, -0.02);
    g.add(hair);
  } else if (style === 'long') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), hairMat);
    top.scale.set(1, 0.62, 1);
    top.position.set(0, headY + 0.1, -0.02);
    g.add(top);
    // A panel of hair down the back, so the silhouette reads as long hair.
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.12), hairMat);
    back.position.set(0, headY - 0.15, -0.22);
    g.add(back);
  } else if (style === 'bun') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), hairMat);
    hair.scale.set(1, 0.62, 1);
    hair.position.set(0, headY + 0.1, -0.02);
    g.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hairMat);
    bun.position.set(0, headY + 0.2, -0.2);
    g.add(bun);
  } else if (style === 'cap') {
    const capMat = lambert(o.capColor || 0x222226);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.1, 12), capMat);
    cap.position.y = headY + 0.18;
    g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.18), capMat);
    brim.position.set(0, headY + 0.14, 0.26);
    g.add(brim);
  }
  // 'bald' gets no hair.

  // Individual height: a small uniform scale so no two people are the
  // same height. The group origin is at the ground, so feet stay planted.
  if (o.height && o.height !== 1) g.scale.setScalar(o.height);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPed(id, x, z, rng) {
  return {
    id, x, z,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.2, 2.2),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    hairStyle: rng.pick(HAIRSTYLES),
    capColor: rng.pick(CAPS),
    pants: rng.pick(PANTS),
    build: rng.pick(['slim', 'avg', 'avg', 'stocky']),
    height: rng.range(0.94, 1.06),
    walkPhase: rng.range(0, Math.PI * 2),
    target: null,
    state: 'walk', // walk | flee | down
    downTimer: 0,
    mesh: null,
  };
}

function randomSidewalkPoint(rng) {
  // Any sidewalk: just inside a block edge, near a road.
  const road = rng.pick(ROAD_CENTRES);
  const along = rng.range(-HALF + 16, HALF - 16);
  return rng.chance(0.5)
    ? { x: along, z: road + (rng.chance(0.5) ? 10 : -10) }
    : { x: road + (rng.chance(0.5) ? 10 : -10), z: along };
}

export function updatePeds(peds, dt, rng, danger) {
  // danger: {x, z, radius} a car or shot the crowd flees from, or null.
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        const p = randomSidewalkPoint(rng);
        ped.x = p.x;
        ped.z = p.z;
        ped.state = 'walk';
        ped.target = null;
      }
      continue;
    }
    if (danger) {
      const d = Math.hypot(ped.x - danger.x, ped.z - danger.z);
      if (d < danger.radius) {
        ped.state = 'flee';
        ped.target = { x: ped.x + (ped.x - danger.x) * 2, z: ped.z + (ped.z - danger.z) * 2 };
      }
    }
    if (ped.state === 'flee') {
      const t = ped.target;
      const dx = t.x - ped.x;
      const dz = t.z - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        ped.state = 'walk';
        ped.target = null;
      } else {
        ped.heading = Math.atan2(dx, dz);
        ped.x += Math.sin(ped.heading) * 4.5 * dt;
        ped.z += Math.cos(ped.heading) * 4.5 * dt;
        ped.walkPhase += 4.5 * dt * 2.6;
      }
      continue;
    }
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 2) {
      ped.target = randomSidewalkPoint(rng);
    }
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    ped.heading = Math.atan2(dx, dz);
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.walkPhase += ped.speed * dt * 2.6;
    ped.x = Math.max(-HALF - 10, Math.min(HALF + 10, ped.x));
    ped.z = Math.max(-HALF - 10, Math.min(HALF + 40, ped.z));
  }
}

// Knock a pedestrian down at (x,z): returns the ped hit, or null.
export function hitPed(peds, x, z, radius) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.z - z) < radius) {
      ped.state = 'down';
      ped.downTimer = 6;
      return ped;
    }
  }
  return null;
}
