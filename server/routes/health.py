import httpx
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends
from supabase import Client
from database import get_supabase, BUCKETS, COLUMNS, public_url

router = APIRouter(prefix="/health", tags=["health"])

PAGE = 1000  # Supabase returns at most 1000 rows per request

#Dependencies

def fetch_all_rows(supabase: Client):
    rows, offset = [], 0
    while True:
        res = (
            supabase.table("image_pairs")
            .select("path, annotated_path")
            .order("path")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows += res.data
        if len(res.data) < PAGE:
            break
        offset += PAGE
    return rows


@router.get("")
def health_check():
    return {"status": "healthy"}


@router.get("/supabase")
def supabase_health(supabase: Client = Depends(get_supabase)):
    checks = {}

    for kind, bucket in BUCKETS.items():
        try:
            files = supabase.storage.from_(bucket).list("", {"limit": 1})
            checks[f"storage_{kind}"] = {"ok": True, "sample": [f["name"] for f in files]}
        except Exception as e:
            checks[f"storage_{kind}"] = {"ok": False, "error": str(e)}

    try:
        res = supabase.table("image_pairs").select("path").limit(1).execute()
        checks["image_pairs_view"] = {"ok": True, "rows": len(res.data)}
    except Exception as e:
        checks["image_pairs_view"] = {"ok": False, "error": str(e)}

    return {"all_ok": all(c["ok"] for c in checks.values()), "checks": checks}


@router.get("/images")
def check_images(check_urls: bool = True, supabase: Client = Depends(get_supabase)):
    rows = fetch_all_rows(supabase)

    summary = {
        "regular_rows": len(rows),
        "annotated_rows": sum(1 for r in rows if r["annotated_path"]),
        "missing_annotated": [r["path"] for r in rows if not r["annotated_path"]][:20],
    }
    if not check_urls:
        return summary

    targets = [
        (kind, r[column], public_url(supabase, kind, r[column]))
        for r in rows
        for kind, column in COLUMNS.items()
        if r[column]
    ]

    with httpx.Client(timeout=10) as client:
        def check(target):
            try:
                return target, client.head(target[2]).status_code
            except Exception as e:
                return target, str(e)

        with ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(check, targets))

    failed = [{"kind": t[0], "path": t[1], "status": s} for t, s in results if s != 200]
    summary.update({
        "urls_checked": len(results),
        "failed_count": len(failed),
        "failed_sample": failed[:20],
    })
    return summary