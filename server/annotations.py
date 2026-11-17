import csv

from scipy.io import loadmat

JOINT_NAMES = [
    "right_ankle", "right_knee", "right_hip", "left_hip", "left_knee", "left_ankle",
    "right_wrist", "right_elbow", "right_shoulder", "left_shoulder", "left_elbow", "left_wrist",
    "neck", "head_top",
]

joints = loadmat("joints.mat")["joints"].transpose(2, 1, 0)  # (2000, 14, 3)

with open("joints.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["image"] + [f"{name}_{c}" for name in JOINT_NAMES for c in ("x", "y", "occluded")])
    for i, pose in enumerate(joints):
        row = [f"im{i + 1:04d}.jpg"]
        for x, y, flag in pose:
            row += [f"{x:.2f}", f"{y:.2f}", int(flag)]
        writer.writerow(row)

print(f"Wrote {len(joints)} rows to joints.csv")
