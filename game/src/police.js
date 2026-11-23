// The Solmar Bay Police Department: wanted stars, pursuit cars that chase
// along the road grid, ramming, and the busted timer when they corner you.
import { MAX_WANTED, ROAD_CENTRES } from './config.js';
import { createCar, findRoute } from './vehicles.js';

export function createPolice() {
  return {
    wanted: 0,
    crimeTimer: 0, // seconds since the last crime
    decayTimer: 0,
    bustTimer: 0,
    units: [], // police cars (also in world.cars)
    sirenNear: false,
  };
}

export function addWanted(police, level, world) {
  if (police.wanted >= MAX_WANTED) return;
  police.wanted = Math.min(MAX_WANTED, police.wanted + level);
  police.crimeTimer = 0;
  police.decayTimer = 0;
  if (world) world.flashWanted = 0.6;
}

// Where a pursuit car enters: a road intersection some distance from the player.
function spawnPoint(rng, px, pz) {
  const roads = ROAD_CENTRES;
  for (let tries = 0; tries < 12; tries += 1) {
    const x = rng.pick(roads);
    const z = rng.pick(roads);
    const d = Math.hypot(x - px, z - pz);
    if (d > 55 && d < 130) return { x, z };
  }
  return { x: -180, z: -180 };
}

export function updatePolice(police, world, dt, rng) {
  const player = world.player;
  police.crimeTimer += dt;

  // Wanted decays once the heat is off: 20 s clean, then a star every 8 s.
  if (police.wanted > 0 && police.crimeTimer > 20) {
    police.decayTimer += dt;
    if (police.decayTimer > 8) {
      police.decayTimer = 0;
      police.wanted -= 1;
    }
  }

  // Keep the right number of pursuit cars on the street.
  const wantUnits = police.wanted === 0 ? 0 : Math.min(police.wanted, 4);
  while (police.units.length < wantUnits) {
    const p = spawnPoint(rng, player.x, player.z);
    const car = createCar(`police-${Date.now()}-${police.units.length}`, 'police', p.x, p.z, 0, 0xeeeeee, { police: true, hp: 120 });
    car.speed = 12;
    police.units.push(car);
    world.cars.push(car);
  }
  while (police.units.length > wantUnits) {
    const car = police.units.pop();
    const idx = world.cars.indexOf(car);
    if (idx !== -1) world.cars.splice(idx, 1);
    if (world.renderer) world.renderer.removeCarMesh(car);
  }

  // Each unit follows a grid route to the player's block, then rams.
  police.sirenNear = false;
  for (const car of police.units) {
    const dPlayer = Math.hypot(car.x - player.x, car.z - player.z);
    if (dPlayer < 60) police.sirenNear = true;
    car.pathTimer -= dt;
    if (car.pathTimer <= 0 || car.path.length === 0) {
      car.path = findRoute(car, player);
      car.pathTimer = 2;
    }
    const node = car.path[0];
    const dx = node.x - car.x;
    const dz = node.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      car.path.shift();
      continue;
    }
    // Close in, the unit stops chasing the route and bears down on the player,
    // creeping alongside so the bust timer can run.
    const close = dPlayer < 10;
    const wantHeading = close ? Math.atan2(player.x - car.x, player.z - car.z) : Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Close in: creep and hold. Far off: cruise, then ram speed.
    const targetSpeed = close ? 2 : dPlayer < 12 ? 26 : 20;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Ram the player: on foot it hurts, in a car it wrecks it.
    if (dPlayer < 3.2) {
      if (player.onFoot) {
        world.damagePlayer(14 * dt);
      } else if (player.car) {
        player.car.hp -= 26 * dt;
        player.car.speed *= 1 - 0.6 * dt;
        if (player.car.hp <= 0) world.wreckPlayerCar();
      }
    }
  }

  // Busted: a unit stays glued to a slow player.
  const nearSlow = police.units.some((c) => {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    const speed = player.onFoot ? 0 : Math.abs(player.car ? player.car.speed : 0);
    return d < 4.5 && speed < 3;
  });
  if (police.wanted > 0 && nearSlow) {
    police.bustTimer += dt;
    if (police.bustTimer > 2.5) {
      police.bustTimer = 0;
      world.busted();
    }
  } else {
    police.bustTimer = 0;
  }
}
