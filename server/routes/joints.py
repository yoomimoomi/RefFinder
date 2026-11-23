from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from database import get_supabase

router = APIRouter(prefix="/joints", tags=["joints"])


@router.get("/{image}")
def get_joints(image: str, supabase: Client = Depends(get_supabase)):
    res = (
        supabase.table("image_skeletons")
        .select("joints")
        .eq("image", image)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="No joints for this image")
    return {"image": image, "joints": res.data[0]["joints"]}