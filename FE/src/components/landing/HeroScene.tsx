import { useEffect, useRef } from 'react';
// Named imports, not `import * as THREE`. A namespace import pulls the whole
// library into the chunk because a bundler cannot prove which members are
// used; naming the classes this scene actually needs lets rolldown drop the
// rest (loaders, controls, post-processing — none of it used here).
import {
  AdditiveBlending,
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

/** Points on a circle in the local XY plane, closed, for a `Line` orbit ring. */
function ringGeometry(radius: number, segments = 128): BufferGeometry {
  const points: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;

    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));

  return geometry;
}

/**
 * The landing page's 3D hero.
 *
 * ## What it depicts
 *
 * A node lattice with three tilted orbits, and a lit pulse travelling around
 * each one. Read it as stock and orders moving between locations — abstract on
 * purpose, because a literal warehouse render would date immediately and say
 * less than the headline beside it already does. The travelling pulses are the
 * part that makes it feel alive rather than like a spinning logo.
 *
 * ## Where it sits, and why that matters
 *
 * On desktop it occupies the **right half** of the hero, clear of the copy. An
 * earlier version spanned the full width at `inset-0`, which put a wireframe
 * directly behind the headline — the text stayed legible, but the page read as
 * cluttered, which is the one thing a hero cannot afford. On small screens it
 * is hidden outright: there is no room beside the copy, and behind it is the
 * mistake being corrected.
 *
 * ## The constraints it was built under
 *
 * - **Raw three.js, no `@react-three/fiber` or `drei`.** Those add well over
 *   100 kB gzipped for a reconciler this scene does not need — one group, one
 *   animation loop. CONTEXT.md D15.
 * - **No external assets.** Geometry is generated, materials are flat colours.
 *   Nothing to download, nothing that can 404.
 * - **It stops when it is not visible**, via `IntersectionObserver` — a
 *   marketing page should not spin a GPU while someone reads the pricing.
 * - **It respects reduced motion**: one frame is rendered and the loop never
 *   starts, so the artwork is still there without the movement.
 * - **Pointer parallax is damped and tiny** (±0.12 rad). Enough to feel
 *   responsive, far short of anything that could induce motion discomfort.
 *
 * The whole thing degrades to nothing if WebGL is unavailable: the canvas
 * stays empty and the hero's text — which carries the actual message — is
 * unaffected.
 */
