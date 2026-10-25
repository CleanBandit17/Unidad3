import * as THREE from 'three/webgpu';
import { createParameters } from '../src/simulation/parameters.js';
import { createSimulation } from '../src/simulation/createSimulation.js';
import { createVisualInstrument, LOOKS } from '../src/visualInstrument.js';
const results = document.querySelector('#results');
function check(label, pass, detail = '') {
  const li = document.createElement('li');
  li.textContent = `${pass ? 'PASS' : 'FAIL'} · ${label} ${detail}`;
  results.append(li);
  if (!pass) throw new Error(li.textContent);
}
try {
  const renderer = new THREE.WebGPURenderer();
  renderer.setSize(200, 120);
  await renderer.init();
  const scene = new THREE.Scene();
  const params = createParameters();
  const sim = createSimulation({ renderer, scene, params, count: 256 });
  const api = createVisualInstrument(params);
  const read = async buffer => new Float32Array(await renderer.getArrayBufferAsync(buffer.value));
  const zero = () => { api.disableForces(); params.initialSpeed.value = 0; params.timeScale.value = 1; params.maxSpeed.value = 12; params.attractor.value.set(0, 0, 0); };
  const vectors = (a, fn) => { const stride = a.length / 256; return Array.from({ length: 256 }, (_, i) => fn(a.slice(i * stride, i * stride + 3), i)); };
  zero(); params.initialSpeed.value = 0.8; sim.reset();
  const v0 = await read(sim.velocityBuffer);
  sim.stepSimulation(); const v1 = await read(sim.velocityBuffer);
  check('Inercia: velocidad conservada sin fuerzas', v0.every((x, i) => Math.abs(x - v1[i]) < 1e-6));
  zero(); params.windEnabled.value = 1; params.wind.value.set(1.5, 0, 0); sim.reset();
  const p0 = await read(sim.positionBuffer);
  sim.stepSimulation(); const windV = await read(sim.velocityBuffer); const windP = await read(sim.positionBuffer);
  const stride = windV.length / 256;
  check('Viento +X: vx = 1.5/60 y Euler semiimplícito', vectors(windV, (v, i) => Math.abs(v[0] - 1.5 / 60) < 1e-5 && Math.abs(windP[i * stride] - p0[i * stride] - 1.5 / 3600) < 1e-5).every(Boolean));
  for (const sign of [1, -1]) {
    zero(); params.radialEnabled.value = 1; params.radialStrength.value = sign * 3; sim.reset();
    const start = await read(sim.positionBuffer); sim.stepSimulation(); const velocity = await read(sim.velocityBuffer);
    check(sign > 0 ? 'Atracción: aceleración hacia el centro' : 'Repulsión: aceleración alejándose del centro', vectors(velocity, (v, i) => sign * -(v[0] * start[i * stride] + v[1] * start[i * stride + 1] + v[2] * start[i * stride + 2]) > 0).every(Boolean));
  }
  zero(); params.vortexEnabled.value = 1; params.vortexStrength.value = 1; sim.reset();
  const vortexP = await read(sim.positionBuffer); sim.stepSimulation(); const vortexV = await read(sim.velocityBuffer);
  check('Vórtice: componente tangencial con signo previsto', vectors(vortexV, (v, i) => v[0] * vortexP[i * stride + 1] - v[1] * vortexP[i * stride] > 0).every(Boolean));
  zero(); params.ringEnabled.value = 1; params.ringStrength.value = 2.8; params.ringRadius.value = 2.5; params.waveHeight.value = 0; sim.reset();
  const ringP = await read(sim.positionBuffer); sim.stepSimulation(); const ringV = await read(sim.velocityBuffer);
  let eligible = 0;
  check('Anillo: devuelve partículas interiores/exteriores al radio de equilibrio', vectors(ringV, (v, i) => {
    const x = ringP[i * stride], y = ringP[i * stride + 1], r = Math.hypot(x, y);
    if (Math.abs(r - 2.5) < 0.4) return true;
    eligible++; return (v[0] * x + v[1] * y) * (r - 2.5) < 0;
  }).every(Boolean) && eligible > 100, `(${eligible} partículas lejos de la banda de equilibrio)`);
  params.dragEnabled.value = 1; params.dragCoefficient.value = 0.8;
  for (let frame = 0; frame < 360; frame++) sim.stepSimulation();
  const settled = await read(sim.positionBuffer);
  const error = vectors(settled, p => Math.abs(Math.hypot(p[0], p[1]) - 2.5)).reduce((a, b) => a + b) / 256;
  check('Anillo amortiguado: converge a la banda objetivo', error < 0.3, `(error medio ${error.toFixed(4)})`);
  for (const name of Object.keys(LOOKS)) {
    zero(); api.setLook(name); params.timeScale.value = 2; sim.reset();
    for (let frame = 0; frame < 180; frame++) { params.elapsed.value += 2 / 60; sim.stepSimulation(); }
    const p = await read(sim.positionBuffer), v = await read(sim.velocityBuffer);
    check(`${name}: buffers finitos y dentro de límites a velocidad ×2`, [...p, ...v].every(Number.isFinite) && vectors(p, p => p.every(x => Math.abs(x) <= 5.001)).every(Boolean));
  }
  zero(); sim.reset();
  const burstP = await read(sim.positionBuffer);
  api.triggerBurst(); sim.stepSimulation();
  const burstV = await read(sim.velocityBuffer);
  check('Golpe manual: velocidad radial hacia fuera en 3D', vectors(burstV, (v, i) => v[0] * burstP[i * stride] + v[1] * burstP[i * stride + 1] + v[2] * burstP[i * stride + 2] > 0).every(Boolean));
  api.disableForces();
  check('LAB: el pulso queda completamente desactivado', params.burst.value === 0);
  document.querySelector('#status').textContent = '12 pruebas aprobadas en buffers reales de WebGPU. No sustituyen el ensayo ni la valoración del estudiante.';
  renderer.dispose();
} catch (error) { document.querySelector('#status').textContent = `ERROR: ${error.message}`; console.error(error); }
