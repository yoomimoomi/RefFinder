from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from database import get_supabase, COLUMNS, public_url

router = APIRouter(prefix="/images", tags=["images"])


@router.get("")
def list_images(
    kind: Literal["regular", "annotated"] = "regular",
    limit: int = Query(20, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
):
    column = COLUMNS[kind]
    res = (
        supabase.table("image_pairs")
        .select(column)
        .not_.is_(column, "null")
        .order(column)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {
        "images": [
            {"path": row[column], "url": public_url(supabase, kind, row[column])}
            for row in res.data
        ]
    }


@router.get("/pair/{path:path}")
def get_pair(path: str, supabase: Client = Depends(get_supabase)):
    res = supabase.table("image_pairs").select("*").eq("path", path).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Image not found")
    row = res.data[0]
    return {
        "regular_url": public_url(supabase, "regular", row["path"]),
        "annotated_url": (
            public_url(supabase, "annotated", row["annotated_path"])
            if row["annotated_path"] else None
        ),
    }