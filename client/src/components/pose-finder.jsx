import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { Search, RotateCcw, SlidersHorizontal, Sparkles, Move3d } from 'lucide-react'

const resultImages = [
  { src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80', label: 'Editorial stance', score: '98%' },
  { src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80', label: 'Relaxed portrait', score: '94%' },
  { src: 'https://images.unsplash.com/photo-1539579514369-3d7d1ebd3cbb?auto=format&fit=crop&w=700&q=80', label: 'Street pose', score: '91%' },
  { src: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80', label: 'Studio reference', score: '88%' },
  { src: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=80', label: 'Fashion motion', score: '84%' },
  { src: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80', label: 'Seated balance', score: '81%' },
]

const joints = {
  head: [0, 3.35, 0], neck: [0, 2.85, 0], shoulderL: [-0.72, 2.72, 0], elbowL: [-1.35, 2.18, 0], handL: [-1.9, 1.72, 0], shoulderR: [0.72, 2.72, 0], elbowR: [1.35, 2.18, 0], handR: [1.9, 1.72, 0], hipL: [-0.42, 1.45, 0], kneeL: [-0.66, 0.48, 0], footL: [-0.88, -0.55, 0], hipR: [0.42, 1.45, 0], kneeR: [0.66, 0.48, 0], footR: [0.88, -0.55, 0],
}

function Bone({ from, to, color = '#f0e9df' }) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to)
  const direction = new THREE.Vector3().subVectors(end, start)
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  return <mesh position={midpoint} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())}><capsuleGeometry args={[0.105, direction.length() - 0.2, 8, 16]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>
}

function Joint({ position, active, onClick }) {
  return <mesh position={position} onClick={onClick}><sphereGeometry args={[active ? 0.16 : 0.12, 20, 20]} /><meshStandardMaterial color={active ? '#f4a261' : '#e9d9c8'} emissive={active ? '#7c3f24' : '#000000'} emissiveIntensity={active ? 0.35 : 0} /></mesh>
}

function Mannequin({ pose }) {
  const p = useMemo(() => {
    const values = Object.fromEntries(Object.entries(joints).map(([key, value]) => [key, [...value]]))
    if (pose === 1) { values.handL = [-1.75, 2.65, 0]; values.elbowL = [-1.25, 2.95, 0]; values.handR = [1.75, 2.65, 0]; values.elbowR = [1.25, 2.95, 0] }
    if (pose === 2) { values.handL = [-1.15, 0.85, 0]; values.elbowL = [-1.9, 1.35, 0]; values.handR = [1.15, 0.85, 0]; values.elbowR = [1.9, 1.35, 0] }
    return values
  }, [pose])
  const pairs = [['neck','shoulderL'],['shoulderL','elbowL'],['elbowL','handL'],['neck','shoulderR'],['shoulderR','elbowR'],['elbowR','handR'],['neck','hipL'],['neck','hipR'],['hipL','hipR'],['hipL','kneeL'],['kneeL','footL'],['hipR','kneeR'],['kneeR','footR']]
  return <group position={[0, -0.2, 0]}>
    <mesh position={p.head}><sphereGeometry args={[0.34, 24, 24]} /><meshStandardMaterial color="#f4eee8" roughness={0.7} /></mesh>
    {pairs.map(([a,b]) => <Bone key={`${a}-${b}`} from={p[a]} to={p[b]} />)}
    {Object.entries(p).map(([key, value]) => <Joint key={key} position={value} active={key === 'elbowL' || key === 'kneeR'} />)}
  </group>
}

function Scene({ pose }) {
  const { gl } = useThree(); gl.setClearColor('#1b1a18', 1)
  return <><PerspectiveCamera makeDefault position={[0, 1.5, 8.5]} fov={35} /><ambientLight intensity={2.2} /><directionalLight position={[3, 5, 6]} intensity={3.4} color="#fff4e8" /><pointLight position={[-4, 2, 2]} intensity={5} color="#e76f51" /><Mannequin pose={pose} /><OrbitControls enablePan={false} minDistance={6} maxDistance={11} target={[0,1.4,0]} /></>
}

export default function PoseFinder() {
  const [searched, setSearched] = useState(false)
  const [pose, setPose] = useState(0)
  const [query, setQuery] = useState('')
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Move3d size={18} /></div><span>POSEFINDER</span></div><nav><a className="active">Workspace</a><a>Library</a><a>About</a></nav><button className="icon-button" aria-label="Adjust settings"><SlidersHorizontal size={18} /></button></header>
    <section className="workspace-grid">
      <div className="model-panel"><div className="panel-head"><div><span className="label">POSE EDITOR</span><h2>Mannequin</h2></div><button className="reset" onClick={() => setPose(0)}><RotateCcw size={14} /> Reset</button></div><div className="canvas-wrap"><Canvas dpr={[1, 2]}><Scene pose={pose} /></Canvas><div className="canvas-note">DRAG TO ROTATE <span>•</span> CLICK JOINTS TO EDIT</div></div><div className="pose-controls"><span>PRESETS</span><button className={pose === 0 ? 'selected' : ''} onClick={() => setPose(0)}>Neutral</button><button className={pose === 1 ? 'selected' : ''} onClick={() => setPose(1)}>Raised</button><button className={pose === 2 ? 'selected' : ''} onClick={() => setPose(2)}>Open</button></div></div>
      <div className="results-panel"><div className="results-head"><div><span className="label">MATCHING REFERENCES</span><h2>{searched ? 'Your results' : 'Ready when you are'}</h2></div>{searched && <span className="result-count">06 MATCHES</span>}</div>{!searched ? <div className="empty-state"><div className="empty-lines"><i /><i /><i /><i /></div><p>Move the limbs into a pose<br />and search for similar images.</p><button className="search-button" onClick={() => setSearched(true)}><Search size={17} /> Find similar poses</button></div> : <div className="results-grid">{resultImages.map((image) => <article className="result-card" key={image.src}><div className="result-image"><img src={image.src} alt={image.label} /><span>{image.score}</span></div><p>{image.label}</p></article>)}</div>}</div>
    </section>
    <footer><span>POSEFINDER <b>© 2024</b></span></footer>
  </main>
}
