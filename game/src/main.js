// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, busted and wasted screens, and saves to
// localStorage on missions, on pause and every half minute.
//
// ?seed=N fixes the city. ?shot=drive|walk|chase|mission|title (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, resetForShot, stepWorld } from './world.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { shoot } from './combat.js';
import { exitCar } from './player.js';
import { clearSave, loadGame, saveGame } from './save.js';

const MAX_FRAME = 0.25;
const SAVE_INTERVAL = 30;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hud = createHud();
const audio = createAudio();
const world = createWorld(seed);
world.audio = audio;
const renderer = createRenderer(canvas, world.city);
world.renderer = renderer;
world.saveNow = () => saveGame(world);

const titleScreen = document.getElementById('screen-title');
const pauseScreen = document.getElementById('screen-pause');
const endScreen = document.getElementById('screen-end');
const hudEl = document.getElementById('hud');
const btnContinue = document.getElementById('btn-continue');
const bestLine = document.getElementById('best-line');

function showOnly(screen) {
  titleScreen.classList.toggle('hidden', screen !== 'title');
  pauseScreen.classList.toggle('hidden', screen !== 'paused');
  endScreen.classList.toggle('hidden', screen !== 'end');
  hudEl.classList.toggle('hidden', screen !== 'play');
}

function announce(message) {
  status.textContent = message;
}

function applySave(data) {
  world.cash = data.cash;
  world.health = data.health;
  world.ammo = data.ammo;
  world.reserveAmmo = data.reserveAmmo;
  world.missions.index = data.missionIndex;
  world.missions.step = data.missionStep;
  world.missions.done = data.missionsDone || [];
  world.missions.complete = !!data.storyComplete;
  world.player.x = data.player.x;
  world.player.z = data.player.z;
  world.player.onFoot = data.player.onFoot !== false;
  if (data.wanted) world.police.wanted = data.wanted;
  if (data.stats) world.stats = data.stats;
}

function respawnAtHospital(world) {
  if (!world.player.onFoot) exitCar(world);
  world.player.x = -208;
  world.player.z = -36;
  world.player.heading = 0;
  world.health = 100;
  world.police.wanted = 0;
  world.police.units = [];
  renderer.snapBehind(world);
}

function runShot(name) {
  const screen = stageShot(name, world, renderer);
  showOnly(screen === 'title' ? 'title' : 'play');
  let painted = 0;
  function paint() {
    renderer.draw(world, world.time);
    hud.draw(world, screen === 'title' ? 'title' : 'play', 0, world.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let muted = false;
  const saved = loadGame();
  if (saved) {
    btnContinue.classList.remove('hidden');
    bestLine.textContent = `Continue: $${saved.cash} — ${saved.missionsDone ? saved.missionsDone.length : 0} missions done.`;
  }

  function startGame(fresh) {
    if (fresh) {
      resetForShot(world, Math.floor(Math.random() * 4294967296));
      clearSave();
    } else {
      const data = loadGame();
      resetForShot(world, seed);
      if (data) applySave(data);
    }
    renderer.snapBehind(world);
    screen = 'play';
    showOnly('play');
    audio.unlock();
    announce('Playing Solmar Bay. Follow the mission objective.');
  }

  function showEnd(kind) {
    screen = 'end';
    showOnly('end');
    input.release();
    const title = document.getElementById('end-title');
    const text = document.getElementById('end-text');
    if (kind === 'busted') {
      const fine = Math.min(world.cash, 250);
      world.cash -= fine;
      title.textContent = 'BUSTED!';
      text.textContent = `The Solmar Bay police caught you. Fine: $${fine}. You wake up outside the station.`;
      audio.busted();
    } else {
      const lost = Math.min(world.cash, 200);
      world.cash -= lost;
      title.textContent = 'WASTED';
      text.textContent = `You did not make it. Hospital bill: $${lost}.`;
      audio.busted();
    }
    respawnAtHospital(world);
    saveGame(world);
    announce(`${title.textContent}. Press Enter to keep playing.`);
  }

  document.getElementById('btn-new').addEventListener('click', () => startGame(true));
  btnContinue.addEventListener('click', () => startGame(false));
  document.getElementById('btn-how').addEventListener('click', () => {
    document.getElementById('howto').classList.toggle('hidden');
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    screen = 'play';
    showOnly('play');
  });
  document.getElementById('btn-restart').addEventListener('click', () => startGame(true));
  document.getElementById('btn-quit').addEventListener('click', () => {
    saveGame(world);
    screen = 'title';
    showOnly('title');
  });
  document.getElementById('btn-end').addEventListener('click', () => {
    screen = 'play';
    showOnly('play');
  });

  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (screen === 'play' && input.isLocked() && world.weapon === 'pistol') {
      shoot(world, renderer.camera);
    }
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      world.toast(muted ? 'Sound off' : 'Sound on');
    }
    if (screen === 'title' && actions & ACTION_CONFIRM) startGame(true);
    else if (screen === 'end' && actions & ACTION_CONFIRM) {
      screen = 'play';
      showOnly('play');
    } else if (screen === 'play' && actions & ACTION_PAUSE) {
      screen = 'paused';
      showOnly('paused');
      saveGame(world);
      announce('Paused.');
    } else if (screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = 'play';
      showOnly('play');
      announce('Playing.');
    }
    return actions;
  }

  function drainEvents() {
    while (world.events.length) {
      const event = world.events.shift();
      if (event.type === 'busted') showEnd('busted');
      else if (event.type === 'wasted') showEnd('wasted');
    }
    while (world.toasts.length) hud.showToast(world.toasts.shift());
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    const look = input.takeLook();
    renderer.addLook(look.x, look.y);
    if (screen === 'title') {
      // A living city behind the menu: traffic and pedestrians keep moving.
      renderer.addLook(0.5, 0);
      while (accumulator >= STEP) {
        stepWorld(world, STEP, { forward: 0, strafe: 0, run: false }, 0, renderer.getCamYaw());
        accumulator -= STEP;
      }
      drainEvents();
    } else if (screen === 'play') {
      while (accumulator >= STEP) {
        stepWorld(world, STEP, input.axes(), actions, renderer.getCamYaw());
        accumulator -= STEP;
      }
      drainEvents();
      saveTimer += 1 / 60;
      if (saveTimer > SAVE_INTERVAL) {
        saveTimer = 0;
        saveGame(world);
      }
      const driving = !world.player.onFoot && world.player.car;
      audio.engine(driving ? Math.abs(world.player.car.speed) / 40 : 0);
      audio.siren(1 / 60, world.police.sirenNear);
    } else {
      accumulator = 0;
    }
    renderer.draw(world, world.time);
    hud.draw(world, screen, 1 / 60, world.time);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      showOnly('paused');
      saveGame(world);
      announce('Paused.');
    }
  });

  showOnly('title');
  announce('Solmar Bay. Press Enter or click New Game to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
