import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY in environment/.env")

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

#The Routes!

BUCKETS = {"regular": "rf-images", "annotated": "rf-images-annotated"}
COLUMNS = {"regular": "path", "annotated": "annotated_path"}


def get_supabase() -> Client:
    return supabase_client


def public_url(supabase: Client, kind: str, path: str) -> str:
    return supabase.storage.from_(BUCKETS[kind]).get_public_url(path)