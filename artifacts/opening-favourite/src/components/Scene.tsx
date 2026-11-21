import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { chapters, startChart, SPACING } from '@/deck';
import { marketWindows, timelineMilestones, storyDate, type SimulationEvent, type SimulationSnapshot } from '@/lib/simulation';
import { Html } from '@react-three/drei';
import { marketAction } from '@/lib/timeline-actions';

const C = {
  paper: '#efe6d6', ink: '#1c2438', yes: '#d8402a', no: '#1d6f78', brass: '#c08a2b', haze: '#d9cdb8',
};

export const stationX = (i: number) => i * SPACING;

function Rig({ index, replay }: { index: number; replay: boolean }) {
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  useFrame(({ camera, pointer, clock, size }, dt) => {
    const x = stationX(index);
    const sway = Math.sin(clock.elapsedTime * 0.25) * 0.4;
    if (replay) {
      const distance = Math.max(20, 21 / Math.max(0.5, size.width / size.height));
      target.current.set(x + pointer.x * 0.15, distance * 0.65, distance);
    }
    else target.current.set(x - 3.2 + pointer.x * 1.2 + sway, 3.2 + pointer.y * 0.6, 11);
    const k = 1 - Math.pow(0.04, dt);
    camera.position.lerp(target.current, k);
    look.current.lerp(new THREE.Vector3(x + (replay ? 0 : 1.5), replay ? 0 : 1.6, 0), k);
    camera.lookAt(look.current);
  });
  return null;
}

function Float({ children, speed = 1, amp = 0.15 }: { children: React.ReactNode; speed?: number; amp?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) { g.current.position.y = Math.sin(clock.elapsedTime * speed) * amp; g.current.rotation.y = Math.sin(clock.elapsedTime * speed * 0.4) * 0.12; }
  });
  return <group ref={g}>{children}</group>;
}

function Universe() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 52 * 34;
  const listed = useMemo(() => {
    const s = new Set<number>(); let seed = 7;
    while (s.size < 530) { seed = (seed * 16807) % 2147483647; s.add(seed % count); }
    return s;
  }, [count]);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D(); const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const c = i % 52, r = Math.floor(i / 52);
      const on = listed.has(i);
      o.position.set((c - 26) * 0.16, (on ? 0.2 + Math.sin(t * 1.5 + c * 0.3) * 0.06 : 0) + r * 0.0, (r - 17) * 0.16);
      o.scale.set(1, on ? 3 : 0.6, 1);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, new THREE.Color(on ? (i % 3 ? C.yes : C.no) : C.haze));
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group rotation={[0.5, -0.4, 0]} position={[0, 1, 0]}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

function Stacks() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const n = Math.floor((clock.elapsedTime * 1.3) % 12);
    g.current.children.forEach((c, i) => { c.visible = i < n; });
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[0, 0.2 + i * 0.42, 0]}><boxGeometry args={[1.6, 0.36, 1.6]} /><meshStandardMaterial color={i % 2 ? C.yes : '#e0634f'} /></mesh>
      ))}
      <mesh position={[0, 4.4, 0]}><boxGeometry args={[2, 0.03, 2]} /><meshBasicMaterial color={C.ink} /></mesh>
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
    <group position={[0, 1, 0]}>
      <mesh><boxGeometry args={[6, 0.04, 0.6]} /><meshStandardMaterial color={C.ink} /></mesh>
      <mesh position={[3, 0.8, 0]}><boxGeometry args={[0.04, 1.6, 0.6]} /><meshStandardMaterial color={C.yes} /></mesh>
      <mesh ref={o} position={[-3, 0.5, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color={C.no} transparent opacity={0.5} /></mesh>
      <mesh ref={f} position={[-3.8, 0.5, 0]}><boxGeometry args={[0.4, 1.5, 0.4]} /><meshStandardMaterial color={C.no} /></mesh>
    </group>
  );
}

