// Saving: the whole campaign state in localStorage, written on mission
// completion, on pause and every half minute of play.
import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      cash: world.cash,
      health: world.health,
      ammo: world.ammo,
      reserveAmmo: world.reserveAmmo,
      missionIndex: world.missions.index,
      missionStep: world.missions.step,
      missionsDone: world.missions.done,
      storyComplete: world.missions.complete,
      player: { x: world.player.x, z: world.player.z, onFoot: world.player.onFoot },
      wanted: world.police.wanted,
      stats: world.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
