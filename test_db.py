from backend.app.core.db import SessionLocal
from backend.app.models.entities import User
try:
    db = SessionLocal()
    print("Users:", db.query(User).count())
except Exception as e:
    print("DB ERROR:", str(e))
