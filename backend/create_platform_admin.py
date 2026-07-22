import getpass
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.core.security import hash_password


def _upsert_env_var(text: str, key: str, value: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    found = False
    for line in lines:
        if not line or line.lstrip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        k, _ = line.split("=", 1)
        if k.strip() == key:
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        if out and out[-1] != "":
            out.append("")
        out.append(f"{key}={value}")
    return "\n".join(out) + "\n"


def main() -> None:
    email = input("Platform admin email: ").strip()
    if not email:
        raise SystemExit("Email is required")

    password = getpass.getpass("Platform admin password: ")
    if not password:
        raise SystemExit("Password is required")

    password2 = getpass.getpass("Confirm password: ")
    if password2 != password:
        raise SystemExit("Passwords do not match")

    hashed = hash_password(password)

    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        current = env_path.read_text(encoding="utf-8")
    else:
        current = ""

    updated = current
    updated = _upsert_env_var(updated, "PLATFORM_ADMIN_EMAIL", email)
    updated = _upsert_env_var(updated, "PLATFORM_ADMIN_PASSWORD", hashed)

    env_path.write_text(updated, encoding="utf-8")

    print("Updated backend/.env with PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (hashed).")


if __name__ == "__main__":
    main()
