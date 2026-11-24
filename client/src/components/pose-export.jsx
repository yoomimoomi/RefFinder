import { poseJointPositions } from '@/components/viewport'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://ref-finder-server-flax.vercel.app'

// joint order. The mannequin's `L` joints are on the viewer's left, which is the person's right.
const JOINT_ORDER = ['footL', 'kneeL', 'hipL', 'hipR', 'kneeR', 'footR', 'handL', 'elbowL', 'shoulderL', 'shoulderR', 'elbowR', 'handR', 'neck', 'headTop']

export async function exportPose(rotations) {
  const points = poseJointPositions(rotations)
  const res = await fetch(`${API_URL}/pose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joints: JOINT_ORDER.map((key) => points[key]) }),
  })
  if (!res.ok) throw new Error(`Pose export failed: ${res.status}`)
  return res.json()
}
