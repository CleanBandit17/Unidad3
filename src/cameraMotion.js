import { Spherical, Vector3, MathUtils } from 'three/webgpu';

// Smooth spherical motion keeps the camera outside the work while changing
// angles. Goals accumulate across repeated clicks and held keys.
export function createCameraMotion(camera, orbit) {
  const goal = new Spherical();
  const current = new Spherical();
  const offset = new Vector3();
  let active = false;
  let response = 0.22;
  const sync = () => goal.setFromVector3(offset.copy(camera.position).sub(orbit.target));
  const cancel = () => { active = false; sync(); };
  orbit.addEventListener('start', cancel);
  function move(horizontal = 0, vertical = 0, zoom = 1, seconds = 0.22) {
    if (![horizontal, vertical, zoom, seconds].every(Number.isFinite) || zoom <= 0 || seconds <= 0) throw new RangeError('Movimiento de cámara inválido.');
    if (!active) sync();
    goal.theta += horizontal;
    goal.phi = MathUtils.clamp(goal.phi + vertical, 0.05, Math.PI - 0.05);
    goal.radius = MathUtils.clamp(goal.radius * zoom, orbit.minDistance, orbit.maxDistance);
    response = seconds;
    active = true;
  }
  function setView(name) {
    if (!['front', 'side', 'top'].includes(name)) throw new RangeError('Vista de cámara desconocida.');
    if (!active) sync();
    current.setFromVector3(offset.copy(camera.position).sub(orbit.target));
    const angle = name === 'side' ? Math.PI / 2 : name === 'top' ? current.theta : 0;
    goal.theta = current.theta + Math.atan2(Math.sin(angle - current.theta), Math.cos(angle - current.theta));
    goal.phi = name === 'top' ? 0.05 : Math.PI / 2;
    response = 0.34;
    active = true;
  }
  function update(dt) {
    if (!active) return false;
    current.setFromVector3(offset.copy(camera.position).sub(orbit.target));
    // Unwrap to stay continuous when spherical theta crosses ±PI.
    current.theta = goal.theta - Math.atan2(Math.sin(goal.theta - current.theta), Math.cos(goal.theta - current.theta));
    const alpha = 1 - Math.exp(-Math.min(Math.max(dt, 0), 0.05) / response);
    current.theta += (goal.theta - current.theta) * alpha;
    current.phi += (goal.phi - current.phi) * alpha;
    current.radius += (goal.radius - current.radius) * alpha;
    camera.position.copy(orbit.target).add(offset.setFromSpherical(current));
    camera.lookAt(orbit.target);
    if (Math.abs(goal.theta - current.theta) + Math.abs(goal.phi - current.phi) + Math.abs(goal.radius - current.radius) < 0.0001) active = false;
    return true;
  }
  return { move, setView, update, cancel, get active() { return active; } };
}
