import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, EventDispatcher } from 'three/webgpu';
import { createCameraMotion } from '../src/cameraMotion.js';
function setup() {
  const camera = new PerspectiveCamera(); camera.position.set(0, 0, 12);
  const orbit = Object.assign(new EventDispatcher(), { target: new Vector3(), minDistance: 6, maxDistance: 40 });
  return { camera, orbit, motion: createCameraMotion(camera, orbit) };
}
test('view change travels around the subject, without teleporting or cutting through it', () => {
  const { camera, motion } = setup();
  motion.setView('side');
  assert.equal(camera.position.x, 0);
  motion.update(1 / 60);
  assert.ok(camera.position.x > 0 && camera.position.x < 2);
  for (let i = 0; i < 180; i++) { motion.update(1 / 60); assert.ok(Math.abs(camera.position.length() - 12) < 1e-8); }
  assert.ok(camera.position.x > 11.99 && Math.abs(camera.position.z) < 0.01);
});
test('zoom eases toward bounded distances; retargeting never teleports', () => {
  const { camera, motion } = setup();
  motion.move(0, 0, 0.5);
  motion.update(1 / 60);
  const distance = camera.position.length();
  assert.ok(distance < 12 && distance > 6);
  motion.move(0, 0, 20);
  assert.equal(camera.position.length(), distance);
  for (let i = 0; i < 240; i++) motion.update(1 / 60);
  assert.ok(camera.position.length() <= 40 && camera.position.length() > 39.99);
});
test('manual orbit cancels a shot; invalid views do not change the camera', () => {
  const { camera, orbit, motion } = setup();
  motion.setView('top'); motion.update(1 / 60);
  orbit.dispatchEvent({ type: 'start' });
  const before = camera.position.clone();
  motion.update(0.05);
  assert.deepEqual(camera.position, before);
  assert.throws(() => motion.setView('unknown'), RangeError);
});
