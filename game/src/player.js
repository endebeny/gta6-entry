// The player on foot: walk, run and jump, and getting in and out of cars.
// Movement is camera-relative; the camera yaw lives in the renderer and is
// passed in each step.
import { PLAYER_RUN, PLAYER_WALK } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayer(x, z) {
  return {
    x, z, heading: 0,
    onFoot: true,
    car: null,
    vy: 0, // vertical velocity for the little hop
    y: 0,
    mesh: null,
    walkPhase: 0,
  };
}

export function updatePlayerOnFoot(player, axes, camYaw, dt, buildings) {
  const speed = axes.run ? PLAYER_RUN : PLAYER_WALK;
  // Camera-relative: forward is where the camera looks.
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = -Math.sin(camYaw);
  let mx = fx * axes.forward + rx * axes.strafe;
  let mz = fz * axes.forward + rz * axes.strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    player.heading = Math.atan2(mx, mz);
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    const res = collideBuildings(buildings, nx, nz, 0.7);
    player.x = res.x;
    player.z = res.z;
    player.walkPhase += dt * speed * 1.6;
  }
  // Hop: a small jump with Space is the confirm key while playing.
  if (player.vy !== 0 || player.y > 0) {
    player.vy -= 22 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
    }
  }
}

// Nearest car the player could steal, within reach and roughly in front.
export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestD = 3.4;
  for (const car of cars) {
    if (car.kind === 'police' || car.disabled) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

export function enterCar(world, car) {
  const player = world.player;
  player.onFoot = false;
  player.car = car;
  car.driver = 'player';
  if (car.kind !== 'player') {
    car.stolen = true;
    world.stats.carsStolen += 1;
    // Stealing in front of the police is a crime; a clean getaway is not.
    if (world.nearestPolice(70)) {
      world.addCrime(1);
      world.toast('Car stolen — the cops saw you!');
    } else {
      world.toast('Car stolen — clean getaway.');
    }
  }
  player.x = car.x;
  player.z = car.z;
}

export function exitCar(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.speed *= 0.3;
  player.onFoot = true;
  player.car = null;
  // Step out to the side of the car.
  player.x = car.x + Math.cos(car.heading) * 2.2;
  player.z = car.z - Math.sin(car.heading) * 2.2;
  const res = collideBuildings(world.city.buildings, player.x, player.z, 0.7);
  player.x = res.x;
  player.z = res.z;
}
