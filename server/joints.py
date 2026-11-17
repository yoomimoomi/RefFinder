#Normalize annotations
#Step 1: Load the data into arrays
import numpy as np
import pandas as pd

JOINTS = [
    "right_ankle", "right_knee", "right_hip",
    "left_hip", "left_knee", "left_ankle",
    "right_wrist", "right_elbow", "right_shoulder",
    "left_shoulder", "left_elbow", "left_wrist",
    "neck", "head_top",
]

df = pd.read_csv("joints.csv") #joints.csv

xy_cols = [f"{j}_{a}" for j in JOINTS for a in ("x", "y")]
occ_cols = [f"{j}_occluded" for j in JOINTS]

coords = df[xy_cols].to_numpy(float).reshape(-1, 14, 2)   # (N, 14, 2)
visible = ~df[occ_cols].to_numpy(bool)                     # (N, 14), True = visible
image_ids = df["image"].to_numpy()


#Step 2: Normalize (move the origin, scale)
IDX = {j: i for i, j in enumerate(JOINTS)}

def normalize(coords):
    mid_hip = (coords[:, IDX["right_hip"]] + coords[:, IDX["left_hip"]]) / 2   # (N, 2)
    neck = coords[:, IDX["neck"]]
    torso_len = np.linalg.norm(neck - mid_hip, axis=1)                         # (N,)

    out = (coords - mid_hip[:, None, :]) / torso_len[:, None, None]
    out[:, :, 1] *= -1        # flip y so "up" is positive (more intuitive for a mannequin)
    return out, torso_len

norm, torso_len = normalize(coords)

#Step 3: Long format (CSV file has more rows than col) with body-part groups
BODY_GROUPS = {
    "right_leg": ["right_ankle", "right_knee", "right_hip"],
    "left_leg":  ["left_ankle", "left_knee", "left_hip"],
    "right_arm": ["right_wrist", "right_elbow", "right_shoulder"],
    "left_arm":  ["left_wrist", "left_elbow", "left_shoulder"],
    "torso_head": ["neck", "head_top"],
}
JOINT_TO_GROUP = {j: g for g, js in BODY_GROUPS.items() for j in js}

N = len(df)
df_norm = pd.DataFrame({
    "image": np.repeat(image_ids, 14),
    "joint": np.tile(JOINTS, N),
    "x": norm[:, :, 0].ravel(),
    "y": norm[:, :, 1].ravel(),
    "visible": visible.ravel(),
})
df_norm["group"] = df_norm["joint"].map(JOINT_TO_GROUP)

#Save the result to a NEW CSV file
df_norm.to_csv("joints_normalized.csv", index=False, float_format="%.4f") #display x and y values with 4 decimal places

