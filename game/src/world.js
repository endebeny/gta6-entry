// Solmar Bay's world: the one state every system reads and writes, and the
// fixed-step update that ties driving, traffic, pedestrians, police, missions
// and combat together. The renderer and HUD only read it, never change it.
import { CAR_MAX_SPEED, HALF, PED_COUNT, PARKED_COUNT, ROAD_CENTRES, STEP, TRAFFIC_COUNT } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createCar, driveCar, randomCarColor, updateTraffic } from './vehicles.js';
import { createPed, hitPed, updatePeds } from './pedestrians.js';
import { addWanted, createPolice, updatePolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat, punch } from './combat.js';
import { createPlayer, enterCar, exitCar, nearestEnterableCar, updatePlayerOnFoot } from './player.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_WEAPON } from './input.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const world = {
    seed,
    rng,
    city,
    time: 0,
    cash: 50,
    health: 100,
    ammo: 12,
    reserveAmmo: 48,
    weapon: 'fists',
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0 },
    player: createPlayer(4, 4),
    cars: [],
    peds: [],
    police: createPolice(),
    missions: createMissions(city.landmarks),
    combat: createCombat(),
    audio: null,
    renderer: null,
    events: [],
    toasts: [],
    danger: null,
    flashWanted: 0,
    lastDamage: -100,
    hitCooldown: 0,
    saveNow: null, // main.js sets this to a function that saves
    toast(message) {
      this.toasts.push(message);
    },
    addCrime(level) {
      if (level > 0) addWanted(this.police, level, this);
    },
    nearestPolice(radius) {
      return this.police.units.some((c) => Math.hypot(c.x - this.player.x, c.z - this.player.z) < radius);
    },
    damagePlayer(amount) {
      this.health -= amount;
      this.lastDamage = this.time;
      if (this.health <= 0) {
        this.health = 0;
        this.events.push({ type: 'wasted' });
      }
    },
    wreckPlayerCar() {
      const car = this.player.car;
      if (!car) return;
      car.disabled = true;
      car.hp = 0;
      exitCar(this);
      this.toast('Your car is wrecked!');
    },
    disablePoliceCar(car) {
      const ui = this.police.units.indexOf(car);
      if (ui !== -1) this.police.units.splice(ui, 1);
      const ci = this.cars.indexOf(car);
      if (ci !== -1) this.cars.splice(ci, 1);
      if (this.renderer) this.renderer.removeCarMesh(car);
      this.toast('Police car disabled!');
    },
    busted() {
      this.events.push({ type: 'busted' });
    },
  };
  populate(world);
  return world;
}

function populate(world) {
  const rng = world.rng;
  world.cars = [];
  world.peds = [];
  world.police.units = [];
  const roads = ROAD_CENTRES;
  // Traffic cruising the avenues.
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = rng.pick(roads);
    const along = rng.range(-HALF + 20, HALF - 20);
    const car = createCar(`traffic-${i}`, 'traffic', horizontal ? along : road, horizontal ? road : along, rng.range(0, Math.PI * 2), randomCarColor(rng));
    car.speed = rng.range(7, 11);
    world.cars.push(car);
  }
  // Parked cars along the kerbs.
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const road = rng.pick(roads);
    const along = rng.range(-HALF + 20, HALF - 20);
    const side = rng.chance(0.5) ? 1 : -1;
    const horizontal = rng.chance(0.5);
    const car = createCar(`parked-${i}`, 'parked', horizontal ? along : road + side * 7, horizontal ? road + side * 7 : along, horizontal ? Math.PI / 2 : 0, randomCarColor(rng));
    world.cars.push(car);
  }
  // The red sports car by the Plaza, for the Hot Wheels job.
  const sports = createCar('sports-plaza', 'parked', 30, 30, Math.PI / 2, 0xc21807, { sports: true });
  world.cars.push(sports);
  // The player's own starter car near the Plaza.
  const starter = createCar('player-starter', 'player', 28, 0, Math.PI / 2, 0x2e6ac2);
  world.cars.push(starter);
  for (let i = 0; i < PED_COUNT; i += 1) {
    world.peds.push(createPed(`ped-${i}`, rng.range(-160, 160), rng.range(-160, 160), rng));
  }
}

// Rebuild the world for a screenshot scene: fresh entities, same systems.
export function resetForShot(world, seed) {
  if (world.renderer) {
    for (const car of world.cars) world.renderer.removeCarMesh(car);
    for (const ped of world.peds) world.renderer.removePedMesh(ped);
  }
  world.rng = createRandom(seed);
  world.time = 0;
  world.cash = 50;
  world.health = 100;
  world.ammo = 12;
  world.reserveAmmo = 48;
  world.weapon = 'fists';
  world.stats = { carsStolen: 0, pedsHit: 0, missionsDone: 0 };
  world.player = createPlayer(4, 4);
  world.police = createPolice();
  world.missions = createMissions(world.city.landmarks);
  world.combat = createCombat();
  world.events = [];
  world.toasts = [];
  world.danger = null;
  world.lastDamage = -100;
  populate(world);
}

