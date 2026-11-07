import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import mannequinUrl from '@/assets/mannequin.fbx?url'

// The FBX is a T-pose ~56 units tall; this maps it onto the scene's joint scale.
const FBX_SCALE = 0.0755, FBX_OFFSET_Y = -0.78
const fromFbx = ([x, y, z]) => [x * FBX_SCALE, y * FBX_SCALE + FBX_OFFSET_Y, z * FBX_SCALE]

const joints = {
  head: [0, 3.35, 0], neck: [0, 2.85, 0], shoulderL: [-0.72, 2.72, 0], elbowL: [-1.35, 2.18, 0], handL: [-1.9, 1.72, 0], shoulderR: [0.72, 2.72, 0], elbowR: [1.35, 2.18, 0], handR: [1.9, 1.72, 0], hipL: [-0.42, 1.45, 0], kneeL: [-0.66, 0.48, 0], footL: [-0.88, -0.55, 0], hipR: [0.42, 1.45, 0], kneeR: [0.66, 0.48, 0], footR: [0.88, -0.55, 0],
}

const pairs = [['neck','head'],['neck','shoulderL'],['shoulderL','elbowL'],['elbowL','handL'],['neck','shoulderR'],['shoulderR','elbowR'],['elbowR','handR'],['neck','hipL'],['neck','hipR'],['hipL','hipR'],['hipL','kneeL'],['kneeL','footL'],['hipR','kneeR'],['kneeR','footR']]

//declare parent child hierarchy
const PARENTS = { neck: null, head: 'neck', shoulderL: 'neck', elbowL: 'shoulderL', handL: 'elbowL', shoulderR: 'neck', elbowR: 'shoulderR', handR: 'elbowR', hipL: 'neck', hipR: 'neck', kneeL: 'hipL', footL: 'kneeL', kneeR: 'hipR', footR: 'kneeR' }
const JOINT_ORDER = Object.keys(PARENTS)
const JOINT_LABELS = { neck: 'Neck', head: 'Head', shoulderL: 'Shoulder L', elbowL: 'Elbow L', handL: 'Hand L', shoulderR: 'Shoulder R', elbowR: 'Elbow R', handR: 'Hand R', hipL: 'Hip L', hipR: 'Hip R', kneeL: 'Knee L', footL: 'Foot L', kneeR: 'Knee R', footR: 'Foot R' }

// Joint centers measured on the FBX mesh. `L` is the viewer's left (the model's r_* parts).
// The head pivots where it meets the neck.
const REST_JOINTS = Object.fromEntries(Object.entries({
  neck: [0, 47, 0], head: [0, 48, 0],
  shoulderL: [-6.5, 44, 0], elbowL: [-17, 42.6, 0], handL: [-26.5, 41.1, 0],
  shoulderR: [6.5, 44, 0], elbowR: [17, 42.6, 0], handR: [26.5, 41.1, 0],
  hipL: [-2.75, 26.5, 0], kneeL: [-2.75, 15, 0], footL: [-2.75, 3, 0],
  hipR: [2.75, 26.5, 0], kneeR: [2.75, 15, 0], footR: [2.75, 3, 0],
}).map(([key, value]) => [key, fromFbx(value)]))

const PART_BONES = { r_arm: ['shoulderL', 'elbowL', 'handL'], l_arm: ['shoulderR', 'elbowR', 'handR'], r_leg: ['hipL', 'kneeL', 'footL'], l_leg: ['hipR', 'kneeR', 'footR'], body: ['neck', 'head'] }

const PRESET_AIMS = ['shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR']

const DEG = Math.PI / 180
const ZERO = [0, 0, 0]
const vec = (p) => new THREE.Vector3(...p)

// The single child each limb joint aims at.
const CHILD = Object.fromEntries(JOINT_ORDER.filter((key) => PARENTS[key] && PARENTS[PARENTS[key]]).map((key) => [PARENTS[key], key]))

