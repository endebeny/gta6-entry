// The three.js view of Solmar Bay: sunset light, the city the world built,
// one mesh per car and pedestrian, and a chase camera that follows the player
// on foot or behind the wheel.
import { createCity } from './city.js';
import { makeCarMesh } from './vehicles.js';
import { makePedMesh } from './pedestrians.js';

export function createRenderer(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  // Real sun shadows: the single biggest step from flat low-poly to natural.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec8e8);
  scene.fog = new THREE.Fog(0xf2c98a, 140, 560);

  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a6a48, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.35);
  sun.position.set(-120, 180, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  scene.add(city.group);

  const carMeshes = new Map();
  const pedMeshes = new Map();
  let playerMesh = null;
  let beacon = null;
  let beaconMat = null;

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  let camYaw = 0;
  let camPitch = 0.32;
  let camDist = 7;
  let camTarget = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function carMesh(car) {
    let mesh = carMeshes.get(car.id);
    if (!mesh) {
      mesh = makeCarMesh(car.color, car.isPolice, car.isSports);
      mesh.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(mesh);
      carMeshes.set(car.id, mesh);
    }
    return mesh;
  }

  function pedMesh(ped) {
    let mesh = pedMeshes.get(ped.id);
    if (!mesh) {
      mesh = makePedMesh(ped.shirt);
      mesh.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(mesh);
      pedMeshes.set(ped.id, mesh);
    }
    return mesh;
  }

  function ensurePlayerMesh(world) {
    if (!playerMesh) {
      playerMesh = makePedMesh(0xe86a1e, 0xc89878);
      playerMesh.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      // A cap so the player reads at a glance.
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x222226 }));
      cap.position.y = 1.98;
      playerMesh.add(cap);
      scene.add(playerMesh);
    }
    return playerMesh;
  }

  function updateBeacon(world, time) {
    const wp = world.missions.waypoint();
    if (!wp) {
      if (beacon) beacon.visible = false;
      return;
    }
    if (!beacon) {
      beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35 });
      beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 16, 1, true), beaconMat);
      scene.add(beacon);
    }
    beacon.visible = true;
    beacon.position.set(wp.x, 30, wp.z);
    beaconMat.opacity = 0.25 + 0.12 * Math.sin(time * 3);
    beacon.rotation.y = time * 0.5;
  }

  return {
    camera,
    getCamYaw() {
      return camYaw;
    },
    addLook(dx, dy) {
      camYaw -= dx * 0.0032;
      camPitch = Math.max(-0.05, Math.min(1.1, camPitch + dy * 0.0028));
    },
    snapBehind(world) {
      const p = world.player;
      camYaw = p.onFoot ? p.heading : (p.car ? p.car.heading : p.heading);
      camPitch = 0.32;
    },
    removeCarMesh(car) {
      const mesh = carMeshes.get(car.id);
      if (mesh) {
        scene.remove(mesh);
        carMeshes.delete(car.id);
      }
    },
    removePedMesh(ped) {
      const mesh = pedMeshes.get(ped.id);
      if (mesh) {
        scene.remove(mesh);
        pedMeshes.delete(ped.id);
      }
    },
    draw(world, time) {
      const player = world.player;
      // Player.
      const pm = ensurePlayerMesh(world);
      if (player.onFoot) {
        pm.visible = true;
        pm.position.set(player.x, player.y, player.z);
        pm.rotation.y = player.heading;
        pm.rotation.x = 0;
        // A little bob while walking.
        pm.position.y = player.y + Math.abs(Math.sin(player.walkPhase)) * 0.08;
      } else {
        pm.visible = false;
      }
      // Cars.
      for (const car of world.cars) {
        const mesh = carMesh(car);
        mesh.position.set(car.x, 0, car.z);
        mesh.rotation.y = car.heading;
        if (car.disabled) mesh.rotation.z = 0.06;
        else mesh.rotation.z = 0;
        if (car.isPolice) {
          const bar = mesh.getObjectByName('lightbar');
          if (bar) bar.material.color.setHex(Math.floor(time * 2) % 2 === 0 ? 0xdd2222 : 0x2244dd);
        }
      }
      // Pedestrians.
      for (const ped of world.peds) {
        const mesh = pedMesh(ped);
        mesh.position.set(ped.x, 0, ped.z);
        if (ped.state === 'down') {
          mesh.rotation.x = Math.PI / 2;
          mesh.rotation.y = 0;
          mesh.position.y = 0.3;
        } else {
          mesh.rotation.x = 0;
          mesh.rotation.y = ped.heading;
          mesh.position.y = Math.abs(Math.sin(time * 6 + ped.id.length)) * 0.03;
        }
      }
      updateBeacon(world, time);

      // Chase camera.
      const driving = !player.onFoot && player.car;
      const targetDist = driving ? 11 : 7;
      camDist += (targetDist - camDist) * 0.08;
      if (driving) {
        // Ease the camera around behind the car.
        let diff = player.car.heading - camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        camYaw += diff * 0.045;
      }
      const tx = player.x;
      const tz = player.z;
      const ty = player.onFoot ? 1.7 : 1.4;
      camTarget.set(tx, ty, tz);
      const cx = tx - Math.sin(camYaw) * Math.cos(camPitch) * camDist;
      const cz = tz - Math.cos(camYaw) * Math.cos(camPitch) * camDist;
      const cy = ty + Math.sin(camPitch) * camDist + (driving ? 1.2 : 0.6);
      camera.position.set(cx, cy, cz);
      camera.lookAt(camTarget);
      renderer.render(scene, camera);
    },
  };
}
