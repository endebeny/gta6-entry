// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, flee from
// gunfire and speeding cars, and go down (then get back up elsewhere) when hit.
import { HALF, ROAD_CENTRES } from './config.js';

const SHIRTS = [0xe85a4a, 0x4a8ae8, 0x4ae88a, 0xe8d24a, 0x9a4ae8, 0xe84a9a, 0xffffff, 0x333333];

export function makePedMesh(shirtColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor || 0xc89878 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.78;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 6), pants);
  legL.position.set(-0.16, 0.3, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  return g;
}

export function createPed(id, x, z, rng) {
  return {
    id, x, z,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.2, 2.2),
    shirt: rng.pick(SHIRTS),
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
