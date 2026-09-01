from pydantic import BaseModel, EmailStr

from backend.app.models.entities import UserRole


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    branch_id: int | None = None
    is_active: bool
    business_name: str | None = None
    business_phone: str | None = None
    business_logo_url: str | None = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    branch_id: int | None = None


class UserSelfUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = None


class BusinessUpdate(BaseModel):
    business_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
