export const LOOKS = {
  corona: { label: 'Corona', description: 'Órbitas de cobre y azul. La tensión reúne la materia en un anillo vivo.',
    values: { ringEnabled: 1, ringStrength: 2.8, ringRadius: 2.5, waveHeight: 0.45, confinement: 2.2, vortexEnabled: 1, vortexStrength: 0.85, flowEnabled: 1, flowStrength: 0.12, dragEnabled: 1, dragCoefficient: 0.8 }, colors: ['#1674ff', '#ffa54c'] },
  marea: { label: 'Marea', description: 'Pliegues de luz fría. El flujo deshace el anillo y lo convierte en corrientes.',
    values: { ringEnabled: 1, ringStrength: 1.4, ringRadius: 2.35, waveHeight: 1.3, confinement: 1.2, vortexEnabled: 1, vortexStrength: -0.55, flowEnabled: 1, flowStrength: 0.8, dragEnabled: 1, dragCoefficient: 0.65 }, colors: ['#1648ff', '#62ffe1'] },
  nucleo: { label: 'Núcleo', description: 'Materia incandescente. Atracción, giro y turbulencia sostienen una nube en tensión.',
    values: { radialEnabled: 1, radialStrength: 0.7, ringEnabled: 1, ringStrength: 0.5, ringRadius: 1.65, waveHeight: 0.75, confinement: 0.35, vortexEnabled: 1, vortexStrength: 0.5, flowEnabled: 1, flowStrength: 1.2, dragEnabled: 1, dragCoefficient: 0.48 }, colors: ['#fc3425', '#ffb94e'] }
};
const RANGES = {
  timeScale: [0, 2], maxSpeed: [0.2, 12], initialSpeed: [0, 2], particleSize: [0.005, 0.06],
  radialEnabled: [0, 1], radialStrength: [-8, 8], softening: [0.1, 2], vortexEnabled: [0, 1], vortexStrength: [-8, 8],
  dragEnabled: [0, 1], dragCoefficient: [0, 2], windEnabled: [0, 1], windX: [-4, 4], windY: [-4, 4], windZ: [-4, 4],
  ringEnabled: [0, 1], ringStrength: [0, 8], ringRadius: [0.8, 3.5], waveHeight: [0, 1.3],
  flowEnabled: [0, 1], flowStrength: [0, 2], flowScale: [0.1, 3], confinement: [0, 5],
  brightness: [0.1, 1], trails: [0, 1]
};
export function createVisualInstrument(params, onChange = () => {}) {
  const read = key => /^wind[XYZ]$/.test(key) ? params.wind.value[key.at(-1).toLowerCase()] : params[key].value;
  const write = (key, value) => { if (/^wind[XYZ]$/.test(key)) params.wind.value[key.at(-1).toLowerCase()] = value; else params[key].value = value; };
  const disableForces = () => {
    for (const key of ['windEnabled', 'radialEnabled', 'vortexEnabled', 'dragEnabled', 'ringEnabled', 'flowEnabled', 'confinement', 'burst']) params[key].value = 0;
  };
  function setParameters(values) {
    for (const [key, value] of Object.entries(values)) {
      const range = Object.hasOwn(RANGES, key) ? RANGES[key] : null;
      if (!range || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new RangeError(`Parámetro fuera de rango: ${key}`);
    }
    for (const [key, value] of Object.entries(values)) write(key, value);
    onChange();
  }
  function setPalette(cold, warm) {
    if (![cold, warm].every(value => /^#[\da-f]{6}$/i.test(value))) throw new TypeError('Usa colores hexadecimales #RRGGBB.');
    params.colorCold.value.set(cold);
    params.colorWarm.value.set(warm);
  }
  function setLook(name) {
    const look = Object.hasOwn(LOOKS, name) ? LOOKS[name] : null;
    if (!look) throw new RangeError(`Comportamiento desconocido: ${name}`);
    disableForces();
    setParameters(look.values);
    setPalette(...look.colors);
    onChange({ look: name });
  }
  function triggerBurst(strength = 1) {
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new RangeError('Golpe: intensidad de 0 a 1.');
    params.burst.value = Math.max(params.burst.value, strength);
    onChange({ burst: true });
  }
  function updateTransient(dt) {
    params.burst.value *= Math.exp(-dt / 0.09);
    if (params.burst.value < 0.001) params.burst.value = 0;
  }
  return { setParameters, setPalette, setLook, disableForces, triggerBurst, updateTransient,
    getParameters: () => Object.fromEntries(Object.keys(RANGES).map(key => [key, read(key)])),
    ranges: structuredClone(RANGES) };
}
