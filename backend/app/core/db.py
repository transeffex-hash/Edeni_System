from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import settings


def get_clean_database_url() -> str:
    url = settings.effective_database_url
    # Use psycopg3 (not psycopg2) to match our dependencies
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    if "sslrootcert=" in url:
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        qs.pop("sslrootcert", None)
        new_query = urllib.parse.urlencode(qs, doseq=True)
        parsed = parsed._replace(query=new_query)
        url = urllib.parse.urlunparse(parsed)
    return url

def _ensure_ssl_root_cert() -> None:
    url = settings.effective_database_url
    if "sslmode=verify-full" not in url:
        return

    try:
        import os
        from pathlib import Path

        # Resolve path to backend/certs dynamically relative to this file
        repo_ca = Path(__file__).resolve().parents[2] / "certs" / "supabase-root-2021.crt"
        if repo_ca.exists():
            os.environ["PGSSLROOTCERT"] = str(repo_ca)
            return

        import certifi
        os.environ["PGSSLROOTCERT"] = certifi.where()
    except Exception:
        return

_ensure_ssl_root_cert()
engine = create_engine(get_clean_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
