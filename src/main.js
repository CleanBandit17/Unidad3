import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';
import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';
import { createVisualInstrument, LOOKS } from './visualInstrument.js';
import { createCameraMotion } from './cameraMotion.js';

async function main() {
  const mount = document.querySelector('#app');
  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Se necesita WebGPU. Abre esta página en Chrome o Edge actualizado.');
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020305');
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 100);
  const frameDistance = () => Math.max(11.8, 5.2 / (Math.tan(THREE.MathUtils.degToRad(24)) * (innerWidth / innerHeight)));
  camera.position.set(0, -3.0, frameDistance());
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = 6;
  orbit.maxDistance = 40;
  orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  orbit.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  orbit.target.set(0, 0, 0);
  orbit.update();
  const params = createParameters();
  const count = innerWidth < 700 ? 16384 : 32768;
  const simulation = createSimulation({ renderer, scene, params, count });
  let mode = 'PERFORMANCE';
  let paused = false;
  let panel;
  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);
  const attractorHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);

  const header = document.createElement('header');
  header.className = 'instrument-header';
  header.innerHTML = '<div><h1>Materia</h1><p>Instrumento visual para LesAlpx · Floating Points</p></div><button type="button" id="lab-toggle">Abrir laboratorio</button>';
  document.body.append(header);

  const controls = document.createElement('section');
  controls.className = 'visual-controls';
  controls.setAttribute('aria-label', 'Explorar comportamientos visuales');
  controls.innerHTML = `<div class="looks">${Object.entries(LOOKS).map(([id, look], i) => `<button type="button" data-look="${id}" aria-pressed="false">${look.label} · ${i + 1}</button>`).join('')}</div>
    <p class="look-description"></p>
    <div class="live-controls">
      <label>Radio · Q/W <input aria-label="Radio" type="range" data-param="ringRadius" min="0.8" max="3.5" step="0.01"><output></output></label>
      <label>Giro · A/S <input aria-label="Giro" type="range" data-param="vortexStrength" min="-3" max="3" step="0.01"><output></output></label>
      <label>Flujo · Z/X <input aria-label="Flujo" type="range" data-param="flowStrength" min="0" max="2" step="0.01"><output></output></label>
      <label>Pliegue · U/I <input aria-label="Pliegue" type="range" data-param="waveHeight" min="0" max="1.3" step="0.01"><output></output></label>
      <label>Luz · T/Y <input aria-label="Luz" type="range" data-param="brightness" min="0.1" max="1" step="0.01"><output></output></label>
    </div>
    <div class="camera-controls" aria-label="Cámara 3D">
      <button data-camera="left" aria-label="Girar cámara a la izquierda">Izquierda</button><button data-camera="right" aria-label="Girar cámara a la derecha">Derecha</button>
      <button data-camera="up">Arriba</button><button data-camera="down">Abajo</button><button data-camera="in">Acercar +</button><button data-camera="out">Alejar -</button>
      <button data-view="front">Frontal</button><button data-view="side">Lateral</button><button data-view="top">Superior</button><button id="auto-camera" aria-pressed="false">Órbita · C</button>
      <button data-shot="sweep">Barrido lateral · J</button><button data-shot="rise">Ascenso · L</button><button data-shot="dolly">Entrada · O</button>
      <button data-combo="7">Toma 7 · Ascenso</button>
      <button data-combo="8">Toma 8 · Inmersión</button>
      <button data-combo="9">Toma 9 · Apertura</button>
      <button data-combo="0">Toma 0 · Órbita + destellos</button>
    </div>
    <button type="button" id="burst" class="burst-button">Golpe / destello · Espacio</button>
    <div class="transport"><button type="button" id="pause">Pausar · K</button><button type="button" id="reset">Reiniciar · R</button><button type="button" id="clean">Ocultar controles · H</button><button type="button" id="fullscreen">Pantalla completa · F</button></div>
    <details class="key-guide"><summary>Guía de teclas para tocar con la interfaz oculta</summary>
      <p>1 / 2 / 3: Corona / Marea / Núcleo. 7 / 8 / 9 / 0: tomas combinadas. Q/W: radio -/+. A/S: giro -/+. Z/X: flujo -/+. U/I: pliegue -/+. T/Y: luz -/+. Flechas: rotar cámara. +/-: acercar/alejar. V: alternar frontal/lateral/superior. C: órbita automática. J: barrido lateral. L: ascenso. O: entrada. Espacio: golpe. K: pausa. R: reiniciar. H: ocultar/mostrar. F: pantalla completa. P: laboratorio. Mantén las teclas de parámetros o cámara para cambiar de forma continua. Mayús + arrastrar: mover el centro.</p>
    </details>`;
  document.body.append(controls);

  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);

  const reveal = document.createElement('button');
  reveal.className = 'reveal-controls';
  reveal.textContent = 'Mostrar controles';
  reveal.hidden = true;
  document.body.append(reveal);

  const instrument = createVisualInstrument(params, (change = {}) => {
    panel?.refresh();
    for (const input of controls.querySelectorAll('[data-param]')) {
      input.value = params[input.dataset.param].value;
      input.nextElementSibling.textContent = Number(input.value).toFixed(2);
    }
    if (change.look) {
      controls.querySelector('.look-description').textContent = LOOKS[change.look].description;
      for (const button of controls.querySelectorAll('[data-look]')) {
        button.setAttribute('aria-pressed', String(button.dataset.look === change.look));
      }
    }
  });

  // Public integration boundary: mappings are now included at the user's request.
  window.visualInstrument = instrument;

  const selectLook = (id) => {
    instrument.setLook(id);
    controls.querySelector('.look-description').textContent = LOOKS[id].description;
    for (const button of controls.querySelectorAll('[data-look]')) {
      button.setAttribute('aria-pressed', String(button.dataset.look === id));
    }
  };

  controls.querySelectorAll('[data-look]').forEach(button => {
    button.addEventListener('click', () => selectLook(button.dataset.look));
  });
  controls.querySelectorAll('[data-param]').forEach(input => {
    input.addEventListener('input', () => instrument.setParameters({ [input.dataset.param]: Number(input.value) }));
  });

  for (const input of controls.querySelectorAll('[data-param]')) {
    const label = input.closest('label');
    const group = document.createElement('div');
    label.replaceWith(group);
    group.append(label);

    const nudge = document.createElement('div');
    nudge.className = 'parameter-nudge';
    for (const direction of [-1, 1]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = direction < 0 ? '-' : '+';
      button.setAttribute('aria-label', `${direction < 0 ? 'Reducir' : 'Aumentar'} ${input.getAttribute('aria-label')}`);
      button.addEventListener('click', () => {
        const key = input.dataset.param;
        instrument.setParameters({
          [key]: THREE.MathUtils.clamp(
            params[key].value + direction * 0.1,
            Number(input.min),
            Number(input.max)
          )
        });
      });
      nudge.append(button);
    }
    group.append(nudge);
  }

  function applyPreset(id) {
    instrument.disableForces();
    params.attractor.value.set(0, 0, 0);
    params.wind.value.set(0, 0, 0);
    params.initialSpeed.value = 0;
    params.maxSpeed.value = 5;
    if (id === 'inertia') params.initialSpeed.value = 0.8;
    if (id === 'wind') {
      params.windEnabled.value = 1;
      params.wind.value.set(1.5, 0, 0);
    }
    if (id === 'attract' || id === 'repel') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = id === 'attract' ? 3 : -3;
    }
    if (id === 'vortex') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 1;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 3;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.08;
    }
    simulation.reset();
    panel?.refresh();
  }

  function setMode(next) {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
    axes.visible = lab;
    attractorHelper.visible = lab;
    controls.hidden = lab;
    header.querySelector('button').textContent = lab ? 'Volver a la obra' : 'Abrir laboratorio';
    if (lab) applyPreset('inertia');
    else selectLook('corona');
    hud.textContent = lab
      ? 'LAB · 1-5: pruebas · P: volver a la obra'
      : 'Arrastra: rotar · Rueda: zoom · Espacio: golpe · H: ocultar interfaz';
  }

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => togglePause()
  });

  function togglePause() {
    paused = !paused;
    controls.querySelector('#pause').textContent = paused ? 'Continuar · K' : 'Pausar · K';
  }

  function toggleClean() {
    const clean = document.body.classList.toggle('clean');
    reveal.hidden = !clean;
  }

  header.querySelector('button').addEventListener('click', () => {
    setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
  });
  controls.querySelector('#pause').addEventListener('click', togglePause);
  controls.querySelector('#reset').addEventListener('click', () => simulation.reset());
  controls.querySelector('#clean').addEventListener('click', toggleClean);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      hud.textContent = 'Pantalla completa no disponible en este navegador.';
    }
  }

  controls.querySelector('#fullscreen').addEventListener('click', toggleFullscreen);

  const cameraMotion = createCameraMotion(camera, orbit);
  function moveCamera(horizontal = 0, vertical = 0, zoom = 1) {
    cameraMotion.move(horizontal, vertical, zoom);
  }

  const views = ['front', 'side', 'top'];
  let viewIndex = 0;
  function setView(name) {
    cameraMotion.setView(name);
    viewIndex = Math.max(0, views.indexOf(name));
  }

  let automaticOrbit = false;
  orbit.autoRotateSpeed = 0;
  function toggleOrbit() {
    automaticOrbit = !automaticOrbit;
    controls.querySelector('#auto-camera').setAttribute('aria-pressed', String(automaticOrbit));
  }

  function playShot(name) {
    const shots = {
      sweep: [0.9, 0, 1, 0.5],
      rise: [0.3, -0.65, 1, 0.5],
      dolly: [0.25, 0.08, 0.72, 0.45]
    };
    if (!Object.hasOwn(shots, name)) throw new RangeError('Movimiento de cámara desconocido.');
    cameraMotion.move(...shots[name]);
  }

  const comboShots = {
    '7': [1.42, -0.65, 0.88, 0.75],
    '8': [-0.87, 0.26, 0.72, 0.8],
    '9': [1.2, -0.65, 1.14, 0.9],
    '0': [2.4, 0.08, 0.82, 1.1]
  };

  let lastBurst = -Infinity;
  function burst() {
    if (paused || mode !== 'PERFORMANCE' || performance.now() - lastBurst < 220) return;
    lastBurst = performance.now();
    instrument.triggerBurst();
  }

  function burstThreeTimes() {
    const fireBurst = (index) => {
      if (paused || mode !== 'PERFORMANCE') return;

      burst();
      if (index < 2) window.setTimeout(() => fireBurst(index + 1), 300);
    };

    const waitForCooldown = Math.max(0, 230 - (performance.now() - lastBurst));
    window.setTimeout(() => fireBurst(0), waitForCooldown);
  }

  function playCombo(key) {
    const movement = comboShots[key];
    if (!movement) return;

    cameraMotion.move(...movement);
    if (key === '0') burstThreeTimes();
  }

  controls.querySelector('#burst').addEventListener('click', burst);
  controls.querySelector('#auto-camera').addEventListener('click', toggleOrbit);
  controls.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  controls.querySelectorAll('[data-shot]').forEach(button => {
    button.addEventListener('click', () => playShot(button.dataset.shot));
  });
  controls.querySelectorAll('[data-combo]').forEach(button => {
    button.addEventListener('click', () => playCombo(button.dataset.combo));
  });
  controls.querySelectorAll('[data-camera]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.camera;
      moveCamera(
        action === 'left' ? -0.22 : action === 'right' ? 0.22 : 0,
        action === 'up' ? -0.18 : action === 'down' ? 0.18 : 0,
        action === 'in' ? 0.88 : action === 'out' ? 1.14 : 1
      );
    });
  });

  instrument.camera = { rotate: moveCamera, setView, toggleOrbit, playShot, playCombo };
  reveal.addEventListener('click', toggleClean);

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button === 0) renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (!(event.buttons & 1) || !event.shiftKey) return;
    ndc.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -1, 1);
      hit.y = THREE.MathUtils.clamp(hit.y, -1, 1);
      params.attractor.value.copy(hit);
    }
  });

  const held = new Set();
  const parameterKeys = {
    KeyQ: ['ringRadius', -0.8],
    KeyW: ['ringRadius', 0.8],
    KeyA: ['vortexStrength', -1.2],
    KeyS: ['vortexStrength', 1.2],
    KeyZ: ['flowStrength', -0.6],
    KeyX: ['flowStrength', 0.6],
    KeyU: ['waveHeight', -0.5],
    KeyI: ['waveHeight', 0.5],
    KeyT: ['brightness', -0.4],
    KeyY: ['brightness', 0.4]
  };

  addEventListener('keyup', event => {
    held.delete(event.code);
    if (event.key === 'Shift') orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  });
  addEventListener('blur', () => {
    held.clear();
    orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  });
  document.addEventListener('visibilitychange', () => held.clear());

  addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyH' && !event.repeat && !event.target.isContentEditable) {
      toggleClean();
      return;
    }
    if ((!document.body.classList.contains('clean') && /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) || event.target.isContentEditable) return;
    if (event.code === 'Space' && event.target.tagName === 'BUTTON' && !document.body.classList.contains('clean')) return;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();

    held.add(event.code);
    if (event.key === 'Shift') orbit.mouseButtons.LEFT = null;
    if (event.repeat) return;

    if (event.code === 'KeyP') setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    if (event.code === 'KeyR') simulation.reset();
    if (event.code === 'KeyK') togglePause();
    if (event.code === 'KeyF') toggleFullscreen();
    if (event.code === 'KeyC') toggleOrbit();
    if (event.code === 'KeyV') setView(views[(viewIndex + 1) % views.length]);
    if (event.code === 'KeyJ') playShot('sweep');
    if (event.code === 'KeyL') playShot('rise');
    if (event.code === 'KeyO') playShot('dolly');

    if (event.code === 'Digit7') playCombo('7');
    if (event.code === 'Digit8') playCombo('8');
    if (event.code === 'Digit9') playCombo('9');
    if (event.code === 'Digit0') playCombo('0');

    if (mode === 'PERFORMANCE') {
      if (event.code === 'Digit1') selectLook('corona');
      if (event.code === 'Digit2') selectLook('marea');
      if (event.code === 'Digit3') selectLook('nucleo');
      if (event.code === 'Space') burst();
    }
    if (mode === 'LAB') {
      const ids = ['inertia', 'wind', 'attract', 'repel', 'vortex'];
      const match = event.code.match(/^Digit([1-5])$/);
      if (match) applyPreset(ids[Number(match[1]) - 1]);
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  setMode('PERFORMANCE');
  simulation.reset();
  let last = performance.now();
  let accumulated = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frameDelta = Math.min((now - last) / 1000, 0.05);
    accumulated += paused || document.hidden ? 0 : frameDelta;
    last = now;

    if (mode === 'PERFORMANCE') {
      const edits = {};
      for (const key of held) {
        if (!parameterKeys[key]) continue;
        const [name, rate] = parameterKeys[key];
        const [min, max] = instrument.ranges[name];
        edits[name] = THREE.MathUtils.clamp(
          (edits[name] ?? params[name].value) + rate * frameDelta,
          min,
          max
        );
      }
      if (Object.keys(edits).length) instrument.setParameters(edits);
    }

    if ([...held].some(key =>
      key.startsWith('Arrow') ||
      ['Minus', 'Equal', 'NumpadSubtract', 'NumpadAdd'].includes(key)
    )) {
      moveCamera(
        ((held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0)) * frameDelta,
        ((held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0)) * frameDelta,
        Math.exp(
          ((held.has('Minus') || held.has('NumpadSubtract') ? 1 : 0) -
           (held.has('Equal') || held.has('NumpadAdd') ? 1 : 0)) * frameDelta
        )
      );
    }

    let steps = 0;
    while (accumulated >= 1 / 60 && steps++ < 3) {
      params.elapsed.value += 1 / 60 * params.timeScale.value;
      simulation.stepSimulation();
      instrument.updateTransient(1 / 60);
      accumulated -= 1 / 60;
    }

    attractorHelper.position.copy(params.attractor.value);
    const transitioning = cameraMotion.update(frameDelta);
    orbit.autoRotateSpeed = THREE.MathUtils.damp(orbit.autoRotateSpeed, automaticOrbit ? 0.65 : 0, 3, frameDelta);
    orbit.autoRotate = !transitioning && orbit.autoRotateSpeed > 0.001;
    orbit.update(frameDelta);
    renderer.render(scene, camera);
  });
}

main().catch(error => {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'startup-error';
  message.textContent = `No se pudo iniciar la obra: ${error.message}. Prueba Chrome o Edge con WebGPU habilitado.`;
  document.body.append(message);
});