function checkMissions(world) {
  const m = world.missions;
  const step = m.currentStep();
  if (!step) return;
  const p = world.player;
  let done = false;
  if (step.needCar && !p.onFoot) done = true;
  else if (step.needSports && p.car && p.car.isSports) done = true;
  else if (step.needClean && world.police.wanted === 0) done = true;
  else if (step.target && Math.hypot(p.x - step.target.x, p.z - step.target.z) < step.target.r) done = true;
  if (!done) return;
  const result = m.advance(world);
  if (result === 'step') {
    world.toast('Objective updated.');
  } else if (result === 'mission') {
    const finished = m.list[m.index - 1];
    world.stats.missionsDone += 1;
    world.toast(`Mission complete! +$${finished.reward}`);
    if (world.audio) world.audio.mission();
    if (world.saveNow) world.saveNow();
    const next = m.current();
    if (next && next.id === 'hotwheels') {
      world.addCrime(2);
      world.toast('The cops are onto the sports car — run!');
    } else if (next && next.id === 'getaway') {
      world.addCrime(3);
      world.toast('Every unit in the city is after you!');
    }
  } else if (result === 'story') {
    world.stats.missionsDone += 1;
    world.toast('Story complete! Solmar Bay is yours.');
    if (world.audio) world.audio.mission();
    if (world.saveNow) world.saveNow();
  }
}

export function stepWorld(world, dt, axes, actions, camYaw) {
  world.time += dt;
  world.combat.cooldown = Math.max(0, world.combat.cooldown - dt);
  world.combat.muzzle = Math.max(0, world.combat.muzzle - dt);
  world.flashWanted = Math.max(0, world.flashWanted - dt);
  world.hitCooldown = Math.max(0, world.hitCooldown - dt);
  const p = world.player;

  if (actions & ACTION_ENTER) {
    if (p.onFoot) {
      const car = nearestEnterableCar(p, world.cars);
      if (car) enterCar(world, car);
    } else {
      exitCar(world);
    }
  }
  if (actions & ACTION_PUNCH && p.onFoot) punch(world);
  if (actions & ACTION_WEAPON) {
    world.weapon = world.weapon === 'fists' ? 'pistol' : 'fists';
    world.toast(world.weapon === 'pistol' ? 'Pistol out — click to shoot' : 'Fists out');
  }
  if (actions & ACTION_RELOAD && world.weapon === 'pistol') {
    const need = 12 - world.ammo;
    const take = Math.min(need, world.reserveAmmo);
    if (take > 0) {
      world.ammo += take;
      world.reserveAmmo -= take;
      world.toast('Reloaded.');
    }
  }

  // Move. While driving, the player rides with the car: keep their position
  // on the car, since missions, police and the camera all read the player.
  if (p.onFoot) updatePlayerOnFoot(p, axes, camYaw, dt, world.city.buildings);
  else if (p.car) {
    driveCar(p.car, axes, dt, world.city.buildings);
    p.x = p.car.x;
    p.z = p.car.z;
  }

  // Driving into pedestrians and traffic.
  if (!p.onFoot && p.car) {
    const car = p.car;
    if (Math.abs(car.speed) > 4) {
      const ped = hitPed(world.peds, car.x, car.z, 2.3);
      if (ped) {
        world.stats.pedsHit += 1;
        world.addCrime(1);
        world.toast('You hit a pedestrian!');
        world.danger = { x: car.x, z: car.z, radius: 24 };
      }
    }
    for (const other of world.cars) {
      if (other === car || other.kind === 'parked') continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 4.2 && d > 0.01) {
        const push = (4.2 - d) / 2;
        const nx = (other.x - car.x) / d;
        const nz = (other.z - car.z) / d;
        other.x += nx * push;
        other.z += nz * push;
        car.x -= nx * push * 0.5;
        car.z -= nz * push * 0.5;
        car.speed *= 0.94;
        other.speed *= 0.9;
      }
    }
  } else {
    // On foot, a moving car can run the player down.
    for (const car of world.cars) {
      if (Math.abs(car.speed) < 2) continue;
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < 2.2 && world.hitCooldown <= 0) {
        world.hitCooldown = 1;
        world.damagePlayer(18);
        world.toast('You were hit by a car!');
      }
    }
  }

  // Traffic, pedestrians, police.
  for (const car of world.cars) {
    if (car.kind === 'traffic') updateTraffic(car, dt, world.rng, world.cars, world.city.buildings);
  }
  updatePeds(world.peds, dt, world.rng, world.danger);
  updatePolice(world.police, world, dt, world.rng);

  // Health slowly recovers out of trouble.
  if (world.time - world.lastDamage > 8 && world.health > 0) {
    world.health = Math.min(100, world.health + 2 * dt);
  }

  checkMissions(world);
}