// Leaf joints have no child, so they aim at a point past the joint (rest pose, joint-local).
const TIPS = {
  head: vec(fromFbx([0, 52, 0])).sub(vec(REST_JOINTS.head)),
  handL: vec(REST_JOINTS.handL).sub(vec(REST_JOINTS.elbowL)).setLength(0.4),
  handR: vec(REST_JOINTS.handR).sub(vec(REST_JOINTS.elbowR)).setLength(0.4),
  footL: vec(fromFbx([-2.75, 1, 7])).sub(vec(REST_JOINTS.footL)),
  footR: vec(fromFbx([2.75, 1, 7])).sub(vec(REST_JOINTS.footR)),
}
const quatFromDeg = ([x, y, z] = ZERO) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG))
const degFromQuat = (q) => { const e = new THREE.Euler().setFromQuaternion(q); return [e.x / DEG, e.y / DEG, e.z / DEG] }

function localOffset(key) {
  const parent = PARENTS[key]
  return parent ? vec(REST_JOINTS[key]).sub(vec(REST_JOINTS[parent])) : vec(REST_JOINTS[key])
}

// Model-space matrix of every joint for a given set of local rotations.
function poseMatrices(rotations) {
  const matrices = {}
  for (const key of JOINT_ORDER) {
    const local = new THREE.Matrix4().compose(localOffset(key), quatFromDeg(rotations[key]), new THREE.Vector3(1, 1, 1))
    matrices[key] = PARENTS[key] ? matrices[PARENTS[key]].clone().multiply(local) : local
  }
  return matrices
}

const positionOf = (m) => new THREE.Vector3().setFromMatrixPosition(m)
const quaternionOf = (m) => { const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q }

function aimPoint(matrices, key) {
  return CHILD[key] ? positionOf(matrices[CHILD[key]]) : TIPS[key].clone().applyMatrix4(matrices[key])
}

// Rotate `key` so the direction from `key` to its aim point becomes `direction` (model space).
function aimJoint(rotations, key, direction) {
  const m = poseMatrices(rotations)
  const from = aimPoint(m, key).sub(positionOf(m[key])).normalize()
  const delta = new THREE.Quaternion().setFromUnitVectors(from, direction.clone().normalize())
  const parentQuat = PARENTS[key] ? quaternionOf(m[PARENTS[key]]) : new THREE.Quaternion()
  const local = parentQuat.invert().multiply(delta.multiply(quaternionOf(m[key])))
  return { ...rotations, [key]: degFromQuat(local) }
}

// PRESET ------------------------------------------------------------
function presetJoints(pose) {
  const values = Object.fromEntries(Object.entries(joints).map(([key, value]) => [key, [...value]]))
  if (pose === 1) { values.handL = [-1.75, 2.65, 0]; values.elbowL = [-1.25, 2.95, 0]; values.handR = [1.75, 2.65, 0]; values.elbowR = [1.25, 2.95, 0] }
  if (pose === 2) { values.handL = [-1.15, 0.85, 0]; values.elbowL = [-1.9, 1.35, 0]; values.handR = [1.15, 0.85, 0]; values.elbowR = [1.9, 1.35, 0] }
  return values
}

// eslint-disable-next-line react-refresh/only-export-components
export function presetRotations(pose) {
  const targets = presetJoints(pose)
  return PRESET_AIMS.reduce((rotations, key) => aimJoint(rotations, key, vec(targets[CHILD[key]]).sub(vec(targets[key]))), {})
}

function partSegments(part) {
  const bones = PART_BONES[part]
  return bones.map((key, i) => {
    const start = vec(REST_JOINTS[key])
    const end = i < bones.length - 1 ? vec(REST_JOINTS[bones[i + 1]]) : start.clone().add(TIPS[key])
    return { bone: JOINT_ORDER.indexOf(key), line: new THREE.Line3(start, end) }
  })
}

