"""
Pydantic models for the PO Review application
"""
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    invite_code: str


class User(BaseModel):
    id: str
    email: str
    name: str
    role: str


class SettingsModel(BaseModel):
    commission_fr: float = 24.0
    commission_es: float = 37.0
    commission_it: float = 26.0
    minimum_margin: float = 10.0
    operational_cost: float = 0.5
    shipping_cost: float = 1.0
    ups_cost_default: float = 1.0


class UploadResult(BaseModel):
    upload_id: str
    filename: str
    total_items: int
    needs_review: int
    approved: int
    timestamp: str
    summary: dict