function Coins() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { g.current?.children.forEach((c, i) => { c.rotation.y += dt * (0.6 + i * 0.1); }); });
  return (
    <group ref={g} position={[0, 2, 0]}>
      {[-1.6, 0, 1.6].map((x, i) => (
        <mesh key={i} position={[x, i === 1 ? 0.5 : 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.7, 0.7, 0.12, 48]} />
          <meshStandardMaterial color={i === 2 ? C.haze : C.brass} metalness={i === 2 ? 0 : 0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Bars({ vals }: { vals: { label: string; v: number; v2?: number }[] }) {
  const max = 320;
  return (
    <group position={[-(vals.length - 1) * 0.9, 0, 0]}>
      {vals.map((r, i) => (
        <group key={r.label} position={[i * 1.8, 0, 0]}>
          <Grow h={(r.v / max) * 4.5} color={r.v2 == null ? C.yes : C.yes} x={r.v2 == null ? 0 : -0.3} delay={i * 0.2} />
          {r.v2 != null && <Grow h={(r.v2 / max) * 4.5} color={C.no} x={0.3} delay={i * 0.2 + 0.1} />}
          <Html position={[0, -0.35, 0.4]} center><div style={{ font: '600 10px JetBrains Mono, monospace', color: C.ink, whiteSpace: 'nowrap', textAlign: 'center' }}>{r.label}<br />${r.v.toFixed(2)}</div></Html>
        </group>
      ))}
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
  return <mesh ref={m} position={[x, 0, 0]}><boxGeometry args={[0.5, 1, 0.5]} /><meshStandardMaterial color={color} /></mesh>;
}

function Urn() {
  return (
    <Float amp={0.25} speed={0.6}>
      <mesh position={[0, 1.6, 0]}><boxGeometry args={[2.4, 2.2, 2.4]} /><meshPhysicalMaterial color={C.paper} transmission={0.6} roughness={0.15} thickness={1} /></mesh>
      <mesh position={[0, 2.72, 0]}><boxGeometry args={[1.4, 0.04, 0.16]} /><meshBasicMaterial color={C.ink} /></mesh>
      <mesh position={[0.3, 3.4, 0]} rotation={[0, 0, 0.12]}><boxGeometry args={[1, 1.3, 0.02]} /><meshStandardMaterial color={C.yes} /></mesh>
    </Float>
  );
}

const NORMAL = [{ label: '2024', v: 165.11 }, { label: '2025', v: 36.2 }, { label: '2026', v: 72.52 }, { label: '2024–2026', v: 301.55 }];
const STRESSED = [{ label: '2024', v: 148.55 }, { label: '2025', v: 28.51 }, { label: '2026', v: 40.17 }, { label: '2024–2026', v: 229.94 }];
function Exhibit({ id }: { id: string }) {
  switch (id) {
    case 'open': return <Urn />;
    case 'types': return <Universe />;
    case 'buying': return <Stacks />;
    case 'trigger': return <FillWindow />;
    case 'results': return <Bars vals={NORMAL} />;
    case 'start': return <Bars vals={startChart} />;
    case 'stressed': return <Bars vals={STRESSED} />;
    case 'appendix': return <Coins />;
    default: return null;
  }
}

function TryMarker({ y = 0.25 }: { y?: number }) {
  const g = useRef<THREE.Group>(null); const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) g.current.rotation.y = t * 3;
    if (ring.current) { const p = (t * 0.9) % 1; ring.current.scale.setScalar(0.6 + p * 1.2); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p); }
  });
  return (
    <group position={[0, y, 0]}>
      <group ref={g}>
        <mesh position={[0.55, 0.1, 0]}><sphereGeometry args={[0.07, 12, 12]} /><meshBasicMaterial color={C.yes} /></mesh>
        <mesh position={[-0.55, -0.1, 0]}><sphereGeometry args={[0.05, 12, 12]} /><meshBasicMaterial color={C.brass} /></mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.24, 0]}><ringGeometry args={[0.4, 0.46, 40]} /><meshBasicMaterial color={C.brass} transparent /></mesh>
    </group>
  );
}