// Limbs blend between their two nearest bone segments; the body is split rigidly into torso and head.
function skinGeometry(geometry, part) {
  const position = geometry.attributes.position
  const skinIndex = new Uint16Array(position.count * 4), skinWeight = new Float32Array(position.count * 4)
  const v = new THREE.Vector3(), closest = new THREE.Vector3()
  const segments = part === 'body' ? null : partSegments(part)
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    if (!segments) {
      skinIndex[i * 4] = JOINT_ORDER.indexOf(v.y > REST_JOINTS.neck[1] ? 'head' : 'neck')
      skinWeight[i * 4] = 1
      continue
    }
    const [a, b] = segments
      .map(({ bone, line }) => ({ bone, d: line.closestPointToPoint(v, true, closest).distanceTo(v) }))
      .sort((x, y) => x.d - y.d)
    const wa = 1 / (a.d ** 4 + 1e-8), wb = 1 / (b.d ** 4 + 1e-8)
    skinIndex[i * 4] = a.bone; skinIndex[i * 4 + 1] = b.bone
    skinWeight[i * 4] = wa / (wa + wb); skinWeight[i * 4 + 1] = wb / (wa + wb)
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
}

function buildRig(fbx) {
  const bones = {}
  for (const key of JOINT_ORDER) {
    const bone = new THREE.Bone()
    bone.name = key
    bone.position.copy(localOffset(key))
    if (PARENTS[key]) bones[PARENTS[key]].add(bone)
    bones[key] = bone
  }
  const inverses = JOINT_ORDER.map((key) => new THREE.Matrix4().makeTranslation(vec(REST_JOINTS[key])).invert())
  const skeleton = new THREE.Skeleton(JOINT_ORDER.map((key) => bones[key]), inverses)
  const material = new THREE.MeshStandardMaterial({ color: '#f4eee8', roughness: 0.7 })
  const toScene = new THREE.Matrix4().makeTranslation(0, FBX_OFFSET_Y, 0).multiply(new THREE.Matrix4().makeScale(FBX_SCALE, FBX_SCALE, FBX_SCALE))
  const meshes = []
  fbx.updateMatrixWorld(true)
  fbx.traverse((object) => {
    if (!object.isMesh || !PART_BONES[object.name]) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld).applyMatrix4(toScene)
    skinGeometry(geometry, object.name)
    const mesh = new THREE.SkinnedMesh(geometry, material)
    mesh.frustumCulled = false
    mesh.bind(skeleton, new THREE.Matrix4())
    meshes.push(mesh)
  })
  return { root: bones.neck, bones, meshes }
}

function Bone({ from, to }) {
  const direction = new THREE.Vector3().subVectors(to, from)
  const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
  return <mesh position={midpoint} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())} renderOrder={1}><capsuleGeometry args={[0.035, Math.max(direction.length() - 0.07, 0.01), 6, 12]} /><meshStandardMaterial color="#a3968a" roughness={0.65} transparent opacity={0.85} depthTest={false} depthWrite={false} /></mesh>
}

function Joint({ position, active, ...handlers }) {
  return <mesh position={position} renderOrder={2} {...handlers}><sphereGeometry args={[active ? 0.1 : 0.07, 20, 20]} /><meshStandardMaterial color={active ? '#f4a261' : '#6f645a'} emissive={active ? '#7c3f24' : '#000000'} emissiveIntensity={active ? 0.35 : 0} transparent opacity={0.9} depthTest={false} depthWrite={false} /></mesh>
}

