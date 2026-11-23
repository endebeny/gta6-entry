// The city of Solmar Bay: a sun-soaked coastal grid with a marina, a beach
// and a downtown of pastel towers. Builds the static three.js meshes once and
// returns the layout the gameplay systems collide and navigate against:
// building footprints, road centrelines, spawn points and named landmarks.
import { BLOCK, GRID, HALF, PALETTE, PITCH, ROAD, ROAD_CENTRES } from './config.js';

function makeWindowTexture(rng, litChance, glassA, glassB) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#e8ddc0';
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      const lit = rng.chance(litChance);
      g.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? glassA : glassB);
      g.fillRect(x, y, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function box(w, h, d, color, x, y, z, group, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

export function createCity(rng) {
  const group = new THREE.Group();
  const buildings = []; // {minX,maxX,minZ,maxZ,h} collision footprints
  const landmarks = {};
  const windowTex = makeWindowTexture(rng, 0.24, '#2e4a5e', '#3e5a6e');
  // A second facade so not every tower wears the same lit windows: fewer
  // lights on and a cooler glass, for the towers across the street.
  const windowTexB = makeWindowTexture(rng, 0.12, '#24384a', '#4a6a7e');

  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water });

  // Ground, beach and bay to the south (positive z).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 160, HALF * 2 + 160), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 160, 60), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, HALF + 30);
  group.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 160, 220), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.3, HALF + 170);
  group.add(water);

  // Roads: dark strips with a dashed centre line, plus sidewalks. Two dash
  // textures: dashes along V for the north-south roads, along U for the
  // east-west ones, so the line always runs down the road.
  function dashTexture(horizontal) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#2e2e33';
    g.fillRect(0, 0, 32, 128);
    g.fillStyle = '#d8c86a';
    if (horizontal) g.fillRect(10, 60, 12, 4);
    else g.fillRect(14, 8, 4, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(horizontal ? 12 : 1, horizontal ? 1 : 12);
    return tex;
  }
  const dashTexV = dashTexture(false);
  const dashTexH = dashTexture(true);
  const roadDashMatV = new THREE.MeshLambertMaterial({ map: dashTexV });
  const roadDashMatH = new THREE.MeshLambertMaterial({ map: dashTexH });
  for (const c of ROAD_CENTRES) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, ROAD), roadDashMatH);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.01, c);
    group.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, HALF * 2), roadDashMatV);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.01, 0);
    group.add(vRoad);
    // Intersection squares so dashes never overlap oddly.
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, ROAD), roadMat);
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(c, 0.012, c);
    group.add(cross);
  }
  // Sidewalk slabs around each block.
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      const cx = -HALF + ROAD + BLOCK / 2 + bx * PITCH;
      const cz = -HALF + ROAD + BLOCK / 2 + bz * PITCH;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 8, BLOCK + 8), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.005, cz);
      group.add(slab);
    }
  }

  // Zebra crossings: one striped pad across each road just outside every
  // intersection, so pedestrians have somewhere to cross. Two textures:
  // bars along the traffic direction, spaced across the road.
  function crosswalkTexture(vertical) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#2e2e33';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e8e8e0';
    for (let i = 10; i < 128; i += 26) {
      if (vertical) g.fillRect(i, 4, 12, 120);
      else g.fillRect(4, i, 120, 12);
    }
    return new THREE.CanvasTexture(c);
  }
  const crossMatH = new THREE.MeshLambertMaterial({ map: crosswalkTexture(false) });
  const crossMatV = new THREE.MeshLambertMaterial({ map: crosswalkTexture(true) });
  for (const c of ROAD_CENTRES) {
    for (const d of ROAD_CENTRES) {
      // Across the east-west road, just west of the intersection.
      const cwH = new THREE.Mesh(new THREE.PlaneGeometry(5, ROAD), crossMatH);
      cwH.rotation.x = -Math.PI / 2;
      cwH.position.set(d - 14, 0.015, c);
      group.add(cwH);
      // Across the north-south road, just south of the intersection.
      const cwV = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, 5), crossMatV);
      cwV.rotation.x = -Math.PI / 2;
      cwV.position.set(c, 0.015, d - 14);
      group.add(cwV);
    }
  }

  // Buildings: one to three towers per block, windows facing the street.
  // The block at (36, 36) stays open as Solmar Plaza, with its fountain.
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      const cx = -HALF + ROAD + BLOCK / 2 + bx * PITCH;
      const cz = -HALF + ROAD + BLOCK / 2 + bz * PITCH;
      if (cx === 36 && cz === 36) continue;
      const downtown = Math.abs(bx - 2.5) + Math.abs(bz - 2.5) < 3;
      const count = rng.int(1, downtown ? 3 : 2);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(14, 24);
        const d = rng.range(14, 24);
        const h = downtown ? rng.range(22, 46) : rng.range(9, 24);
        const ox = rng.range(-12, 12);
        const oz = rng.range(-12, 12);
        const x = cx + ox;
        const z = cz + oz;
        const color = rng.pick(PALETTE.building);
        const mat = new THREE.MeshLambertMaterial({ color, map: rng.chance(0.5) ? windowTex : windowTexB });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        box(Math.min(w, d) * 0.4, 2, Math.min(w, d) * 0.4, 0x6a5a48, x, h + 1, z, group, roofMat);
        // A rooftop unit on some towers — an AC box at a roof corner — so
        // the skyline has a second layer instead of flat roofs.
        if (rng.chance(0.45)) {
          const uw = rng.range(2, 3.5);
          const ux = x + (rng.chance(0.5) ? 1 : -1) * w * 0.28;
          const uz = z + (rng.chance(0.5) ? 1 : -1) * d * 0.28;
          box(uw, 1.6, uw, 0x8a8a92, ux, h + 0.8, uz, group);
        }
        buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
      }
    }
  }

  // Palm trees and lamps along the avenues.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3e8a4a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const palms = [];
  for (let i = 0; i < 46; i += 1) {
    const road = rng.pick(ROAD_CENTRES);
    const along = rng.range(-HALF + 20, HALF - 20);
    const side = rng.chance(0.5) ? 1 : -1;
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : road + side * (ROAD / 2 + 4);
    const z = horizontal ? road + side * (ROAD / 2 + 4) : along;
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    for (let f = 0; f < 6; f += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.6, 7.4, z + Math.sin(a) * 1.6);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      group.add(frond);
    }
    palms.push({ x, z });
  }
  for (const c of ROAD_CENTRES) {
    for (let a = -HALF + 30; a < HALF; a += 72) {
      box(0.4, 6, 0.4, 0x3a3a40, c + ROAD / 2 + 2, 3, a, group, lampMat);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(c + ROAD / 2 + 2, 6.2, a);
      group.add(bulb);
    }
  }

  // Named landmarks the missions point at: all on roads or open ground.
  landmarks.marina = { x: 36, z: HALF - 8, name: 'Marina' };
  landmarks.docks = { x: -216, z: 180, name: 'Docks' };
  landmarks.garage = { x: -144, z: -108, name: "Rico's Garage" };
  landmarks.plaza = { x: 36, z: 36, name: 'Solmar Plaza' };
  landmarks.hideout = { x: 216, z: -180, name: 'Hideout' };
  landmarks.hospital = { x: -216, z: -36, name: 'Hospital' };
  // A simple marina pier and a plaza fountain for the eye.
  box(40, 1, 8, 0x8a6a48, 36, 0.5, HALF + 12, group);
  // Mooring posts along both edges of the pier.
  for (let px = 20; px <= 52; px += 8) {
    box(0.8, 2.2, 0.8, 0x5a4632, px, 1.1, HALF + 8, group);
    box(0.8, 2.2, 0.8, 0x5a4632, px, 1.1, HALF + 16, group);
  }
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0x9ab8c8 }));
  fountain.position.set(36, 0.6, 36);
  group.add(fountain);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 8), waterMat);
  jet.position.set(36, 3.5, 36);
  group.add(jet);

  // Street furniture: benches along the marina pier and around the plaza,
  // and bins at a few corners, so the sidewalks feel used, not empty.
  const benchSlatMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const benchLegMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const binMat = new THREE.MeshLambertMaterial({ color: 0x3a5a3a });
  function bench(x, y, z, rotY) {
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.7), benchSlatMat);
    seat.position.y = 0.45;
    b.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), benchSlatMat);
    back.position.set(0, 0.75, -0.3);
    b.add(back);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.6), benchLegMat);
      leg.position.set(1.0 * s, 0.22, 0);
      b.add(leg);
    }
    b.position.set(x, y, z);
    b.rotation.y = rotY;
    group.add(b);
  }
  // Benches facing the water along the marina pier (the pier top is y=1).
  for (let px = 22; px <= 50; px += 14) {
    bench(px, 1, HALF + 9, Math.PI);
  }
  // Benches around the plaza, facing the fountain.
  bench(24, 0, 36, Math.PI / 2);
  bench(48, 0, 36, -Math.PI / 2);
  bench(36, 0, 24, 0);
  bench(36, 0, 48, Math.PI);
  // Bins at a few intersections, just onto the sidewalk.
  for (const [bx, bz] of [[-216, -144], [-72, 72], [144, -72], [72, 216], [216, 0]]) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.0, 10), binMat);
    bin.position.set(bx + 10, 0.5, bz + 10);
    group.add(bin);
  }
  // A few palms along the beach, leaning over the sand.
  for (let i = 0; i < 6; i += 1) {
    const bx = -180 + i * 72 + rng.range(-10, 10);
    const bz = HALF + 18 + rng.range(-4, 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(bx, 3.5, bz);
    group.add(trunk);
    for (let f = 0; f < 6; f += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(bx + Math.cos(a) * 1.6, 7.4, bz + Math.sin(a) * 1.6);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      group.add(frond);
    }
    palms.push({ x: bx, z: bz });
  }

  // Real sun shadows: solid meshes cast, flat ground/roads receive only.
  group.traverse((m) => {
    if (!m.isMesh) return;
    m.receiveShadow = true;
    if (m.geometry && m.geometry.type !== 'PlaneGeometry') m.castShadow = true;
  });

  return { group, buildings, landmarks, palms };
}

// Circle (x,z,r) against every building footprint: push the circle out.
export function collideBuildings(buildings, x, z, r) {
  let nx = x;
  let nz = z;
  let hit = false;
  for (const b of buildings) {
    const cx = Math.max(b.minX, Math.min(nx, b.maxX));
    const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // Centre inside the footprint: push out along the smallest overlap.
        const left = nx - b.minX;
        const right = b.maxX - nx;
        const top = nz - b.minZ;
        const bottom = b.maxZ - nz;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = b.minX - r;
        else if (m === right) nx = b.maxX + r;
        else if (m === top) nz = b.minZ - r;
        else nz = b.maxZ + r;
      }
    }
  }
  return { x: nx, z: nz, hit };
}

// Nearest road centreline coordinate to a value, for snapping cars to lanes.
export function nearestRoad(v) {
  let best = ROAD_CENTRES[0];
  for (const c of ROAD_CENTRES) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}
