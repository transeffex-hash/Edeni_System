from pydantic import BaseModel


class RegisterDeviceToken(BaseModel):
    token: str
