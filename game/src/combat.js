// Combat: fists and a pistol. Punching hits what is in front of the player;
// the pistol fires a hitscan shot from the camera toward the crosshair and
// can wreck cars and drop pedestrians. Shooting in public raises the heat.
import { PISTOL_DAMAGE, PUNCH_DAMAGE, PUNCH_RANGE } from './config.js';
import { hitPed } from './pedestrians.js';

export function createCombat() {
  return { cooldown: 0, muzzle: 0 };
}

export function punch(world) {
  const p = world.player;
  const audio = world.audio;
  if (world.combat.cooldown > 0) return;
  world.combat.cooldown = 0.35;
  if (audio) audio.punch();
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const hx = p.x + fx * PUNCH_RANGE * 0.6;
  const hz = p.z + fz * PUNCH_RANGE * 0.6;
  const ped = hitPed(world.peds, hx, hz, PUNCH_RANGE);
  if (ped) {
    world.police && world.addCrime(1);
    world.toast('You knocked someone down!');
    return;
  }
  // Punch a police car: dents it, and the cops notice.
  for (const car of world.police.units) {
    if (Math.hypot(car.x - hx, car.z - hz) < 3) {
      car.hp -= PUNCH_DAMAGE;
      world.addCrime(1);
      if (car.hp <= 0) world.disablePoliceCar(car);
      return;
    }
  }
}

export function shoot(world, camera) {
  const p = world.player;
  if (world.weapon !== 'pistol' || world.ammo <= 0) {
    if (world.ammo <= 0) world.toast('Out of ammo — press R to reload');
    return;
  }
  if (world.combat.cooldown > 0) return;
  world.combat.cooldown = 0.22;
  world.combat.muzzle = 0.06;
  world.ammo -= 1;
  if (world.audio) world.audio.shot();
  // Hitscan from the camera through the crosshair, out to 70 m.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ox = camera.position.x;
  const oz = camera.position.z;
  let best = null;
  let bestD = 70;
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - ox;
    const dz = ped.z - oz;
    const along = dx * dir.x + dz * dir.z;
    if (along < 1 || along > bestD) continue;
    const side = Math.abs(dx * dir.z - dz * dir.x);
    if (side < 1.2) {
      best = { kind: 'ped', target: ped };
      bestD = along;
    }
  }
  for (const car of world.cars) {
    if (car === p.car) continue;
    const dx = car.x - ox;
    const dz = car.z - oz;
    const along = dx * dir.x + dz * dir.z;
    if (along < 1 || along > bestD) continue;
    const side = Math.abs(dx * dir.z - dz * dir.x);
    if (side < 2.4) {
      best = { kind: 'car', target: car };
      bestD = along;
    }
  }
  if (!best) {
    world.addCrime(0); // a shot in the air still draws attention nearby
    if (world.nearestPolice(40)) world.addCrime(1);
    return;
  }
  if (best.kind === 'ped') {
    hitPed(world.peds, best.target.x, best.target.z, 0.6);
    world.addCrime(1);
    world.toast('Pedestrian down!');
    world.danger = { x: best.target.x, z: best.target.z, radius: 24 };
  } else {
    const car = best.target;
    car.hp -= PISTOL_DAMAGE;
    world.addCrime(1);
    if (car.kind === 'police') {
      if (car.hp <= 0) world.disablePoliceCar(car);
    } else if (car.hp <= 0) {
      car.hp = 0;
      car.disabled = true;
      world.toast('Car wrecked!');
    }
  }
}
