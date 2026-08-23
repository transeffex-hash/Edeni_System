from pydantic import BaseModel


class BranchCreate(BaseModel):
    name: str


class BranchOut(BaseModel):
    id: int
    business_id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True
