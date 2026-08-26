"""Pydantic request/response models — shared."""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    role: Optional[str] = Field(
        default="executive",
        pattern="^(executive|asset_manager|om_manager|technician|performance_engineer|client_viewer)$",
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    message: str = Field(min_length=1, max_length=2000)


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class InsightRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    finding_code: Optional[str] = None
    session_id: Optional[str] = None
    auto: Optional[bool] = False


class SessionCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)


class InviteRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    role: str = Field(pattern="^(executive|asset_manager|om_manager|technician|performance_engineer|client_viewer|admin|owner|compliance)$")


class RoleUpdateRequest(BaseModel):
    role: str = Field(pattern="^(executive|asset_manager|om_manager|technician|performance_engineer|client_viewer|admin)$")


class RolesUpdateRequest(BaseModel):
    """Multi-role assignment: admin sets N roles for a user."""
    roles: List[str] = Field(min_length=1, max_length=7)


class WorkspaceSwitchRequest(BaseModel):
    role: str = Field(pattern="^(executive|asset_manager|om_manager|technician|performance_engineer|client_viewer|admin)$")


class ClientScopeRequest(BaseModel):
    """Admin sets which sites a client_viewer can see."""
    allowed_site_ids: List[str] = Field(default_factory=list, max_length=500)
    allowed_categories: List[str] = Field(default_factory=list, max_length=20)


class EvidenceMeta(BaseModel):
    site_id: Optional[str] = Field(default=None, max_length=20)
    alarm_id: Optional[str] = Field(default=None, max_length=20)
    work_order_id: Optional[str] = Field(default=None, max_length=20)
    note: Optional[str] = Field(default="", max_length=500)


class ScheduleRequest(BaseModel):
    frequency: str = Field(pattern="^(daily|weekly|monthly)$")
    recipients: List[EmailStr]
    enabled: bool = True


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    region: Optional[str] = Field(default=None, max_length=60)


class AlertCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    severity: str = Field(pattern="^(high|medium|low)$")
    confidence: int = Field(ge=0, le=100)
    portfolio_id: Optional[str] = None


class BrandingRequest(BaseModel):
    company_name: str = Field(default="", max_length=80)
    cover_note: str = Field(default="", max_length=500)
    logo_data_url: str = Field(default="", max_length=200000)


class SnapshotCreate(BaseModel):
    portfolio_id: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=120)


class ActionCreate(BaseModel):
    finding_code: str = Field(min_length=1, max_length=40)
    finding_title: str = Field(min_length=1, max_length=200)
    action_text: str = Field(min_length=1, max_length=500)
