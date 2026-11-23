// Cars: building them, driving them, and the traffic that fills the avenues.
// A car is a small group of boxes; its physics are arcade-style: accelerate,
// brake, steer by speed, and slide a little through corners.
import { CAR_ACCEL, CAR_BRAKE, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_TURN, HALF, ROAD_CENTRES } from './config.js';
import { collideBuildings, nearestRoad } from './city.js';

const CAR_COLORS = [0xc23a2e, 0x2e6ac2, 0xe8b93a, 0x3a9e5e, 0x8a4ac2, 0xd8d8d8, 0x222226, 0xe87a2e, 0x3ac2b8];

export function makeCarMesh(color, isPolice, isSports) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const len = isSports ? 4.8 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, len), bodyMat);
  body.position.y = 0.65;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, len * 0.45), glassMat);
  cabin.position.set(0, 1.3, -len * 0.05);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  for (const [wx, wz] of [[-0.95, len / 2 - 0.8], [0.95, len / 2 - 0.8], [-0.95, -len / 2 + 0.8], [0.95, -len / 2 + 0.8]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
  }
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, len * 0.7), new THREE.MeshLambertMaterial({ color: 0x111144 }));
    stripe.position.y = 0.85;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xaa1111 }));
    bar.position.set(0, 1.75, 0);
    bar.name = 'lightbar';
    g.add(bar);
  }
  if (isSports) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.3), darkMat);
    spoiler.position.set(0, 1.15, -len / 2 + 0.15);
    g.add(spoiler);
  }
  return g;
}

export function createCar(id, kind, x, z, heading, color, opts = {}) {
  return {
    id, kind, x, z, heading,
    speed: 0,
    color,
    isPolice: !!opts.police,
    isSports: !!opts.sports,
    hp: opts.hp || 100,
    mesh: null,
    // traffic AI
    targetNode: null,
    wait: 0,
    // police AI
    path: [],
    pathTimer: 0,
    // state
    smoke: false,
    stolen: false,
  };
}

// Grid nodes the traffic and police navigate: every road intersection.
export function gridNodes() {
  const nodes = [];
  for (const x of ROAD_CENTRES) for (const z of ROAD_CENTRES) nodes.push({ x, z });
  return nodes;
}

function nearestNode(x, z) {
  return { x: nearestRoad(x), z: nearestRoad(z) };
}

// Breadth-first route across the intersection grid.
export function findRoute(from, to) {
  const key = (n) => `${n.x},${n.z}`;
  const start = nearestNode(from.x, from.z);
  const goal = nearestNode(to.x, to.z);
  if (start.x === goal.x && start.z === goal.z) return [goal];
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.z === goal.z) break;
    for (const n of ROAD_CENTRES) {
      for (const cand of [{ x: n, z: cur.z }, { x: cur.x, z: n }]) {
        if ((cand.x !== cur.x && cand.z !== cur.z) || (cand.x === cur.x && cand.z === cur.z)) continue;
        if (!prev.has(key(cand))) {
          prev.set(key(cand), cur);
          queue.push(cand);
        }
      }
    }
  }
  const route = [];
  let cur = goal;
  while (cur) {
    route.unshift(cur);
    cur = prev.get(key(cur));
  }
  return route.length > 1 ? route.slice(1) : [goal];
}

function angleTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

function turnToward(car, targetHeading, dt, rate) {
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  car.heading += step;
  return diff;
}

// Arcade driving for the player's car. input.forward: 1 throttle, -1 brake/reverse.
export function driveCar(car, input, dt, buildings) {
  const forward = input.forward;
  const steer = input.strafe;
  if (forward > 0) car.speed += CAR_ACCEL * (car.isSports ? 1.3 : 1) * dt;
  else if (forward < 0) {
    car.speed -= (car.speed > 0.5 ? CAR_BRAKE : CAR_ACCEL * 0.7) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  const max = car.isSports ? CAR_MAX_SPEED * 1.25 : CAR_MAX_SPEED;
  car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(max, car.speed));
  const steerRate = CAR_TURN * Math.min(1, Math.abs(car.speed) / 10 + 0.25);
  car.heading += steer * steerRate * dt * Math.sign(car.speed || 1) * -1;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const res = collideBuildings(buildings, nx, nz, 2.1);
  if (res.hit && Math.abs(car.speed) > 8) car.speed *= 0.45;
  car.x = res.x;
  car.z = res.z;
  car.x = Math.max(-HALF - 30, Math.min(HALF + 40, car.x));
  car.z = Math.max(-HALF - 30, Math.min(HALF + 60, car.z));
}

// One traffic car: cruise its lane, turn at intersections, slow for the car ahead.
export function updateTraffic(car, dt, rng, cars, buildings) {
  if (car.wait > 0) {
    car.wait -= dt;
    return;
  }
  if (!car.targetNode) {
    const node = nearestNode(car.x, car.z);
    const dirs = ROAD_CENTRES.filter((c) => c !== node.x && c !== node.z);
    car.targetNode = rng.chance(0.5)
      ? { x: rng.pick(dirs), z: node.z }
      : { x: node.x, z: rng.pick(dirs) };
  }
  const t = car.targetNode;
  const dx = t.x - car.x;
  const dz = t.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    car.targetNode = null;
    car.wait = rng.chance(0.25) ? rng.range(0.5, 1.5) : 0;
    return;
  }
  const want = angleTo(car.x, car.z, t.x, t.z);
  turnToward(car, want, dt, 2.2);
  // Slow down for a car directly ahead.
  let clear = 14;
  for (const other of cars) {
    if (other === car || other.kind === 'parked') continue;
    const ox = other.x - car.x;
    const oz = other.z - car.z;
    const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
    const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
    if (ahead > 0 && ahead < clear && side < 3) clear = ahead;
  }
  const targetSpeed = clear < 10 ? Math.max(0, clear - 4) : 10;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const res = collideBuildings(buildings, nx, nz, 2.1);
  car.x = res.x;
  car.z = res.z;
  if (res.hit) car.targetNode = null;
}

export function randomCarColor(rng) {
  return rng.pick(CAR_COLORS);
}
