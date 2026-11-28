import { useEffect, useMemo, useRef, type ComponentProps, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Edges, Html, OrthographicCamera } from '@react-three/drei';
import { stations, startChart, SPACING } from '@/deck';
import { X } from '@/data/exhibits';
import { marketWindows, timelineMilestones, type SimulationEvent, type SimulationSnapshot } from '@/lib/simulation';
import { marketAction } from '@/lib/timeline-actions';
import { OrderPopup } from './OrderPopup';

/**
 * Labels are DOM elements pinned to points in the scene. They all mount into one overlay that exists
 * before the canvas does. Without a fixed mount point the label library re-homes early labels once the
 * canvas connects its events, and that move can leave the first label of an exhibit empty.
 */
const overlay: { current: HTMLDivElement | null } = { current: null };
function Label(props: ComponentProps<typeof Html>) {
  return <Html portal={overlay as RefObject<HTMLElement>} {...props} />;
}

const C = {
  paper: '#efe6d6', plate: '#f5eedf', ink: '#1c2438', yes: '#d8402a', no: '#1d6f78', brass: '#c08a2b', haze: '#d9cdb8',
};

export const stationX = (i: number) => i * SPACING;
const INITIAL_CAMERA = { position: [-4, 3, 11] as [number, number, number], fov: 42 };
const RAIL_Z = 2.1;
const HALF_FOV = Math.tan((INITIAL_CAMERA.fov / 2) * (Math.PI / 180));

/** Width, height and vertical centre each exhibit needs, in world units, so any plate shape frames it. */
const FRAME: Record<string, { w: number; h: number; cy: number }> = {
  open: { w: 6.4, h: 7.4, cy: 2.3 },
  types: { w: 12.6, h: 9.2, cy: 2.1 },
  buying: { w: 8.2, h: 7.2, cy: 2.3 },
  trigger: { w: 10.8, h: 6.6, cy: 1.8 },
  results: { w: 9.4, h: 7.6, cy: 2.2 },
  start: { w: 9.4, h: 7.6, cy: 2.2 },
  stressed: { w: 9.4, h: 7.6, cy: 2.2 },
  appendix: { w: 9.8, h: 8.4, cy: 2.6 },
};

const rootRem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/** Orthographic zoom for the order replay: the lanes span 16 units, with room for lane labels at both ends. */
function timelineZoom(width: number, height: number) {
  const rem = rootRem();
  return width < 640
    ? Math.max(6, (width - 9 * rem) / 16)
    : Math.max(8, Math.min((width - 17 * rem) / 16, (height - 12 * rem) / 8.5));
}

function ReplayCamera({ enabled }: { enabled: boolean }) {
  const { width, height } = useThree(s => s.size);
  return enabled
    ? <OrthographicCamera makeDefault position={[0, 30, 50]} zoom={timelineZoom(width, height)} near={0.1} far={250} />
    : null;
}

function Rig({ station, replay, active }: { station: number; replay: boolean; active: boolean }) {
  const activeCamera = useRef<THREE.Camera | null>(null);
  const wasActive = useRef(active);
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  useFrame(({ camera, pointer, clock, size }, dt) => {
    const x = stationX(station);
    const sway = Math.sin(clock.elapsedTime * 0.25) * 0.4;
    const compact = size.width < 640;
    const aspect = size.width / Math.max(1, size.height);
    if (replay) {
      const distance = Math.max(13, (compact ? 24 : 18) / Math.max(0.35, aspect));
      target.current.set(x + (compact ? -4 : 0) + pointer.x * 0.08, distance * 1.35, distance);
      lookTarget.current.set(x + (compact ? -4 : 0), 0, 0);
    } else {
      // Stand far enough back that the exhibit fits the plate in both directions.
      const f = FRAME[stations[station]?.id ?? ''] ?? FRAME.results!;
      const distance = Math.max(f.h / (2 * HALF_FOV), f.w / (2 * HALF_FOV * aspect));
      target.current.set(x + 1.5 + pointer.x * 0.3 + sway * 0.2, f.cy + distance * 0.2 + pointer.y * 0.3, distance);
      lookTarget.current.set(x + 1.5, f.cy, 0);
    }
    const k = 1 - Math.pow(0.04, dt);
    // Snap on a new camera, and when the stage returns from a figure chapter, so nothing drifts in from afar.
    if (activeCamera.current !== camera || (active && !wasActive.current)) {
      camera.position.copy(target.current);
      look.current.copy(lookTarget.current);
      activeCamera.current = camera;
    } else {
      camera.position.lerp(target.current, k);
      look.current.lerp(lookTarget.current, k);
    }
    wasActive.current = active;
    camera.lookAt(look.current);
    if ('isOrthographicCamera' in camera && camera.isOrthographicCamera) {
      const ortho = camera as THREE.OrthographicCamera;
      ortho.zoom = timelineZoom(size.width, size.height);
      ortho.updateProjectionMatrix();
    }
  });
  return null;
}

