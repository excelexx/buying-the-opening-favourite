import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { chapters, results, SPACING } from '@/deck';
import type { SimulationOrder, SimulationSnapshot } from '@/lib/simulation';
import { Html } from '@react-three/drei';

const C = {
  paper: '#efe6d6', ink: '#1c2438', yes: '#d8402a', no: '#1d6f78', brass: '#c08a2b', haze: '#d9cdb8',
};

export const stationX = (i: number) => i * SPACING;

function Rig({ index, replay }: { index: number; replay: boolean }) {
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  useFrame(({ camera, pointer, clock }, dt) => {
    const x = stationX(index);
    const sway = Math.sin(clock.elapsedTime * 0.25) * 0.4;
    if (replay) target.current.set(x - 4 + pointer.x * 1.2, 9 + pointer.y, 14);
    else target.current.set(x - 3.2 + pointer.x * 1.2 + sway, 3.2 + pointer.y * 0.6, 11);
    const k = 1 - Math.pow(0.04, dt);
    camera.position.lerp(target.current, k);
    look.current.lerp(new THREE.Vector3(x + (replay ? -3.5 : 1.5), replay ? 0 : 1.6, 0), k);
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

function Select() {
  const a = useRef<THREE.Mesh>(null); const b = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) a.current.position.y = 1.6 + Math.sin(t) * 0.3 + 0.6;
    if (b.current) b.current.position.y = 1.6 - 0.6 - Math.abs(Math.sin(t * 0.8)) * 0.4;
  });
  return (
    <group>
      <mesh position={[0, 1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 4]} />
        <meshStandardMaterial color={C.ink} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.6, 0]}><boxGeometry args={[7, 0.02, 0.02]} /><meshBasicMaterial color={C.ink} /></mesh>
      <mesh ref={a} position={[-1.5, 2, 0]}><sphereGeometry args={[0.4, 32, 32]} /><meshStandardMaterial color={C.yes} /></mesh>
      <mesh ref={b} position={[1.5, 1, 0]}><sphereGeometry args={[0.4, 32, 32]} /><meshStandardMaterial color={C.no} /></mesh>
      <mesh position={[0, 1.6, 0.6]}><sphereGeometry args={[0.25, 24, 24]} /><meshStandardMaterial color={C.haze} transparent opacity={0.6} /></mesh>
    </group>
  );
}

function Clock() {
  const hand = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (hand.current) hand.current.rotation.z -= dt * 0.8; });
  return (
    <group position={[0, 2, 0]}>
      <mesh><torusGeometry args={[2, 0.06, 16, 96]} /><meshStandardMaterial color={C.ink} /></mesh>
      {Array.from({ length: 6 }).map((_, i) => {
        const ang = Math.PI / 2 - (i / 6) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(ang) * 2, Math.sin(ang) * 2, 0]}><sphereGeometry args={[i === 0 || i === 3 ? 0.18 : 0.1, 16, 16]} /><meshStandardMaterial color={i === 0 ? C.yes : i === 3 ? C.no : C.brass} /></mesh>;
      })}
      <mesh rotation={[0, 0, 0]}><torusGeometry args={[2, 0.12, 16, 96, Math.PI * (5 / 3)]} /><meshStandardMaterial color={C.yes} transparent opacity={0.35} /></mesh>
      <group ref={hand}><mesh position={[0, 0.9, 0]}><boxGeometry args={[0.06, 1.8, 0.06]} /><meshStandardMaterial color={C.ink} /></mesh></group>
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

function Cash() {
  const r = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (r.current) { const s = 0.3 + (Math.sin(clock.elapsedTime * 0.7) + 1) * 0.3; r.current.scale.y = s; r.current.position.y = s * 2; } });
  return (
    <group>
      <mesh position={[-0.8, 2, 0]}><boxGeometry args={[1.2, 4, 1.2]} /><meshStandardMaterial color={C.brass} transparent opacity={0.35} /></mesh>
      <mesh ref={r} position={[-0.8, 1, 0]}><boxGeometry args={[1.25, 4, 1.25]} /><meshStandardMaterial color={C.ink} /></mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[1.2, 0.1 + i * 0.14, 0]}><cylinderGeometry args={[0.5, 0.5, 0.1, 40]} /><meshStandardMaterial color={C.brass} metalness={0.6} roughness={0.3} /></mesh>
      ))}
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

