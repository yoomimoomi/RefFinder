from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/pose", tags=["pose"])


class Pose(BaseModel):
    # 14 joints in LSP order, mannequin model space (y up)
    joints: list[tuple[float, float, float]] = Field(min_length=14, max_length=14)


@router.post("")
async def receive_pose(pose: Pose):
    return {"status": "ok", "joints": pose.joints}