/** A soft pool of shade on the floor under an exhibit, so it sits on the plate instead of floating over it. */
let shadeTexture: THREE.CanvasTexture | null = null;
function shade() {
  if (shadeTexture) return shadeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const fall = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  fall.addColorStop(0, 'rgba(28,36,56,0.34)');
  fall.addColorStop(0.55, 'rgba(28,36,56,0.12)');
  fall.addColorStop(1, 'rgba(28,36,56,0)');
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, 128, 128);
  shadeTexture = new THREE.CanvasTexture(canvas);
  return shadeTexture;
}
function Shade({ w, d, x = 0, z = 0 }: { w: number; d: number; x?: number; z?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, z]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={shade()} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Float({ children, speed = 1, amp = 0.15 }: { children: React.ReactNode; speed?: number; amp?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) { g.current.position.y = Math.sin(clock.elapsedTime * speed) * amp; g.current.rotation.y = Math.sin(clock.elapsedTime * speed * 0.4) * 0.12; }
  });
  return <group ref={g}>{children}</group>;
}

/**
 * The whole calendar: one tile per scheduled opportunity, in voting-date order.
 * Raised tiles are the markets the continuous account bought, as tall as the shares it held.
 */
const U_ROWS = 30;
const U_STEP = 0.148;
function Universe() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const started = useRef(0);
  const settled = useRef(false);
  const cells = useMemo(() => X.universe.cells.map((c, i) => ({ c, i })).sort((a, b) => a.c[0]! - b.c[0]! || a.i - b.i).map(({ c }) => c), []);
  const cols = Math.ceil(cells.length / U_ROWS);
  const look = useMemo(() => cells.map((c) => {
    const [, , listed, side, shares, result] = c as [number, number, number, number, number, number, number];
    const bought = shares > 0;
    const color = bought ? (result === 2 ? C.ink : side === 1 ? C.yes : C.no) : listed ? '#cbbd9f' : '#e4d9c3';
    return { height: bought ? 0.5 + (shares / 100) * 8.6 : listed ? 0.5 : 0.18, color: new THREE.Color(color), bought };
  }), [cells]);
  // Name the two general-election blocks, which hold most of the calendar.
  const blocks = useMemo(() => {
    const spans = new Map<number, [number, number]>();
    cells.forEach((c, i) => { const s = spans.get(c[0]!); if (s) s[1] = i; else spans.set(c[0]!, [i, i]); });
    return [...spans.entries()].map(([d, [from, to]]) => ({ date: X.universe.dates[d]!, n: to - from + 1, col: (Math.floor(from / U_ROWS) + Math.floor(to / U_ROWS)) / 2 }))
      .sort((a, b) => b.n - a.n).slice(0, 2);
  }, [cells]);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    look.forEach((l, i) => m.setColorAt(i, l.color));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [look]);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m || settled.current) return;
    if (!started.current) started.current = clock.elapsedTime;
    const o = new THREE.Object3D();
    const t = clock.elapsedTime - started.current;
    for (let i = 0; i < cells.length; i++) {
      const col = Math.floor(i / U_ROWS), row = i % U_ROWS;
      // Bought tiles rise in a sweep from the first voting date to the last.
      const p = look[i]!.bought ? Math.min(1, Math.max(0, (t - 0.25 - (col / cols) * 1.1) / 0.8)) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      const sy = look[i]!.bought ? 0.5 + (look[i]!.height - 0.5) * e : look[i]!.height;
      o.position.set((col - (cols - 1) / 2) * U_STEP, (sy * 0.1) / 2, (row - (U_ROWS - 1) / 2) * U_STEP);
      o.scale.set(1, sy, 1);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (t > 2.4) settled.current = true;
  });
  const month = (iso: string) => { const [y, mo, d] = iso.split('-').map(Number); return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo! - 1]} ${y}`; };
  return (
    <group rotation={[0.7, -0.12, 0]} position={[0, 2.6, 0]}>
      <mesh position={[0, -0.02, 0]}><boxGeometry args={[cols * U_STEP + 0.3, 0.03, U_ROWS * U_STEP + 0.3]} /><meshBasicMaterial color="#ece2ce" toneMapped={false} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, cells.length]}>
        <boxGeometry args={[0.112, 0.1, 0.112]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {blocks.map((b) => (
        <Label key={b.date} position={[(b.col - (cols - 1) / 2) * U_STEP, 0, (U_ROWS / 2) * U_STEP + 0.42]} center zIndexRange={[5, 0]}>
          <div className="scene-note" style={{ textAlign: 'center' }}><b>{month(b.date)}</b><br />{b.n} opportunities</div>
        </Label>
      ))}
    </group>
  );
}

function Stacks() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const n = Math.floor((clock.elapsedTime * 1.3) % 14);
    g.current.children.forEach((c, i) => { if (i < 10) c.visible = i < n; });
  });
  return (
    <group position={[-0.9, 0, 0]}>
    <Shade w={4.6} d={4} />
    <group ref={g}>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[0, 0.2 + i * 0.42, 0]}><boxGeometry args={[1.7, 0.36, 1.7]} /><meshStandardMaterial color={i % 2 ? C.yes : '#e6705c'} roughness={0.7} /></mesh>
      ))}
      <mesh position={[0, 4.4, 0]}><boxGeometry args={[2.3, 0.03, 2.3]} /><meshBasicMaterial color={C.ink} /></mesh>
      <Label position={[1.5, 4.4, 0]} zIndexRange={[5, 0]}><div className="scene-note" style={{ transform: 'translateY(-50%)' }}><b>100-share cap</b><br />per contract</div></Label>
      <Label position={[1.3, 0.2, 0]} zIndexRange={[5, 0]}><div className="scene-note" style={{ transform: 'translateY(-50%)' }}>one order,<br />up to 10 shares</div></Label>
    </group>
    </group>
  );
}

function FillWindow() {
  const o = useRef<THREE.Mesh>(null); const f = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 5) / 5;
    if (o.current) o.current.position.x = -3 + t * 6;
    if (f.current) { const fill = Math.min(1, t * 1.4); f.current.scale.y = Math.max(0.01, fill); f.current.position.y = 0.5 + fill * 0.75; }
  });
  return (
    <group position={[0.5, 1.1, 0]} scale={1.18}>
      <mesh><boxGeometry args={[6, 0.04, 0.6]} /><meshStandardMaterial color={C.ink} /></mesh>
      <mesh position={[3, 0.8, 0]}><boxGeometry args={[0.04, 1.6, 0.6]} /><meshStandardMaterial color={C.yes} /></mesh>
      <mesh ref={o} position={[-3, 0.5, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color={C.no} transparent opacity={0.5} /></mesh>
      <mesh ref={f} position={[-3.8, 0.5, 0]}><boxGeometry args={[0.4, 1.5, 0.4]} /><meshStandardMaterial color={C.no} /></mesh>
      <Label position={[3, 1.95, 0]} center zIndexRange={[5, 0]}><div className="scene-note"><b>expires at 30s</b></div></Label>
      <Label position={[-3.8, 2.45, 0]} center zIndexRange={[5, 0]}><div className="scene-note">shares filled</div></Label>
      <Label position={[0, -0.42, 0.4]} center zIndexRange={[5, 0]}><div className="scene-note">one order's 30 seconds</div></Label>
    </group>
  );
}

type Bar = { label: string; v: number; v2?: number };
function Bars({ vals, max = 320, legend }: { vals: Bar[]; max?: number; legend?: [string, string] }) {
  const gap = vals.some((r) => r.v2 != null) ? 2.3 : 1.8;
  return (
    <group position={[-(vals.length - 1) * (gap / 2), 0, 0]}>
      <Shade w={vals.length * gap + 2.4} d={3.2} x={(vals.length - 1) * (gap / 2)} />
      {vals.map((r, i) => (
        <group key={r.label} position={[i * gap, 0, 0]}>
          <Grow h={(r.v / max) * 4.5} color={C.yes} x={r.v2 == null ? 0 : -0.32} delay={i * 0.2} />
          {r.v2 != null && <Grow h={(r.v2 / max) * 4.5} color={C.no} x={0.32} delay={i * 0.2 + 0.1} />}
          <Label position={[0, -0.3, 0.45]} center zIndexRange={[5, 0]}>
            <div style={{ font: '500 .72rem var(--font-sans)', color: C.ink, whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.35 }}>
              {r.label}<br /><b style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>${r.v.toFixed(2)}</b>
              {r.v2 != null && <span style={{ color: '#4b5368', fontVariantNumeric: 'tabular-nums' }}> / ${r.v2.toFixed(2)}</span>}
            </div>
          </Label>
        </group>
      ))}
      {legend && (
        <Label position={[(vals.length - 1) * (gap / 2), 5.1, 0]} center zIndexRange={[5, 0]}>
          <div style={{ font: '500 .72rem var(--font-sans)', color: C.ink, whiteSpace: 'nowrap', display: 'flex', gap: '1rem' }}>
            <span><i style={{ display: 'inline-block', width: '.7rem', height: '.7rem', background: C.yes, marginRight: '.35rem', verticalAlign: '-.08rem' }} />{legend[0]}</span>
            <span><i style={{ display: 'inline-block', width: '.7rem', height: '.7rem', background: C.no, marginRight: '.35rem', verticalAlign: '-.08rem' }} />{legend[1]}</span>
          </div>
        </Label>
      )}
    </group>
  );
}
function Grow({ h, color, x, delay }: { h: number; color: string; x: number; delay: number }) {
  const m = useRef<THREE.Mesh>(null); const t0 = useRef(0);
  useFrame(({ clock }) => {
    if (!m.current) return; if (!t0.current) t0.current = clock.elapsedTime;
    const p = Math.min(1, Math.max(0, (clock.elapsedTime - t0.current - delay) / 1.4));
    const e = 1 - Math.pow(1 - p, 3); const s = Math.max(0.01, h * e);
    m.current.scale.y = s; m.current.position.y = s / 2;
  });
  return <mesh ref={m} position={[x, 0, 0]}><boxGeometry args={[0.5, 1, 0.5]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>;
}

/** A ballot box. The ballot drops through the slot, and another follows. */
function Urn() {
  const ballot = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 5) / 5;
    const drop = Math.min(1, Math.max(0, (t - 0.5) / 0.28));
    const e = drop * drop * (3 - 2 * drop);
    if (ballot.current) {
      ballot.current.position.y = 3.72 - e * 1.75;
      ballot.current.rotation.z = 0.1 * (1 - e);
      ballot.current.visible = t < 0.86;
    }
  });
  return (
    <>
    <Shade w={6.4} d={5.2} />
    <Float amp={0.1} speed={0.6}>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[2.7, 2.6, 2.7]} />
        <meshStandardMaterial color="#f4ecdb" roughness={0.9} />
        <Edges color={C.ink} lineWidth={1.4} />
      </mesh>
      <mesh position={[0, 2.712, 0]}><boxGeometry args={[1.55, 0.02, 0.2]} /><meshBasicMaterial color={C.ink} /></mesh>
      <group ref={ballot} position={[0, 3.72, 0]} rotation={[0, 0.28, 0.1]}>
        <mesh><boxGeometry args={[1.2, 1.5, 0.03]} /><meshStandardMaterial color={C.yes} roughness={0.75} /></mesh>
      </group>
    </Float>
    </>
  );
}

const NORMAL = [{ label: '2024', v: 165.11 }, { label: '2025', v: 36.2 }, { label: '2026', v: 72.52 }, { label: '2024–2026', v: 301.55 }];
const STRESSED = [{ label: '2024', v: 148.55 }, { label: '2025', v: 28.51 }, { label: '2026', v: 40.17 }, { label: '2024–2026', v: 229.94 }];
/** Net paper profit of the three entry rules, from the source deck's appendix. */
const ENTRY_RULES = [
  { label: 'Buy immediately', v: 301.55, v2: 229.94 },
  { label: 'Always wait', v: 411.55, v2: 265.86 },
  { label: 'Calendar exception', v: 438.08, v2: 339.85 },
];
function Exhibit({ id }: { id: string }) {
  switch (id) {
    case 'open': return <Urn />;
    case 'types': return <Universe />;
    case 'buying': return <Stacks />;
    case 'trigger': return <FillWindow />;
    case 'results': return <Bars vals={NORMAL} />;
    case 'start': return <Bars vals={startChart} />;
    case 'stressed': return <Bars vals={STRESSED} />;
    case 'appendix': return <Bars vals={ENTRY_RULES} max={460} legend={['Normal', 'Stressed']} />;
    default: return null;
  }
}

const TX = (t: number, d: number) => -8 + (t / d) * 16;
function Replay({ snap, selected, time, events, duration, labels }: { snap: SimulationSnapshot | null; selected: string; time: number; events: SimulationEvent[]; duration: number; labels: boolean }) {
  const compact = useThree(s => s.size.width < 640);
  const laneGap = compact ? 14 : 3.4;
  const depth = laneGap * 2 + 2.2;
  const tx = (t: number) => TX(t, duration);
  const fills = events.filter((e) => e.type === 'fill' && e.time <= time);
  const label = (txt: string, color = C.ink, w = 600, size = 0.6) => <div className="scene-label" style={{ fontWeight: w, fontSize: `${size}rem`, color }}>{txt}</div>;
  return (
    <group>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, depth + 3]} /><meshBasicMaterial color="#e6dbc6" toneMapped={false} /></mesh>
      {labels && timelineMilestones.filter((_, i) => !compact || i % 2 === 0 || i === timelineMilestones.length - 1).map((m) => (
        <group key={m.label} position={[tx(m.time), 0, 0]}>
          <mesh position={[0, 0.005, 0]}><boxGeometry args={[0.02, 0.01, depth]} /><meshBasicMaterial color={C.ink} transparent opacity={0.25} /></mesh>
          <Label position={[Math.max(-7.2, Math.min(7.2, tx(m.time))) - tx(m.time), 0, depth / 2 + 0.1]} center>{label(m.label.toUpperCase(), C.ink, 600, compact ? 0.55 : 0.62)}</Label>
        </group>
      ))}
      {marketWindows.map((w, i) => {
        const col = w.side === 'YES' ? C.yes : C.no; const z = (i - 1) * laneGap; const sel = w.name === selected;
        const bx = tx(w.opening), ex = tx(w.close), sx = tx(w.settlement);
        const doneB = Math.max(0, Math.min(time, w.close) - w.opening), doneH = Math.max(0, Math.min(time, w.settlement) - w.close);
        const h = snap?.holdings.find((k) => k.market === w.name);
        const settled = time >= w.settlement;
        const action = marketAction(snap, time, w.name);
        let cum = 0;
        return (
          <group key={w.name} position={[0, 0, z]}>
            {labels && <Label position={[Math.max(-6.2, Math.min(compact ? 1 : 6.2, tx(Math.min(time, w.settlement)))), 1.8, 0]} center zIndexRange={[12, 11]}>
              <div role="status" data-testid={`popup-${w.name.split(' ')[0].toLowerCase()}`} style={{ opacity: action ? 1 : 0, transition: 'opacity 180ms', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                <OrderPopup action={action} color={col} />
                <div style={{ width: 1, height: 18, background: `${col}88`, margin: '0 auto' }} />
              </div>
            </Label>}
            <mesh position={[(bx + ex) / 2, 0.07, 0]}><boxGeometry args={[ex - bx, 0.13, sel ? 1.2 : 1.05]} /><meshStandardMaterial color={col} transparent opacity={0.22} /></mesh>
            {doneB > 0 && <mesh position={[bx + tx(doneB) / 2 + 4, 0.14, 0]}><boxGeometry args={[tx(doneB) + 8, 0.16, 1.05]} /><meshStandardMaterial color={col} transparent opacity={0.55} /></mesh>}
            <mesh position={[(ex + sx) / 2, 0.04, 0]}><boxGeometry args={[sx - ex, 0.06, 0.28]} /><meshStandardMaterial color={C.ink} transparent opacity={0.25} /></mesh>
            {doneH > 0 && <mesh position={[ex + (tx(doneH) + 8) / 2, 0.08, 0]}><boxGeometry args={[tx(doneH) + 8, 0.09, 0.3]} /><meshStandardMaterial color={C.ink} /></mesh>}
            <mesh position={[ex, 0.8, 0]}><boxGeometry args={[0.1, 1.6, 1.15]} /><meshStandardMaterial color={C.ink} /></mesh>
            {labels && <Label position={[ex, 0, compact ? 0.4 : 0.8]} center>{label(compact ? 'CLOSE' : 'VOTE / CLOSE', C.ink, 600, compact ? 0.5 : 0.56)}</Label>}
            <group position={[sx, 0, 0]}>
              <mesh position={[0, settled ? 0.4 : 0.08, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.4, 0.4, settled ? 0.14 : 0.06, 32]} /><meshStandardMaterial color={C.brass} metalness={settled ? 0.35 : 0} roughness={0.35} transparent opacity={settled ? 1 : 0.4} /></mesh>
              {labels && <Label position={[0, 0, compact ? 2 : 0.8]} center>{label(settled ? `SETTLED $${w.wins ? (h?.shares ?? 0) : 0}` : 'SETTLES', settled ? '#8a6212' : C.ink, 700, compact ? 0.5 : 0.56)}</Label>}
            </group>
            {labels && <Label position={[-8.1, 0.15, 0]} center><div style={{ transform: 'translateX(-55%)', font: `${sel ? 700 : 600} .82rem var(--font-sans)`, color: col, whiteSpace: 'nowrap', textAlign: 'right', padding: '.35rem .55rem', background: '#f5eedfed', borderRadius: 3 }}>
              {w.side} on {w.name.replace(' wins', '')}
              <div style={{ font: '400 .68rem var(--font-mono)', marginTop: 4, color: C.ink }} data-testid={`opening-bid-${w.name.split(' ')[0].toLowerCase()}`}>Opening bid ${w.bid.toFixed(2)}</div>
            </div></Label>}
            {fills.filter((e) => e.market === w.name).map((e, k) => {
              cum += e.quantity; const ht = Math.max(0.12, (cum / 100) * 3.2);
              return <mesh key={k} position={[tx(e.time), ht / 2 + 0.22, 0]}><boxGeometry args={[0.23, ht, 0.78]} /><meshStandardMaterial color={col} /></mesh>;
            })}
            {(snap?.orders ?? []).filter((o) => o.market === w.name && o.status === 'expired' && o.quantity === o.remaining).map((o) => (
              <mesh key={o.id} position={[tx(o.endedAt ?? o.submittedAt + 30), 0.38, 0]}><boxGeometry args={[0.32, 0.32, 0.32]} /><meshStandardMaterial color={C.ink} wireframe transparent opacity={0.4} /></mesh>
            ))}
          </group>
        );
      })}
      <group position={[tx(time), 0, 0]}>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[0.04, 2.4, depth]} /><meshBasicMaterial color={C.yes} transparent opacity={0.12} /></mesh>
        <mesh position={[0, 1.2, depth / 2]}><boxGeometry args={[0.05, 2.4, 0.05]} /><meshBasicMaterial color={C.yes} /></mesh>
      </group>
    </group>
  );
}

/** A line under the plate saying what the exhibit shows. */
const CAPTIONS: Record<string, string> = {
  types: `Each tile is one of ${X.universe.cells.length.toLocaleString('en-US')} scheduled opportunities, in voting-date order. Raised tiles were bought, as tall as the shares held: YES in red, NO in teal, losses in dark ink.`,
  buying: 'Orders of up to 10 shares stack toward the 100-share cap.',
  trigger: 'Illustrative: an order waits for an eligible trade, fills a slice of it, and expires after 30 seconds.',
  results: 'Normal net profit. Annual runs restart at $1,000.',
  start: 'Normal net profit over 2024 to 2026 by buying start day.',
  stressed: 'Stressed net profit. Annual runs restart at $1,000.',
  appendix: 'Net paper profit over 2024 to 2026: normal / stressed.',
};

export default function Scene({ station, active, replay, snap, selected, time, events, duration }: {
  station: number; active: boolean; replay: boolean; snap: SimulationSnapshot | null; selected: string; time: number; events: SimulationEvent[]; duration: number;
}) {
  const replayIdx = stations.findIndex((c) => c.kind === 'replay');
  const bg = replay ? C.paper : C.plate;
  const caption = CAPTIONS[stations[station]?.id ?? ''];
  return (
    <div className="absolute inset-0">
      <div ref={(el) => { overlay.current = el; }} className="scene-overlay" />
      <Canvas camera={INITIAL_CAMERA} dpr={[1, 2]} shadows={false} flat frameloop={active ? 'always' : 'never'}>
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, replay ? 80 : 26, replay ? 160 : 60]} />
        <ambientLight intensity={1.62} />
        <directionalLight position={[6, 10, 6]} intensity={2.1} color="#fff6e8" />
        <directionalLight position={[-8, 4, -4]} intensity={0.55} color="#cfe3e6" />
        <ReplayCamera enabled={replay} />
        <Rig station={station} replay={replay} active={active} />
        {/* The floor takes the background colour, so a plate reads as open paper with one rail across it. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[stations.length * SPACING / 2, -0.05, 0]}>
          <planeGeometry args={[stations.length * SPACING + 60, 60]} />
          <meshBasicMaterial color={bg} toneMapped={false} fog={false} />
        </mesh>
        {!replay && <mesh position={[stations.length * SPACING / 2, 0, RAIL_Z]}><boxGeometry args={[stations.length * SPACING + 20, 0.035, 0.045]} /><meshBasicMaterial color={C.ink} /></mesh>}
        {!replay && stations.map((c, i) => (
          <group key={c.id} position={[stationX(i) + 1.5, 0, 0]}>
            <mesh position={[0, 0.02, RAIL_Z]}><cylinderGeometry args={[0.12, 0.12, 0.05, 24]} /><meshBasicMaterial color={i === station ? C.yes : C.ink} /></mesh>
            {Math.abs(i - station) <= 1 && <Exhibit id={c.id} />}
          </group>
        ))}
        {replay && <group position={[stationX(replayIdx), 0, 0]}><Replay snap={snap} selected={selected} time={time} events={events} duration={duration} labels={replay} /></group>}
      </Canvas>
      {!replay && caption && (
        <div className="scene-caption" key={caption}>{caption}</div>
      )}
    </div>
  );
}
