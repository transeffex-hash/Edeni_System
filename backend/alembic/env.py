from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure the repo root is importable so `import backend...` works.
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.core.config import settings
from backend.app.models.base import Base
from backend.app.models import entities  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    url = os.environ.get("DATABASE_URL") or getattr(settings, "database_url", None)
    if not url:
        raise RuntimeError("DATABASE_URL is not set")

    # Ensure Alembic uses psycopg3 (not psycopg2) so SSL handling matches our backend deps.
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]

    # Supabase with `sslmode=verify-full` may require an explicit CA bundle.
    # Prefer the repo-checked-in Supabase CA cert if present, otherwise fall back to certifi.
    if "sslmode=verify-full" in url:
        try:
            repo_ca = REPO_ROOT / "backend" / "certs" / "supabase-root-2021.crt"
            if repo_ca.exists():
                ca_q = quote(str(repo_ca))
            else:
                import certifi

                ca_q = quote(certifi.where())

            if "sslrootcert=" in url:
                # Replace any existing sslrootcert (including `system`) with certifi bundle.
                parts = url.split("sslrootcert=", 1)
                before = parts[0]
                after = parts[1]
                after = after.split("&", 1)
                url = before + f"sslrootcert={ca_q}" + ("&" + after[1] if len(after) == 2 else "")
            else:
                url = url + ("&" if "?" in url else "?") + f"sslrootcert={ca_q}"
        except Exception:
            # If certifi isn't available, keep the URL as-is.
            pass

    return url


def run_migrations_offline() -> None:
    context.configure(url=get_url(), target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
