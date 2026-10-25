import test from 'node:test';
import assert from 'node:assert/strict';
import { createParameters } from '../src/simulation/parameters.js';
import { createVisualInstrument } from '../src/visualInstrument.js';

test('invalid multi-parameter requests are atomic, including prototype names', () => {
  const api = createVisualInstrument(createParameters());
  const before = api.getParameters();
  for (const values of [{ ringRadius: 2, flowStrength: NaN }, { toString: 1 }, { ringRadius: 50 }]) {
    assert.throws(() => api.setParameters(values), RangeError);
    assert.deepEqual(api.getParameters(), before);
  }
  assert.throws(() => api.setLook('constructor'), RangeError);
  assert.deepEqual(api.getParameters(), before);
});
test('looks clear previous forces and notify the UI; wind vector is accessible', () => {
  const events = [];
  const api = createVisualInstrument(createParameters(), change => events.push(change));
  api.setLook('nucleo');
  api.setLook('corona');
  assert.equal(api.getParameters().radialEnabled, 0);
  assert.equal(events.at(-1).look, 'corona');
  api.setParameters({ windEnabled: 1, windX: 1.5, windY: -0.3 });
  assert.equal(api.getParameters().windX, 1.5);
  assert.equal(api.getParameters().windY, -0.3);
  api.disableForces();
  for (const key of ['radialEnabled', 'ringEnabled', 'flowEnabled', 'confinement', 'windEnabled', 'vortexEnabled', 'dragEnabled']) assert.equal(api.getParameters()[key], 0);
});
test('manual burst is bounded, decays, and is cleared for LAB', () => {
  const params = createParameters();
  const api = createVisualInstrument(params);
  assert.throws(() => api.triggerBurst(2), RangeError);
  api.triggerBurst();
  assert.equal(params.burst.value, 1);
  api.updateTransient(0.09);
  assert.ok(Math.abs(params.burst.value - Math.exp(-1)) < 1e-6);
  api.disableForces();
  assert.equal(params.burst.value, 0);
});
