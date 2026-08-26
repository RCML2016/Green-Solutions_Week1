"""Role-based access control constants + helpers.

MVP roles (4 + admin):
  - executive       (read-only viewer, executive dashboards)
  - asset_manager   (full business ops, current dashboard)
  - om_manager      (alarms, work orders, team, SLAs)
  - technician      (assigned work, AI troubleshooting, mobile-first)
  - admin           (system administrator, full access)

Legacy roles (still tolerated for existing accounts): user, owner, compliance.
Any legacy `user` role is auto-migrated to `executive` on startup.
"""
from fastapi import Depends, HTTPException
from deps import get_current_user

MVP_ROLES = (
    "executive",
    "asset_manager",
    "om_manager",
    "technician",
    "performance_engineer",
    "client_viewer",
    "admin",
)
LEGACY_ROLES = ("user", "owner", "compliance")  # accepted but not offered on register
ALL_ROLES = MVP_ROLES + LEGACY_ROLES

# Landing page routes per role — served by the frontend
ROLE_LANDING = {
    "executive": "/overview",
    "asset_manager": "/dashboard",
    "om_manager": "/operations",
    "technician": "/my-work",
    "performance_engineer": "/performance",
    "client_viewer": "/client-portal",
    "admin": "/admin",
    # Legacy fallbacks
    "user": "/overview",
    "owner": "/dashboard",
    "compliance": "/reports",
}


def role_required(*roles: str):
    """Dependency factory: allow request only if user's role is in `roles`.
    Admin is ALWAYS allowed (super-role)."""
    allowed = set(roles) | {"admin"}

    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of: {', '.join(sorted(allowed))}",
            )
        return user

    return _guard
