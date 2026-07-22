from backend.app.core.db import engine, SessionLocal
from backend.app.models.base import Base
from backend.app.models import entities  # noqa: F401
from backend.app.initial_data import seed


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