function Mannequin({ rotations, onRotationsChange, selected, onSelect }) {
  const fbx = useLoader(FBXLoader, mannequinUrl)
  const rig = useMemo(() => buildRig(fbx), [fbx])
  // The head's marker sits mid-head rather than on its pivot, which is right next to the neck.
  const positions = useMemo(() => {
    const matrices = poseMatrices(rotations)
    return Object.fromEntries(JOINT_ORDER.map((key) => [key, key === 'head' ? aimPoint(matrices, key) : positionOf(matrices[key])]))
  }, [rotations])
  const getState = useThree((state) => state.get)
  const setOrbit = (enabled) => { const { controls } = getState(); if (controls) controls.enabled = enabled }
  const group = useRef()
  const drag = useRef(null)

  useLayoutEffect(() => {
    for (const key of JOINT_ORDER) rig.bones[key].quaternion.copy(quatFromDeg(rotations[key]))
  }, [rig, rotations])

  const startDrag = (key) => (e) => {
    e.stopPropagation()
    onSelect(key)
    if (!PARENTS[key]) return
    e.target.setPointerCapture(e.pointerId)
    setOrbit(false)
    const jointWorld = group.current.localToWorld(positions[key].clone())
    drag.current = { key, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(getState().camera.getWorldDirection(new THREE.Vector3()), jointWorld) }
  }

  const moveDrag = (key) => (e) => {
    if (drag.current?.key !== key) return
    const hit = e.ray.intersectPlane(drag.current.plane, new THREE.Vector3())
    if (!hit) return
    const target = group.current.worldToLocal(hit)
    onRotationsChange((prev) => aimJoint(prev, key, target.clone().sub(positionOf(poseMatrices(prev)[key]))))
  }

  const endDrag = (e) => {
    if (!drag.current) return
    e.target.releasePointerCapture(e.pointerId)
    setOrbit(true)
    drag.current = null
  }

  return <group ref={group} position={[0, -0.2, 0]}>
    <primitive object={rig.root} />
    {rig.meshes.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)}
    {pairs.map(([a, b]) => <Bone key={`${a}-${b}`} from={positions[a]} to={positions[b]} />)}
    {JOINT_ORDER.map((key) => <Joint key={key} position={positions[key]} active={key === selected}
      onPointerDown={startDrag(key)} onPointerMove={moveDrag(key)} onPointerUp={endDrag}
      onPointerOver={() => { document.body.style.cursor = 'grab' }} onPointerOut={() => { document.body.style.cursor = '' }} />)}
  </group>
}

function Scene(props) {
  const { gl } = useThree(); gl.setClearColor('#1b1a18', 1)
  return <><PerspectiveCamera makeDefault position={[0, 1.5, 8.5]} fov={35} /><ambientLight intensity={2.2} /><directionalLight position={[3, 5, 6]} intensity={3.4} color="#fff4e8" /><pointLight position={[-4, 2, 2]} intensity={5} color="#e76f51" /><Suspense fallback={null}><Mannequin {...props} /></Suspense><OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={11} target={[0,1.4,0]} /></>
}

export function JointControls({ joint, rotations, onRotationsChange }) {
  if (!joint) return <div className="joint-controls"><p className="joint-empty">Select a joint to rotate</p></div>
  const rotation = rotations[joint] ?? ZERO
  const setRotation = (value) => onRotationsChange((prev) => ({ ...prev, [joint]: value }))
  return <div className="joint-controls">
    <div className="joint-controls-head"><span>ROTATE</span><b>{JOINT_LABELS[joint]}</b><button onClick={() => setRotation(ZERO)}>Reset</button></div>
    {['X', 'Y', 'Z'].map((axis, i) => <label key={axis}>
      <span>{axis}</span>
      <input type="range" min={-180} max={180} step={1} value={Math.round(rotation[i])} onChange={(e) => setRotation(rotation.map((value, j) => (j === i ? Number(e.target.value) : value)))} />
      <output>{Math.round(rotation[i])}°</output>
    </label>)}
  </div>
}

export default function Viewport({ rotations, onRotationsChange, selected, onSelect }) {
  return <div className="canvas-wrap">
    <Canvas dpr={[1, 2]}><Scene rotations={rotations} onRotationsChange={onRotationsChange} selected={selected} onSelect={onSelect} /></Canvas>
    <div className="canvas-note">DRAG TO ORBIT <span>•</span> DRAG JOINTS TO POSE</div>
  </div>
}
