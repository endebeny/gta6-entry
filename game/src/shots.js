// Screenshot scenes behind ?shot=drive|walk|chase|mission|title. Each one
// plays the real rules forward from a fresh world for a fixed time, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { enterCar } from './player.js';
import { resetForShot, stepWorld } from './world.js';

const DRIVE_SECONDS = 2.5;
const CHASE_SECONDS = 1.6;
const WALK_SECONDS = 1.2;
const MISSION_SECONDS = 0.8;
const SHOT_SEED = 1337;

function autopilotDrive(world, seconds) {
  const axes = { forward: 1, strafe: 0, run: false };
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, STEP, axes, 0, world.player.car ? world.player.car.heading : 0);
  }
}

function autopilotWalk(world, seconds) {
  const axes = { forward: 0, strafe: 0, run: false };
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(world, STEP, axes, 0, world.player.heading);
}

function putSportsCarOnRoad(world, x, z, heading, speed) {
  const sports = world.cars.find((c) => c.id === 'sports-plaza');
  sports.x = x;
  sports.z = z;
  sports.heading = heading;
  sports.speed = speed;
  return sports;
}

function addPoliceBehind(world, x, z, count, heading) {
  for (let i = 0; i < count; i += 1) {
    // Each unit trails the one ahead of it, along the road behind.
    const bx = x - Math.sin(heading) * i * 14;
    const bz = z - Math.cos(heading) * i * 14;
    const car = createCar(`shot-police-${i}`, 'police', bx, bz, heading, 0xeeeeee, { police: true, hp: 120 });
    car.speed = 22;
    world.police.units.push(car);
    world.cars.push(car);
  }
}

export function stageShot(name, world, renderer) {
  resetForShot(world, SHOT_SEED);
  const p = world.player;
  if (name === 'drive') {
    const sports = putSportsCarOnRoad(world, -144, 0, Math.PI / 2, 24);
    enterCar(world, sports);
    world.police.wanted = 2;
    addPoliceBehind(world, -180, 0, 1, Math.PI / 2);
    // Traffic ahead on the same avenue.
    const t1 = world.cars.find((c) => c.id === 'traffic-0');
    if (t1) { t1.x = -72; t1.z = 0; t1.heading = Math.PI / 2; t1.speed = 10; t1.targetNode = { x: 216, z: 0 }; }
    const t2 = world.cars.find((c) => c.id === 'traffic-1');
    if (t2) { t2.x = 0; t2.z = 4; t2.heading = Math.PI / 2; t2.speed = 9; t2.targetNode = { x: 216, z: 0 }; }
    autopilotDrive(world, DRIVE_SECONDS);
    renderer.snapBehind(world);
    return 'play';
  }
  if (name === 'chase') {
    const sports = putSportsCarOnRoad(world, 0, -144, 0, 34);
    enterCar(world, sports);
    world.police.wanted = 4;
    addPoliceBehind(world, 0, -180, 3, 0);
    autopilotDrive(world, CHASE_SECONDS);
    renderer.snapBehind(world);
    return 'play';
  }
  if (name === 'mission') {
    world.missions.index = 1;
    world.missions.step = 0;
    p.x = -216;
    p.z = 168;
    p.heading = Math.atan2(-216 - p.x, 180 - p.z);
    autopilotWalk(world, MISSION_SECONDS);
    renderer.snapBehind(world);
    return 'play';
  }
  if (name === 'walk') {
    p.x = 28;
    p.z = 28;
    p.heading = Math.atan2(36 - p.x, 36 - p.z);
    world.police.wanted = 1;
    autopilotWalk(world, WALK_SECONDS);
    renderer.snapBehind(world);
    return 'play';
  }
  // 'title' and anything else: the title screen over a living city.
  renderer.snapBehind(world);
  return 'title';
}
