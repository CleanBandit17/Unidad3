import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  cos,
  float,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  mod,
  sin,
  smoothstep,
  uint,
  uv,
  vec3
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  // STATE -----------------------------------------------------------------
  // Each particle owns position and velocity. The arrays live in GPU storage.
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  // A short history of actual integrated positions, never an invented path.
  // p + v + five history buffers stay under WebGPU's baseline limit of 8.
  const history = Array.from({ length: 5 }, () => instancedArray(count, 'vec3'));

  // INITIALIZATION --------------------------------------------------------
  // A compute pass writes the initial state for every particle in parallel.
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
    for (const buffer of history) buffer.element(i).assign(p);
  })().compute(count).setName('Initialize Particles');

  // UPDATE / COMPUTE SHADER ----------------------------------------------
  // This is the conceptual heart of the project:
  // state -> forces -> acceleration -> velocity -> position.
  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();
    for (let j = history.length - 1; j > 0; j--) {
      history[j].element(instanceIndex).assign(history[j - 1].element(instanceIndex));
    }
    history[0].element(instanceIndex).assign(p);

    // 1) CONSTANT / WIND FORCE
    force.addAssign(params.wind.mul(params.windEnabled));

    // 2) RADIAL FORCE (positive = attraction, negative = repulsion)
    const toAttractor = params.attractor.sub(p);
    const distance = max(toAttractor.length(), params.softening);
    const radialDirection = toAttractor.div(distance);
    const radialForce = radialDirection
      .mul(params.radialStrength)
      .div(distance.pow(2))
      .mul(params.radialEnabled);
    force.addAssign(radialForce);

    // 3) VORTEX FORCE: tangent to the radial direction around Z.
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(radialDirection);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    // 4) LINEAR DRAG: F = -c v
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // 5) ELASTIC RING: Fxy = -k(r-R(theta)) er. Inside pushes out,
    // outside pulls in. The wave deforms the equilibrium, not positions.
    const local = p.sub(params.attractor);
    const radius = max(local.xy.length(), 0.001);
    const c = local.x.div(radius);
    const s = local.y.div(radius);
    const sin3 = s.mul(3).sub(s.mul(s).mul(s).mul(4));
    const cos3 = c.mul(c).mul(c).mul(4).sub(c.mul(3));
    const shell = hash(instanceIndex.add(uint(419))).sub(0.5).mul(0.55);
    const targetRadius = params.ringRadius.add(shell).add(cos3.mul(params.waveHeight).mul(0.45));
    const radialSpring = radius.sub(targetRadius).mul(params.ringStrength).negate();
    force.addAssign(vec3(c, s, 0).mul(radialSpring).mul(params.ringEnabled));
    const targetZ = sin3.mul(params.waveHeight);
    force.z.addAssign(targetZ.sub(local.z).mul(params.confinement));

    // 6) ABC FLOW: a smooth divergence-free spatial field. It bends
    // velocities into streams, without prescribing particle trajectories.
    const q = local.mul(params.flowScale);
    const phase = params.elapsed.mul(0.12);
    const flow = vec3(
      sin(q.z.add(phase)).add(cos(q.y)),
      sin(q.x).add(cos(q.z.add(phase))),
      sin(q.y).add(cos(q.x))
    );
    force.addAssign(flow.mul(params.flowStrength).mul(params.flowEnabled));
    // A manually triggered, short outward force pulse, in all three axes.
    force.addAssign(local.div(max(local.length(), 0.1)).mul(params.burst).mul(65));

    // INTEGRATION ---------------------------------------------------------
    // Unit mass: a = F. Semi-implicit Euler: update v, then p.
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // Periodic boundary conditions: particles leaving one side re-enter.
    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER ---------------------------------------------------------------
  // Rendering does not recompute the physics. It consumes the GPU state.
  const materials = [];
  const meshes = [];
  const geometry = new THREE.PlaneGeometry(1, 1);
  // Layered soft sprites make filaments out of the GPU history. No fullscreen
  // accumulation means reset, resize and wrap never leave ghost images.
  for (let layer = history.length; layer >= 0; layer--) {
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = layer === 0 ? positionBuffer.toAttribute() : history[layer - 1].toAttribute();
  material.scaleNode = params.particleSize.mul(layer === 0 ? 1 : 0.86);

  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);
    const identity = hash(instanceIndex.add(uint(419)));
    const tone = identity.mul(0.75).add(t.mul(0.25));
    const base = mix(params.colorCold, params.colorWarm, smoothstep(0.35, 0.65, tone));
    return mix(base, vec3(1.0, 0.95, 0.85), params.burst.mul(0.85));
  })();

  // Circular sprite mask, avoiding visible square planes.
  const disk = uv().xy.sub(0.5).length().mul(2);
  const mask = float(1).sub(smoothstep(0.0, 1.0, disk)).pow(2);
  const tailOpacity = layer === 0 ? float(1) : params.trails.mul((1 - layer / 8) * 0.30);
  material.opacityNode = mask.mul(params.brightness.add(params.burst.mul(1.5))).mul(tailOpacity);

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);
  materials.push(material);
  meshes.push(mesh);
  }

  function reset() {
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    for (const material of materials) material.dispose();
    for (const mesh of meshes) scene.remove(mesh);
    positionBuffer.dispose();
    velocityBuffer.dispose();
    for (const buffer of history) buffer.dispose();
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    stepSimulation,
    dispose
  };
}
