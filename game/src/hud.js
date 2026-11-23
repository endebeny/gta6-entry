// The HUD: cash, health, wanted stars, the mission objective, speed and the
// minimap — a live top-down map of the city with the player, traffic, police
// and the mission waypoint. All DOM, drawn over the 3D canvas.
import { HALF, ROAD_CENTRES } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('cash');
  const healthFill = el('health-fill');
  const starsEl = el('stars');
  const objectiveEl = el('objective');
  const speedEl = el('speed');
  const toastEl = el('toast');
  const crosshairEl = el('crosshair');
  const vignetteEl = el('vignette');
  const map = el('minimap');
  const mapCtx = map.getContext('2d');
  let toastTimer = 0;
  let lastToast = '';

  function drawMap(world, time) {
    const S = map.width;
    const scale = S / (HALF * 2 + 60);
    const toX = (x) => (x + HALF + 30) * scale;
    const toY = (z) => (z + HALF + 30) * scale;
    mapCtx.fillStyle = '#101418';
    mapCtx.fillRect(0, 0, S, S);
    // Bay water along the bottom.
    mapCtx.fillStyle = '#1e5a74';
    mapCtx.fillRect(0, toY(HALF), S, S - toY(HALF));
    // Roads.
    mapCtx.strokeStyle = '#3a3f46';
    mapCtx.lineWidth = 5;
    for (const c of ROAD_CENTRES) {
      mapCtx.beginPath();
      mapCtx.moveTo(toX(-HALF), toY(c));
      mapCtx.lineTo(toX(HALF), toY(c));
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(toX(c), toY(-HALF));
      mapCtx.lineTo(toX(c), toY(HALF));
      mapCtx.stroke();
    }
    // Blocks.
    mapCtx.fillStyle = '#23282e';
    for (let bx = 0; bx < 6; bx += 1) {
      for (let bz = 0; bz < 6; bz += 1) {
        const x = -HALF + 16 + bx * 72;
        const z = -HALF + 16 + bz * 72;
        mapCtx.fillRect(toX(x), toY(z), 56 * scale, 56 * scale);
      }
    }
    // Mission waypoint.
    const wp = world.missions.waypoint();
    if (wp) {
      const pulse = 4 + Math.sin(time * 4) * 1.5;
      mapCtx.fillStyle = '#ffd23a';
      mapCtx.beginPath();
      mapCtx.arc(toX(wp.x), toY(wp.z), pulse, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffd23a';
      mapCtx.lineWidth = 1.5;
      mapCtx.beginPath();
      mapCtx.arc(toX(wp.x), toY(wp.z), pulse + 5, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Traffic.
    for (const car of world.cars) {
      if (car.kind === 'police') continue;
      mapCtx.fillStyle = '#e8c33a';
      mapCtx.fillRect(toX(car.x) - 1.5, toY(car.z) - 1.5, 3, 3);
    }
    // Police: flashing red/blue.
    const flash = Math.floor(time * 2) % 2 === 0;
    for (const car of world.police.units) {
      mapCtx.fillStyle = flash ? '#ff4444' : '#4488ff';
      mapCtx.beginPath();
      mapCtx.arc(toX(car.x), toY(car.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Player arrow.
    const p = world.player;
    mapCtx.save();
    mapCtx.translate(toX(p.x), toY(p.z));
    mapCtx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4.5, 5);
    mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  return {
    showToast(message) {
      if (message === lastToast) return;
      lastToast = message;
      toastEl.textContent = message;
      toastEl.style.opacity = '1';
      toastTimer = 3;
    },
    draw(world, screen, dt, time) {
      const playing = screen === 'play';
      cashEl.textContent = `$${world.cash.toLocaleString('en-US')}`;
      healthFill.style.width = `${Math.max(0, world.health)}%`;
      healthFill.style.background = world.health > 50 ? '#4ae88a' : world.health > 25 ? '#e8b93a' : '#e84a3a';
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < world.police.wanted ? '★' : '☆';
      starsEl.textContent = stars;
      starsEl.style.color = world.police.wanted > 0 ? '#ffd23a' : '#888888';
      objectiveEl.textContent = world.missions.objectiveText();
      const driving = !world.player.onFoot && world.player.car;
      speedEl.textContent = driving ? `${Math.round(Math.abs(world.player.car.speed) * 3.6)} km/h` : '';
      crosshairEl.style.display = playing && world.weapon === 'pistol' ? 'block' : 'none';
      vignetteEl.style.opacity = String(Math.max(0, (30 - world.health) / 60));
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.style.opacity = '0';
      }
      if (playing) drawMap(world, time);
    },
  };
}
