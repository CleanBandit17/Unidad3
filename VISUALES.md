# Materia — parte visual y fuerzas

Prototipo del frente del usuario para Unidad 3. El compañero implementará las secuencias y teclas de interpretación. Aquí hay tres combinaciones de muestra, editables y sin automatización por audio. No es todavía una interpretación ensayada de LesAlpx.

## Referencias consultadas

Selección estética del asistente, basada en fragmentos visibles de YouTube y créditos de las fuentes, no en una clasificación objetiva ni en visionado completo.

| Referencia | Elemento de interés | Traducción propia |
| --- | --- | --- |
| [Anyma — Pictures Of You, Afterlife Tulum](https://www.youtube.com/watch?v=ZR63_p3xM4Q), arte acreditado a Tobias Gremmler | Arcos luminosos, escala y contraste del escenario | Corona sobre negro, foco único y espacio vacío |
| [Eric Prydz — HOLO, Tomorrowland W1 2022](https://www.youtube.com/watch?v=OBWSGTNxsNA), grabación de Chris; [presentación oficial](https://www.youtube.com/watch?v=zUHPX28At9w) | Volumen e ilusión de profundidad | Partículas 3D, perspectiva y cámara orbital |
| [Floating Points — Anasickmodular](https://www.youtube.com/watch?v=WezWspsKgpM), Hamill Industries | Filamentos azules y deformación luminosa | Estelas de posiciones reales y pliegues de equilibrio |
| [Ryoichi Kurokawa — Subassemblies](https://www.youtube.com/watch?v=5BVRtf17efI), Teatros del Canal | Materia fragmentada y nubes que se reorganizan | Campo espacial de flujo y nube incandescente |

Estas referencias orientan apariencia y comportamiento. No se incorporaron vídeos, modelos, audio ni imágenes ajenas al instrumento. Sus métodos de sincronización no se trasladan al proyecto: aquí la conducción es humana.

## Tres muestras

- **Corona:** resorte radial, giro y amortiguación. Azul interior y cobre exterior; el radio de equilibrio tiene una pequeña ondulación.
- **Marea:** mayor pliegue, giro inverso y flujo espacial. Se forman corrientes azules y turquesa.
- **Núcleo:** atracción central, anillo débil y flujo más intenso. Nube roja y ámbar en tensión.

Cambiar de muestra modifica uniformes y conserva posición y velocidad. Los botones son una previsualización de la biblioteca de fuerzas, no una partitura ni el mapeo de teclas final.

## Modelo físico y archivos

`src/simulation/createSimulation.js` mantiene posición, velocidad y cinco posiciones históricas por partícula en GPU. Suma fuerzas, actualiza velocidad y después posición (Euler semiimplícito, masa unitaria). El render usa ese estado, sin calcular trayectorias nuevas. Las estelas son sprites independientes, de modo que un cruce de frontera no dibuja una línea atravesando toda la caja.

- Base conservada: viento constante, radial suavizada, vórtice y drag lineal.
- Anillo: `Fxy = -k (r - R(theta)) er`, con `r` protegido por epsilon. Interior al radio empuja hacia fuera; exterior atrae hacia dentro. Una pequeña variación por partícula da grosor a la banda.
- Pliegue: `R(theta) = R + shell + 0.45 h cos(3 theta)` y `Fz = kz (h sin(3 theta) - z)`. Son campos de equilibrio; las posiciones siempre se integran.
- Flujo ABC: `F = a [sin(qz+t)+cos(qy), sin(qx)+cos(qz+t), sin(qy)+cos(qx)]`, `q = escala * (p-centro)`. Es un campo espacial suave y de divergencia nula. Se evalúa en compute.
- Tiempo: paso físico fijo de 1/60 s, hasta tres subpasos por frame. Un regreso de pestaña no inyecta un delta grande; si el dispositivo es lento se descarta tiempo para preservar estabilidad.
- Límites periódicos del caso base y límite de velocidad siguen activos. No equivale a una simulación física ilimitada.

`src/simulation/parameters.js`: uniformes. `src/visualInstrument.js`: API y muestras. `src/main.js`: escena, cámara, entradas y paso de tiempo. `src/ui/labPanel.js`: aislamiento LAB de fuerzas base y propias. `src/styles.css`: presentación y controles.

## Conectar la parte del compañero

Desde otro módulo, después del inicio de la aplicación:

```js
const instrument = window.visualInstrument;
instrument.setLook('marea');
instrument.setParameters({ ringRadius: 2.7, vortexStrength: -0.6, flowStrength: 0.5 });
instrument.setPalette('#1648ff', '#62ffe1');
// Para viento explícito:
instrument.setParameters({ windEnabled: 1, windX: 1.5, windY: 0, windZ: 0 });
console.table(instrument.getParameters());
console.table(instrument.ranges);
```

Actualización solicitada por el usuario: el proyecto incluye también mapeo manual de interpretación; el compañero puede ampliarlo con secuencias mediante la misma API. Las teclas 1–5 siguen siendo pruebas en LAB; en PERFORMANCE 1/2/3 seleccionan Corona/Marea/Núcleo. Los cambios mantienen posición y velocidad.

| Teclas | Acción |
| --- | --- |
| Q / W | Radio − / + |
| A / S | Giro − / + |
| Z / X | Flujo − / + |
| U / I | Pliegue − / + |
| T / Y | Luz − / + |
| Flechas | Rotación de cámara en dos ejes |
| + / − | Acercar / alejar |
| V | Alternar vista frontal, lateral y superior |
| C | Activar/desactivar órbita automática |
| J / L / O | Barrido lateral / ascenso orbital / entrada con acercamiento |
| Espacio | Golpe radial 3D con destello cálido breve |
| K / R | Pausar / reiniciar |
| H / F / P | Ocultar interfaz / pantalla completa / laboratorio |

Mantener las teclas de parámetros o cámara produce variación continua; valores acotados. Funciona con la interfaz oculta, incluso si un slider tenía el foco. También hay botones −/+ por parámetro y botones de cámara. Arrastrar rota, rueda o gesto de dos dedos hace zoom y Mayús + arrastrar mueve el centro (limitado a ±1).

Los botones de giro, zoom y vistas usan transiciones continuas en coordenadas esféricas (`src/cameraMotion.js`): la cámara viaja alrededor del centro, conserva distancia al cambiar de vista y acelera/frena el cambio de zoom sin saltar. Nuevas órdenes redirigen el destino desde la posición actual; un arrastre manual interrumpe la toma. Órbita automática arranca/frena gradualmente. Barrido/ascenso/entrada tienen botones y J/L/O; siguen disponibles con UI oculta. El redimensionado conserva el ángulo elegido.

Pruebas de cámara: tres casos con `node --test tests/camera.test.js`, aprobados: transición sin teletransporte ni paso por el centro, zoom acotado con redirección continua, cancelación por control manual. Build correcto y movimiento inspeccionado en navegador.

Para **LesAlpx**, usar la escucha para decidir tensión, liberación y cambio de comportamiento: por ejemplo, reducir radio para acumular, variar giro/flujo para transformar y pulsar Espacio en un acento elegido. Esto es una propuesta de gestos para ensayo, no un score temporal verificado. No se añadió análisis automático de audio ni se inventaron tiempos musicales.

`instrument.triggerBurst(1)` dispara una fuerza radial hacia fuera `65 * burst * normalize(p-centro)`. `burst` decae exponencialmente con constante 0.09 s y aclara las partículas durante el pulso. No teletransporta posiciones ni aplica un estrobo continuo. El botón/teclado limita disparos a uno cada 220 ms; en pausa/LAB no dispara. `disableForces()` limpia el pulso para aislar pruebas. La API también expone `instrument.camera.rotate(horizontal, vertical, zoom)`, `setView('front'|'side'|'top')` y `toggleOrbit()`.

## Verificación, 2026-10-23

- Build de producción correcto.
- Tres pruebas de API con `node --test tests/api.test.js`: peticiones inválidas atómicas, propiedades heredadas, cambio de muestras/viento y pulso acotado con decaimiento y limpieza LAB.
- [Pruebas GPU locales](http://127.0.0.1:5174/tests/gpu.html): doce predicciones verificadas contra buffers reales de 256 partículas: inercia, viento/Euler, atracción, repulsión, vórtice, dirección de anillo, convergencia, tres muestras con tiempo ×2, golpe radial hacia fuera y limpieza del pulso para LAB. Error radial medio tras seis segundos: 0.1484 unidades, dentro de la banda prevista de 0.3.
- Revisión independiente identificó contaminación de LAB, límite de storage, entrada de puntero y contrato API; ajustes aplicados. Historial reducido a cinco buffers: siete storage buffers en compute, dentro del mínimo WebGPU de ocho.
- Vista WebGPU inspeccionada en navegador integrado. No se ha medido rendimiento sostenido en el equipo de presentación ni verificado todos los navegadores.
- Dependencias originales conservadas: la auditoría inicial señaló vulnerabilidades altas en Vite y source-map-js; resolver antes de publicar.

Pendiente: revisión estética del usuario, integración de teclas/secuencias por el compañero, ensayo, score, publicación y evidencias del estudiante. La autoevaluación anterior no acredita estas pruebas ni debe copiarse como valoración de esta versión.
