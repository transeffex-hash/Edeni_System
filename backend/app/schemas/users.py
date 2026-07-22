from pydantic import BaseModel, EmailStr

from backend.app.models.entities import UserRole


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