const TX = (t: number, d: number) => -8 + (t / d) * 16;
const LANE = (i: number) => (i - 1) * 2.6;
function Replay({ snap, selected, time, events, duration }: { snap: SimulationSnapshot | null; selected: string; time: number; events: SimulationEvent[]; duration: number }) {
  const X = (t: number) => TX(t, duration);
  const fills = events.filter((e) => e.type === 'fill' && e.time <= time);
  const label = (txt: string, color = C.ink, w = 600, size = 9) => <div style={{ font: `${w} ${size}px JetBrains Mono, monospace`, letterSpacing: '.12em', color, whiteSpace: 'nowrap' }}>{txt}</div>;
  return (
    <group>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[19, 10]} /><meshStandardMaterial color={C.haze} /></mesh>
      {timelineMilestones.map((m) => (
        <group key={m.label} position={[X(m.time), 0, 0]}>
          <mesh position={[0, 0.005, 0]}><boxGeometry args={[0.02, 0.01, 7]} /><meshBasicMaterial color={C.ink} transparent opacity={0.25} /></mesh>
          <Html position={[0, 0, 4]} center>{label(m.label.toUpperCase(), C.ink, 600, 9)}</Html>
        </group>
      ))}
      {marketWindows.map((w, i) => {
        const col = w.side === 'YES' ? C.yes : C.no; const z = LANE(i); const sel = w.name === selected;
        const bx = X(w.opening), ex = X(w.close), sx = X(w.settlement);
        const doneB = Math.max(0, Math.min(time, w.close) - w.opening), doneH = Math.max(0, Math.min(time, w.settlement) - w.close);
        const h = snap?.holdings.find((k) => k.market === w.name);
        const settled = time >= w.settlement;
        const action = marketAction(snap, time, w.name);
        let cum = 0;
        return (
          <group key={w.name} position={[0, 0, z]}>
            <Html position={[Math.max(-6.6, Math.min(6.6, X(Math.min(time, w.settlement)))), 1.85, 0]} center zIndexRange={[12, 11]}>
              <div role="status" data-testid={`popup-${w.name.split(' ')[0].toLowerCase()}`} style={{ opacity: action ? 1 : 0, transition: 'opacity 180ms', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', border: `1px solid ${col}55`, borderRadius: 4, background: '#fbf6ed', color: C.ink, boxShadow: '0 4px 15px #1c243812', font: '500 12px Bricolage Grotesque, sans-serif' }}>
                  {action?.trying && <span className="timeline-trying-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />}
                  {action?.text}
                </div>
                <div style={{ width: 1, height: 18, background: `${col}88`, margin: '0 auto' }} />
              </div>
            </Html>
            <mesh position={[(bx + ex) / 2, 0.04, 0]}><boxGeometry args={[ex - bx, 0.06, sel ? 0.9 : 0.7]} /><meshStandardMaterial color={col} transparent opacity={0.22} /></mesh>
            {doneB > 0 && <mesh position={[bx + X(doneB) / 2 + 4, 0.08, 0]}><boxGeometry args={[X(doneB) + 8, 0.07, 0.72]} /><meshStandardMaterial color={col} transparent opacity={0.55} /></mesh>}
            <mesh position={[(ex + sx) / 2, 0.03, 0]}><boxGeometry args={[sx - ex, 0.03, 0.18]} /><meshStandardMaterial color={C.ink} transparent opacity={0.25} /></mesh>
            {doneH > 0 && <mesh position={[ex + (X(doneH) + 8) / 2, 0.05, 0]}><boxGeometry args={[X(doneH) + 8, 0.05, 0.2]} /><meshStandardMaterial color={C.ink} /></mesh>}
            <mesh position={[ex, 0.6, 0]}><boxGeometry args={[0.05, 1.2, 0.9]} /><meshStandardMaterial color={C.ink} /></mesh>
            <Html position={[ex, 1.35, 0]} center>{label('VOTE / CLOSE', C.ink, 600, 8)}</Html>
            <group position={[sx, 0, 0]}>
              <mesh position={[0, settled ? 0.35 : 0.06, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.32, 0.32, settled ? 0.1 : 0.04, 32]} /><meshStandardMaterial color={C.brass} metalness={settled ? 0.7 : 0} roughness={0.3} transparent opacity={settled ? 1 : 0.4} /></mesh>
              <Html position={[0, 0.9, 0]} center>{label(settled ? `SETTLED $${w.wins ? (h?.shares ?? 0) : 0}` : 'SETTLES', settled ? C.brass : C.ink, 700, 8)}</Html>
            </group>
            <Html position={[bx - 0.2, 0.15, 0]} center><div style={{ transform: 'translateX(-55%)', font: `${sel ? 700 : 600} 11px Bricolage Grotesque, sans-serif`, color: col, whiteSpace: 'nowrap' }}>{w.side} on {w.name.replace(' wins', '')}</div></Html>
            {fills.filter((e) => e.market === w.name).map((e, k) => {
              cum += e.quantity; const ht = Math.max(0.04, (cum / 100) * 2.4);
              return <mesh key={k} position={[X(e.time), ht / 2 + 0.1, 0]}><boxGeometry args={[0.09, ht, 0.4]} /><meshStandardMaterial color={col} /></mesh>;
            })}
            {(snap?.orders ?? []).filter((o) => o.market === w.name && o.status === 'expired' && o.quantity === o.remaining).map((o) => (
              <mesh key={o.id} position={[X(o.endedAt ?? o.submittedAt + 30), 0.2, 0]}><boxGeometry args={[0.18, 0.18, 0.18]} /><meshStandardMaterial color={C.ink} wireframe transparent opacity={0.4} /></mesh>
            ))}
            {(snap?.orders ?? []).filter((o) => o.market === w.name && o.status === 'live').map((o) => (
              <group key={o.id} position={[X(time), 0, 0]}><TryMarker y={0.3} /></group>
            ))}
          </group>
        );
      })}
      <group position={[X(time), 0, 0]}>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[0.04, 2.4, 7]} /><meshBasicMaterial color={C.yes} transparent opacity={0.12} /></mesh>
        <mesh position={[0, 1.2, 3.5]}><boxGeometry args={[0.05, 2.4, 0.05]} /><meshBasicMaterial color={C.yes} /></mesh>
        <Html position={[0, 2.7, 3.5]} center>{label(storyDate(time).toUpperCase(), C.yes, 700, 11)}</Html>
      </group>
    </group>
  );
}

export default function Scene({ index, snap, selected, time, events, duration }: { index: number; snap: SimulationSnapshot | null; selected: string; time: number; events: SimulationEvent[]; duration: number }) {
  const replay = chapters[index]?.id === 'replay';
  const replayIdx = chapters.findIndex((c) => c.id === 'replay');
  return (
    <div className="absolute inset-0">
    <Canvas camera={{ position: [-4, 3, 11], fov: 42 }} dpr={[1, 1.8]} shadows={false}>
      <color attach="background" args={[C.paper]} />
      <fog attach="fog" args={[C.paper, replay ? 35 : 12, replay ? 65 : 34]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.4} color="#fff3df" />
      <directionalLight position={[-8, 4, -4]} intensity={0.4} color="#9fc7cc" />
      <Rig index={index} replay={replay} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[chapters.length * SPACING / 2, -0.05, 0]}>
        <planeGeometry args={[chapters.length * SPACING + 60, 60]} />
        <meshStandardMaterial color="#e6dac4" />
      </mesh>
      {!replay && <mesh position={[chapters.length * SPACING / 2, 0, 3.2]}><boxGeometry args={[chapters.length * SPACING + 20, 0.04, 0.05]} /><meshBasicMaterial color={C.ink} /></mesh>}
      {!replay && chapters.map((c, i) => (
        <group key={c.id} position={[stationX(i) + 1.5, 0, 0]}>
          <mesh position={[0, 0.02, 3.2]}><cylinderGeometry args={[0.12, 0.12, 0.05, 24]} /><meshBasicMaterial color={i === index ? C.yes : C.ink} /></mesh>
          {Math.abs(i - index) <= 2 && <Exhibit id={c.id} />}
        </group>
      ))}
      {Math.abs(replayIdx - index) <= 1 && <group position={[stationX(replayIdx), 0, 0]}><Replay snap={snap} selected={selected} time={time} events={events} duration={duration} /></group>}
    </Canvas>
    </div>
  );
}