function Lanes() {
  const a = useRef<THREE.Group>(null); const b = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    a.current?.children.forEach((c, i) => { c.position.x = ((t * 1.6 + i * 1.2) % 7) - 3.5; });
    b.current?.children.forEach((c, i) => { c.position.x = ((t * 0.6 + i * 2.4) % 7) - 3.5; });
  });
  return (
    <group position={[0, 1.2, 0]}>
      <mesh position={[0, 0, 0.8]}><boxGeometry args={[7, 0.04, 0.8]} /><meshStandardMaterial color={C.no} transparent opacity={0.3} /></mesh>
      <mesh position={[0, 0, -0.8]}><boxGeometry args={[7, 0.04, 0.8]} /><meshStandardMaterial color={C.yes} transparent opacity={0.3} /></mesh>
      <group ref={a} position={[0, 0.3, 0.8]}>{Array.from({ length: 6 }).map((_, i) => <mesh key={i}><boxGeometry args={[0.4, 0.4, 0.4]} /><meshStandardMaterial color={C.no} /></mesh>)}</group>
      <group ref={b} position={[0, 0.3, -0.8]}>{Array.from({ length: 3 }).map((_, i) => <mesh key={i}><boxGeometry args={[0.4, 0.4, 0.4]} /><meshStandardMaterial color={C.yes} /></mesh>)}</group>
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

function Bars() {
  const max = 301.55;
  return (
    <group position={[-2.6, 0, 0]}>
      {results.map((r, i) => (
        <group key={r.label} position={[i * 1.8, 0, 0]}>
          <Grow h={(r.normal / max) * 4.5} color={C.yes} x={-0.3} delay={i * 0.2} />
          <Grow h={(r.stressed / max) * 4.5} color={C.no} x={0.3} delay={i * 0.2 + 0.1} />
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

function Monolith({ tint = C.ink }: { tint?: string }) {
  return (
    <Float>
      <mesh position={[0, 2, 0]}><boxGeometry args={[2.2, 3.4, 0.25]} /><meshStandardMaterial color={tint} roughness={0.4} /></mesh>
      <mesh position={[0, 2, 0.14]}><boxGeometry args={[1.7, 0.04, 0.02]} /><meshBasicMaterial color={C.paper} /></mesh>
    </Float>
  );
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

function Exhibit({ id }: { id: string }) {
  switch (id) {
    case 'open': return <Urn />;
    case 'universe': return <Universe />;
    case 'select': return <Select />;
    case 'clock': return <Clock />;
    case 'size': return <Stacks />;
    case 'cash': return <Cash />;
    case 'fill': return <FillWindow />;
    case 'stress': return <Lanes />;
    case 'hold': return <Coins />;
    case 'results': return <Bars />;
    case 'alice': return <group><group position={[-1.3, 0, 0]}><Monolith tint={C.yes} /></group><group position={[1.3, 0, 0]}><Monolith tint={C.no} /></group></group>;
    case 'replay': return null;
    default: return <Monolith tint={id === 'limits' ? C.haze : C.ink} />;
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

function Replay({ snap, selected, time }: { snap: SimulationSnapshot | null; selected: string; time: number }) {
  const markets = useMemo(() => {
    if (!snap) return [] as string[];
    const s = new Set<string>(); snap.orders.forEach((o) => s.add(o.market)); snap.holdings.filter((h) => h.shares > 0).forEach((h) => s.add(h.market));
    const others = Array.from(s).filter((m) => m !== selected).slice(0, 8);
    const all = [selected, ...others];
    return all;
  }, [snap, selected]);
  if (!snap) return null;
  const lane = (m: string) => (markets.indexOf(m) - (markets.length - 1) / 2) * 1.15;
  const latest = new Map<string, SimulationOrder>();
  snap.orders.forEach((o) => { if (!markets.includes(o.market)) return; const p = latest.get(o.market); if (!p || o.submittedAt >= p.submittedAt) latest.set(o.market, o); });
  return (
    <group>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[18, 13]} /><meshStandardMaterial color={C.haze} /></mesh>
      <mesh position={[0, 0.6, (markets.length / 2) * 1.15 + 0.2]}><boxGeometry args={[0.04, 1.2, 0.04]} /><meshBasicMaterial color={C.yes} /></mesh>
      <Html position={[0, 1.3, (markets.length / 2) * 1.15 + 0.2]} center><div style={{ font: '600 9px JetBrains Mono, monospace', letterSpacing: '.15em', color: C.yes, whiteSpace: 'nowrap' }}>30s EXPIRY</div></Html>
      <Html position={[-7.2, 1.3, (markets.length / 2) * 1.15 + 0.2]} center><div style={{ font: '600 9px JetBrains Mono, monospace', letterSpacing: '.15em', color: C.ink, whiteSpace: 'nowrap' }}>ORDER SENT</div></Html>
      <Html position={[4.5, 3.6, (markets.length / 2) * 1.15 + 0.2]} center><div style={{ font: '600 9px JetBrains Mono, monospace', letterSpacing: '.15em', color: C.ink, whiteSpace: 'nowrap' }}>SHARES HELD</div></Html>
      {markets.map((m) => {
        const sel = m === selected;
        return (
          <group key={m} position={[0, 0, lane(m)]}>
            <mesh position={[0, 0.01, 0]}><boxGeometry args={[15, sel ? 0.03 : 0.02, sel ? 0.9 : 0.05]} /><meshBasicMaterial color={sel ? C.yes : C.ink} transparent opacity={sel ? 0.14 : 0.3} /></mesh>
            <Html position={[-8.4, 0.1, 0]} center><div style={{ font: `${sel ? 700 : 500} ${sel ? 12 : 10}px Bricolage Grotesque, sans-serif`, color: sel ? C.yes : C.ink, whiteSpace: 'nowrap', opacity: sel ? 1 : 0.7, textAlign: 'right', transform: 'translateX(-40%)' }}>{m}</div></Html>
          </group>
        );
      })}
      {Array.from(latest.values()).map((o) => {
        const age = time - o.submittedAt;
        const fade = o.status === 'live' ? 1 : Math.max(0, 1 - (time - o.submittedAt - Math.min(age, 30)) / 4);
        if (o.status !== 'live' && age > 34) return null;
        const x = -7 + Math.min(age, 30) / 30 * 7;
        const live = o.status === 'live'; const filled = o.quantity - o.remaining;
        const col = o.side === 'YES' ? C.yes : C.no;
        const expiredEmpty = o.status === 'expired' && filled === 0;
        return (
          <group key={o.id} position={[x, 0, lane(o.market)]}>
            <mesh position={[0, 0.25, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color={expiredEmpty ? C.haze : col} transparent opacity={(live ? 0.3 : o.status === 'expired' ? 0.25 : 0.95) * fade} wireframe={expiredEmpty} /></mesh>
            {filled > 0 && <mesh position={[0, (filled / o.quantity) * 0.25, 0]} scale={[1, Math.max(0.01, filled / o.quantity), 1]}><boxGeometry args={[0.44, 0.5, 0.44]} /><meshStandardMaterial color={col} transparent opacity={fade} /></mesh>}
            {live && <TryMarker />}
            {(live || o.market === selected) && fade > 0.2 && (
              <Html position={[0, 0.85, 0]} center>
                <div style={{ font: '600 9px JetBrains Mono, monospace', whiteSpace: 'nowrap', padding: '2px 5px', background: live ? 'rgba(192,138,43,.92)' : o.status === 'filled' ? C.no : expiredEmpty ? '#8a8578' : C.yes, color: C.paper, opacity: fade }}>
                  {live ? `TRYING ${filled}/${o.quantity} · ${Math.max(0, Math.ceil(30 - age))}s` : o.status === 'filled' ? `FILLED ${o.quantity}` : expiredEmpty ? 'EXPIRED · 0 BOUGHT' : `PARTIAL ${filled}/${o.quantity}`}
                </div>
              </Html>
            )}
          </group>
        );
      })}
      {snap.holdings.filter((h) => markets.includes(h.market)).map((h) => {
        const ht = Math.max(0.02, h.shares / 100 * 3);
        return (
          <group key={h.market + h.side} position={[4.5, 0, lane(h.market)]}>
            <mesh position={[0, ht / 2, 0]}>
              <boxGeometry args={[0.7, ht, 0.7]} />
              <meshStandardMaterial color={h.settled ? C.brass : h.side === 'YES' ? C.yes : C.no} metalness={h.settled ? 0.6 : 0} />
            </mesh>
            {h.shares > 0 && <Html position={[0.7, ht + 0.1, 0]} center><div style={{ font: '600 10px JetBrains Mono, monospace', color: C.ink, whiteSpace: 'nowrap' }}>{h.shares}{h.settled ? ' settled' : ''}</div></Html>}
          </group>
        );
      })}
    </group>
  );
}

export default function Scene({ index, snap, selected, time }: { index: number; snap: SimulationSnapshot | null; selected: string; time: number }) {
  const replay = chapters[index]?.id === 'replay';
  const replayIdx = chapters.findIndex((c) => c.id === 'replay');
  return (
    <Canvas camera={{ position: [-4, 3, 11], fov: 42 }} dpr={[1, 1.8]} shadows={false}>
      <color attach="background" args={[C.paper]} />
      <fog attach="fog" args={[C.paper, 12, 34]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.4} color="#fff3df" />
      <directionalLight position={[-8, 4, -4]} intensity={0.4} color="#9fc7cc" />
      <Rig index={index} replay={replay} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[chapters.length * SPACING / 2, -0.05, 0]}>
        <planeGeometry args={[chapters.length * SPACING + 60, 60]} />
        <meshStandardMaterial color="#e6dac4" />
      </mesh>
      <mesh position={[chapters.length * SPACING / 2, 0, 3.2]}><boxGeometry args={[chapters.length * SPACING + 20, 0.04, 0.05]} /><meshBasicMaterial color={C.ink} /></mesh>
      {chapters.map((c, i) => (
        <group key={c.id} position={[stationX(i) + 1.5, 0, 0]}>
          <mesh position={[0, 0.02, 3.2]}><cylinderGeometry args={[0.12, 0.12, 0.05, 24]} /><meshBasicMaterial color={i === index ? C.yes : C.ink} /></mesh>
          {Math.abs(i - index) <= 2 && <Exhibit id={c.id} />}
        </group>
      ))}
      {Math.abs(replayIdx - index) <= 1 && <group position={[stationX(replayIdx), 0, 0]}><Replay snap={snap} selected={selected} time={time} /></group>}
    </Canvas>
  );
}