export function HeroScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    // The container is `hidden` below the `lg` breakpoint, which means zero
    // width and height here. Building a renderer for it would spin up a real
    // GPU context on a phone to draw nothing, and hand the camera a NaN aspect
    // ratio (`0 / 0`) on the way.
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: WebGLRenderer;

    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      // No WebGL — a software-rendered fallback would be slower than useful.
      return;
    }

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    // Far enough back that the widest orbit (4.4) clears the frustum at this
    // field of view. At z=10 the outermost ring was sliced by the canvas edge.
    camera.position.set(0, 0, 13);

    // Capped at 2: beyond that the pixel count quadruples for a difference
    // nobody can see, and this runs on cheap devices.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const world = new Group();

    scene.add(world);

    // --- The core lattice --------------------------------------------------
    // An icosahedron's vertices distribute evenly on a sphere without a random
    // layout that might clump, and `EdgesGeometry` gives the connecting lines
    // for free.
    const coreGeometry = new IcosahedronGeometry(2.5, 1);
    // WebGL cannot read a CSS custom property, so the palette is mirrored
    // here as literals. They are the sRGB equivalents of brand-400/300 and
    // accent-500 from `src/index.css` — if that ramp is re-toned, these are
    // the one place outside CSS that has to follow.
    const wireMaterial = new LineBasicMaterial({
      color: 0x9b5de5,
      transparent: true,
      opacity: 0.42,
    });
    const wireGeometry = new EdgesGeometry(coreGeometry);
    const wireframe = new LineSegments(wireGeometry, wireMaterial);

    world.add(wireframe);

    // A node at each vertex. `InstancedMesh` rather than one mesh per point:
    // ~42 draw calls become one.
    const positions = coreGeometry.getAttribute('position');
    const seen = new Set<string>();
    const points: Vector3[] = [];

    for (let index = 0; index < positions.count; index += 1) {
      const point = new Vector3().fromBufferAttribute(positions, index);
      // Icosahedron vertices repeat across shared faces; dedupe so a node is
      // not drawn five times in the same place.
      const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`;

      if (seen.has(key)) continue;

      seen.add(key);
      points.push(point);
    }

    const nodeGeometry = new SphereGeometry(0.075, 12, 12);
    const nodeMaterial = new MeshBasicMaterial({ color: 0xd0a5ff });
    const nodes = new InstancedMesh(nodeGeometry, nodeMaterial, points.length);
    const matrix = new Matrix4();

    points.forEach((point, index) => {
      matrix.makeTranslation(point.x, point.y, point.z);
      nodes.setMatrixAt(index, matrix);
    });

    world.add(nodes);

    // --- Orbits, each with a travelling pulse ------------------------------
    const ORBITS = [
      { radius: 3.4, tiltX: 1.15, tiltY: 0.3, speed: 0.42, colour: 0xe0a355 },
      { radius: 3.9, tiltX: -0.6, tiltY: 0.9, speed: -0.3, colour: 0x9b5de5 },
      { radius: 4.4, tiltX: 0.35, tiltY: -1.1, speed: 0.22, colour: 0xd0a5ff },
    ];

    const pulseGeometry = new SphereGeometry(0.13, 14, 14);
    const disposables: (BufferGeometry | Material)[] = [];
    const orbits = ORBITS.map(({ radius, tiltX, tiltY, speed, colour }) => {
      const pivot = new Group();

      pivot.rotation.set(tiltX, tiltY, 0);

      const geometry = ringGeometry(radius);
      const material = new LineBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.22,
      });

      pivot.add(new Line(geometry, material));

      const pulseMaterial = new MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.95,
        // Additive so a pulse crossing the lattice brightens rather than
        // occludes — it reads as light, not as a bead on a wire.
        blending: AdditiveBlending,
      });
      const pulse = new Mesh(pulseGeometry, pulseMaterial);

      pivot.add(pulse);
      world.add(pivot);
      disposables.push(geometry, material, pulseMaterial);

      return { pulse, radius, speed, angle: Math.random() * Math.PI * 2 };
    });

    // --- Motion ------------------------------------------------------------
    let frame = 0;
    let running = !prefersReducedMotion;
    let elapsed = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let last = performance.now();

    function renderFrame(delta: number) {
      elapsed += delta;

      world.rotation.y += delta * 0.12;
      wireframe.rotation.x += delta * 0.05;
      nodes.rotation.x += delta * 0.05;

      for (const orbit of orbits) {
        orbit.angle += delta * orbit.speed;
        orbit.pulse.position.set(
          Math.cos(orbit.angle) * orbit.radius,
          Math.sin(orbit.angle) * orbit.radius,
          0
        );
      }

      // Damped pointer parallax — the scene leans toward the cursor rather
      // than snapping, which is what separates "responsive" from "twitchy".
      pointerX += (targetX - pointerX) * Math.min(1, delta * 3);
      pointerY += (targetY - pointerY) * Math.min(1, delta * 3);
      world.rotation.z = pointerX * 0.12;
      world.rotation.x = pointerY * 0.12 + Math.sin(elapsed * 0.3) * 0.05;

      renderer.render(scene, camera);
    }

    function loop(now: number) {
      if (!running) return;

      // Clamped: a backgrounded tab resumes with a huge delta, which would
      // teleport every pulse instead of animating it.
      const delta = Math.min((now - last) / 1000, 0.05);

      last = now;
      renderFrame(delta);
      frame = requestAnimationFrame(loop);
    }

    // One frame always, so a reduced-motion visitor still sees the artwork.
    renderFrame(0);

    function handlePointerMove(event: PointerEvent) {
      const bounds = container?.getBoundingClientRect();

      if (!bounds) return;

      targetX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      targetY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    }

    if (!prefersReducedMotion) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
    }

    function handleResize() {
      if (!container) return;

      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderFrame(0);
    }

    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(container);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (prefersReducedMotion) return;

        const visible = entry?.isIntersecting ?? false;

        if (visible && !running) {
          running = true;
          last = performance.now();
          frame = requestAnimationFrame(loop);
        } else if (!visible) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { threshold: 0.05 }
    );

    visibilityObserver.observe(container);

    if (running) frame = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);

      // Explicit disposal: three.js holds GPU resources that garbage
      // collection does not release, so a route change would leak a context
      // per visit without this.
      coreGeometry.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      pulseGeometry.dispose();

      for (const item of disposables) item.dispose();

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      // Decorative: the headline beside it carries the message, so a screen
      // reader gains nothing from being told a canvas is here.
      aria-hidden="true"
      className="w-hero-scene pointer-events-none absolute inset-y-0 right-0 hidden lg:block"
    />
  );
}
