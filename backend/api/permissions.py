from enum import Enum
from typing import List

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from api.models import ReviewMember


# === Enums ===
Role = ReviewMember.Role


class Permission(str, Enum):
    ACCESS_REVIEW = "access_review"
    MODIFY_REVIEW = "modify_review"
    ASSIGN = "assign"
    INVITE = "invite"
    ADD_DATA = "add_data"
    MODIFY_SCREENING_CRITERIA = "modify_screening_criteria"
    UPLOAD_FILES = "upload_files"
    MANAGE_DUPLICATES = "manage_duplicates"
    ASSIGN_LABEL = "assign_label"
    MODIFY_THEMES_CODES = "modify_themes_codes"
    MODIFY_REFERENCE = "modify_reference"
    MODIFY_KEYWORD = "modify_keyword"
    MODIFY_OPINION = "modify_opinion"
    MODIFY_NOTE = "modify_note"
    MODIFY_REASON = "modify_reason"


# === Permissions map ===
PERMISSIONS = {
    Permission.ACCESS_REVIEW: [
        Role.OWNER,
        Role.COLLABORATOR,
        Role.REVIEWER,
        Role.VIEWER,
    ],
    Permission.MODIFY_REVIEW: [Role.OWNER],
    Permission.ASSIGN: [Role.OWNER],
    Permission.INVITE: [Role.OWNER],
    Permission.MODIFY_SCREENING_CRITERIA: [Role.OWNER, Role.COLLABORATOR],
    Permission.UPLOAD_FILES: [Role.OWNER, Role.COLLABORATOR],
    Permission.MANAGE_DUPLICATES: [Role.OWNER, Role.COLLABORATOR],
    Permission.MODIFY_THEMES_CODES: [Role.OWNER, Role.COLLABORATOR],
    Permission.MODIFY_REFERENCE: [Role.OWNER, Role.COLLABORATOR, Role.REVIEWER],
    Permission.MODIFY_KEYWORD: [Role.OWNER, Role.COLLABORATOR, Role.REVIEWER],
    Permission.MODIFY_OPINION: [Role.OWNER, Role.COLLABORATOR, Role.REVIEWER],
    Permission.MODIFY_REASON: [Role.OWNER, Role.COLLABORATOR, Role.REVIEWER],
    Permission.MODIFY_NOTE: [Role.OWNER, Role.COLLABORATOR, Role.REVIEWER],
    Permission.ASSIGN_LABEL: [Role.OWNER, Role.COLLABORATOR, Role.REVIEWER],
    Permission.ADD_DATA: [Role.OWNER, Role.COLLABORATOR],
}


# === Helper functions ===
def get_user_role(user, review) -> Role | None:
    try:
        return Role(ReviewMember.objects.get(user=user, review=review).role)
    except ReviewMember.DoesNotExist:
        return None


def can(permission: Permission, user, review) -> bool:
    allowed_roles: List[Role] = PERMISSIONS.get(permission, [])
    role = get_user_role(user, review)
    return role in allowed_roles if role else False


def humanize_permission(permission: Permission) -> str:
    """
    Convert enum like 'modify_note' -> 'modify the note' for a nicer message.
    """
    s = permission.value.replace("_", " ")
    # Add 'the' for modify actions
    if s.startswith("modify "):
        s = s.replace("modify ", "modify the ")
    return s


def permission_denied_message(permission: Permission) -> str:
    """
    Return a human-readable PermissionDenied message.
    Example: "You cannot modify the note. Only Owner, Collaborator, Reviewer can perform this action."
    """
    allowed_roles = PERMISSIONS.get(permission, [])
    allowed_roles_str = ", ".join(role.value for role in allowed_roles)
    return f"You cannot {humanize_permission(permission)}. Only {allowed_roles_str} can perform this action."


def check_permission(permission: Permission, user, review):
    if not can(permission, user, review):
        raise PermissionDenied(permission_denied_message(permission))


class IsReviewOwner(BasePermission):
    """
    Only review owners can perform the action.
    """

    def has_object_permission(self, request, view, obj):
        return get_user_role(request.user, obj) == Role.OWNER
