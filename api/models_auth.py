"""
Google OAuth Authentication Models
====================================
Models for Google OAuth 2.0 authentication
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth"""
    credential: str  # Google ID token
    
    @field_validator("credential")
    @classmethod
    def validate_credential(cls, v):
        if not v or len(v) < 100:
            raise ValueError("Invalid Google credential token")
        return v


class GoogleUserInfo(BaseModel):
    """Google user information from ID token"""
    google_id: str = Field(..., alias="sub")
    email: str
    name: str = Field(..., alias="name")
    picture: Optional[str] = None
    email_verified: bool = Field(default=False, alias="email_verified")
    
    class Config:
        populate_by_name = True


class AuthTokenResponse(BaseModel):
    """Authentication token response"""
    token: str
    user: dict
    is_new_user: bool = False
    
    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    """User profile update model"""
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    metabolism_type: Optional[str] = None
    goal: Optional[str] = None
    daily_water_goal: Optional[int] = None
    
    @field_validator("age")
    @classmethod
    def validate_age(cls, v):
        if v is not None and (v < 10 or v > 120):
            raise ValueError("Age must be between 10 and 120")
        return v
    
    @field_validator("height")
    @classmethod
    def validate_height(cls, v):
        if v is not None and (v < 50 or v > 300):
            raise ValueError("Height must be between 50 and 300 cm")
        return v
    
    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v):
        if v is not None and (v < 20 or v > 500):
            raise ValueError("Weight must be between 20 and 500 kg")
        return v
    
    @field_validator("daily_water_goal")
    @classmethod
    def validate_water_goal(cls, v):
        if v is not None and (v < 1 or v > 20):
            raise ValueError("Water goal must be between 1 and 20 glasses")
        return v
