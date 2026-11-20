<<<<<<< HEAD
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/pose", tags=["pose"])

=======
"""POST /pose using scikit-learn's NearestNeighbors.

The frontend sends the mannequin's 14 joint positions in LSP order. They are normalized
like the data in Supabase (hip midpoint = origin, neck-to-hip-midpoint = 1 unit, y up),
turned into features, and matched against every skeleton in the image_skeletons view.

Save as routes/pose.py (replacing the numpy version). Needs: pip install scikit-learn numpy
"""
import threading

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sklearn.metrics import pairwise_distances
from sklearn.neighbors import NearestNeighbors
from supabase import Client

from database import get_supabase, public_url

router = APIRouter(prefix="/pose", tags=["pose"])

# --- settings -----------------------------------------------------------------------------
MODE = "hybrid"   # "coords" (joint positions), "directions" (bone angles) or "hybrid" (both)
ALPHA = 0.5       # hybrid only: weight of the positions (1 - ALPHA goes to the bone angles)
MIRROR = False    # True also searches left-right flipped copies; results then say "mirrored"
PAGE = 1000       # Supabase returns at most 1000 rows per request

# Must match the order the frontend sends pose-export.jsx and the dataset
JOINT_NAMES = [
    "right_ankle", "right_knee", "right_hip", "left_hip", "left_knee", "left_ankle",
    "right_wrist", "right_elbow", "right_shoulder", "left_shoulder", "left_elbow", "left_wrist",
    "neck", "head_top",
]
IDX = {name: i for i, name in enumerate(JOINT_NAMES)}
R_HIP, L_HIP, NECK = IDX["right_hip"], IDX["left_hip"], IDX["neck"]

# child -> parent, the same tree as the mannequin
TREE = {
    "head_top": "neck", "right_shoulder": "neck", "left_shoulder": "neck",
    "right_elbow": "right_shoulder", "right_wrist": "right_elbow",
    "left_elbow": "left_shoulder", "left_wrist": "left_elbow",
    "right_hip": "neck", "left_hip": "neck",
    "right_knee": "right_hip", "right_ankle": "right_knee",
    "left_knee": "left_hip", "left_ankle": "left_knee",
}
BONES = list(TREE)
MIRROR_ORDER = [5, 4, 3, 2, 1, 0, 11, 10, 9, 8, 7, 6, 12, 13]   # swaps every left joint with its right one

>>>>>>> 38c0133 (Implement backend KNN and display images on skeleton movement)

class Pose(BaseModel):
    # 14 joints in LSP order, mannequin model space (y up)
    joints: list[tuple[float, float, float]] = Field(min_length=14, max_length=14)
<<<<<<< HEAD


@router.post("")
async def receive_pose(pose: Pose):
    return {"status": "ok", "joints": pose.joints}
=======
    top: int = Field(6, ge=1, le=24)


# Features Here
def normalize(X: np.ndarray) -> np.ndarray:
    """(N, 14, 2) -> hip-centered, torso length 1. Raises ValueError for a degenerate pose."""
    hip = (X[:, R_HIP] + X[:, L_HIP]) / 2
    scale = np.linalg.norm(X[:, NECK] - hip, axis=1)
    if (scale < 1e-6).any():
        raise ValueError("neck is on the hip midpoint, cannot normalize")
    return (X - hip[:, None, :]) / scale[:, None, None]


def coords(X: np.ndarray) -> np.ndarray:
    return X.reshape(len(X), -1) #28 nums


def directions(X: np.ndarray) -> np.ndarray:
    v = np.stack([X[:, IDX[c]] - X[:, IDX[TREE[c]]] for c in BONES], axis=1)
    v = v / (np.linalg.norm(v, axis=2, keepdims=True) + 1e-9)
    return v.reshape(len(X), -1) #26 nums


def block_scale(F: np.ndarray) -> float:
    """Typical size of a feature block, so two blocks can be mixed on equal footing."""
    return float(np.sqrt(((F - F.mean(0)) ** 2).sum(1).mean()))


class PoseIndex:
    def __init__(self, names: list[str], poses: np.ndarray):
        db = np.concatenate([poses, poses[:, MIRROR_ORDER] * np.array([-1.0, 1.0])]) if MIRROR else poses
        self.names, self.n = names, len(poses)
        self._sc, self._sd = block_scale(coords(db)), block_scale(directions(db))
        features = self.features(db)
        self.nn = NearestNeighbors(algorithm="brute", metric="euclidean").fit(features)
        # distance between two unrelated poses, used to turn a distance into a 0-100 display score
        sample = features[:: max(1, len(features) // 200)]
        self.typical = float(np.median(pairwise_distances(sample, features)))

    def features(self, X: np.ndarray) -> np.ndarray:
        if MODE == "coords":
            return coords(X)
        if MODE == "directions":
            return directions(X)
        return np.hstack([np.sqrt(ALPHA) * coords(X) / self._sc,
                          np.sqrt(1 - ALPHA) * directions(X) / self._sd])

    def search(self, query: np.ndarray, k: int):
        """query: (14, 2) normalized joints. Returns (image, distance, mirrored) for the k closest."""
        k = min(k, self.nn.n_samples_fit_)
        dist, idx = self.nn.kneighbors(self.features(query[None]), n_neighbors=k)
        return [(self.names[i % self.n], float(d), bool(i >= self.n)) for i, d in zip(idx[0], dist[0])]


# loading (once)
_state: dict = {}
_lock = threading.Lock()


def fetch_poses(supabase: Client):
    rows, offset = [], 0
    while True:
        res = (
            supabase.table("image_skeletons")
            .select("image, joints")
            .order("image")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows += res.data
        if len(res.data) < PAGE:
            break
        offset += PAGE
    if not rows:
        raise HTTPException(status_code=503, detail="No skeletons found in image_skeletons")
    names = [r["image"] for r in rows]
    poses = np.array([[[r["joints"][j]["x"], r["joints"][j]["y"]] for j in JOINT_NAMES] for r in rows])
    return names, poses


def get_index(supabase: Client) -> PoseIndex:
    if "index" not in _state:
        with _lock:                       # two first requests at once should  NOT both load
            if "index" not in _state:
                _state["index"] = PoseIndex(*fetch_poses(supabase))
    return _state["index"]


# Route 
@router.post("")
def find_similar(body: Pose, supabase: Client = Depends(get_supabase)):
    points = np.array([j[:2] for j in body.joints], dtype=float)  # the dataset is 2D, so z is dropped
    try:
        query = normalize(points[None])[0]
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    index = get_index(supabase)
    found = index.search(query, body.top)

    matched = [name for name, _, _ in found]
    pairs = supabase.table("image_pairs").select("path, annotated_path").in_("path", matched).execute()
    annotated = {r["path"]: r["annotated_path"] for r in pairs.data}

    return {
        "matches": [
            {
                "image": name,
                "distance": round(d, 4),
                "score": round(100 * max(0.0, 1 - d / index.typical)),  # display number only
                "mirrored": mirrored,
                "url": public_url(supabase, "regular", name),
                "annotated_url": public_url(supabase, "annotated", annotated[name]) if annotated.get(name) else None,
            }
            for name, d, mirrored in found
        ]
    }
>>>>>>> 38c0133 (Implement backend KNN and display images on skeleton movement)
