from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import settings


def _ensure_ssl_root_cert() -> None:
    url = settings.database_url
    if "sslmode=verify-full" not in url:
        return
    if "sslrootcert=" in url:
        return

    try:
        import os
        from pathlib import Path

        repo_ca = Path(__file__).resolve().parents[3] / "backend" / "certs" / "supabase-root-2021.crt"
        if repo_ca.exists():
            os.environ.setdefault("PGSSLROOTCERT", str(repo_ca))
            return

        import certifi

        os.environ.setdefault("PGSSLROOTCERT", certifi.where())
    except Exception:
        return

_ensure_ssl_root_cert()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
