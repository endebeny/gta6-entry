// Keyboard and mouse input. Keys are read as a held set; one-shot actions
// (enter car, punch, pause, confirm) are queued and taken once per frame.
// The mouse steers the third-person camera through pointer lock.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_WEAPON = 32;
export const ACTION_MUTE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  Digit1: ACTION_WEAPON,
  Digit2: ACTION_WEAPON,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let lookX = 0;
  let lookY = 0;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) queued |= action;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseMove(event) {
    if (!locked) return;
    lookX += event.movementX;
    lookY += event.movementY;
  }
  function onClick() {
    if (!locked && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }
  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    // -1..1 drive/strafe from WASD or arrows, camera-relative.
    axes() {
      const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const s = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, run: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    takeLook() {
      const look = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return look;
    },
    mouseDown() {
      return false; // shooting is handled by the mousedown listener in combat
    },
    isLocked() {
      return locked;
    },
    release() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
  };
}
