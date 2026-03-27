from unittest.mock import MagicMock

import pytest
from rest_framework.exceptions import PermissionDenied


# ── Permission enum ────────────────────────────────────────────────────────────


class TestPermissionEnum:
    def test_all_expected_values_exist(self):
        from slrt_project.shared.permissions import Permission

        expected = {
            "ACCESS_REVIEW",
            "MODIFY_REVIEW",
            "ASSIGN",
            "INVITE",
            "ADD_DATA",
            "MODIFY_SCREENING_CRITERIA",
            "UPLOAD_FILES",
            "MANAGE_DUPLICATES",
            "ASSIGN_LABEL",
            "MODIFY_THEMES_CODES",
            "MODIFY_REFERENCE",
            "MODIFY_KEYWORD",
            "MODIFY_OPINION",
            "MODIFY_NOTE",
            "MODIFY_REASON",
        }
        actual = {m.name for m in Permission}
        assert expected == actual

    def test_values_are_snake_case_strings(self):
        from slrt_project.shared.permissions import Permission

        for p in Permission:
            assert p.value == p.value.lower()
            assert " " not in p.value


# ── PERMISSIONS map ────────────────────────────────────────────────────────────


class TestPermissionsMap:
    def test_every_permission_has_an_entry(self):
        from slrt_project.shared.permissions import PERMISSIONS, Permission

        for p in Permission:
            assert p in PERMISSIONS, f"{p} missing from PERMISSIONS map"

    def test_all_role_lists_are_non_empty(self):
        from slrt_project.shared.permissions import PERMISSIONS

        for perm, roles in PERMISSIONS.items():
            assert roles, f"Role list for {perm} is empty"

    def test_access_review_includes_all_roles(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.shared.permissions import PERMISSIONS, Permission

        Role = ReviewMember.Role
        allowed = PERMISSIONS[Permission.ACCESS_REVIEW]
        assert set(allowed) == {
            Role.OWNER,
            Role.COLLABORATOR,
            Role.REVIEWER,
            Role.VIEWER,
        }

    def test_modify_review_is_owner_only(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.shared.permissions import PERMISSIONS, Permission

        assert PERMISSIONS[Permission.MODIFY_REVIEW] == [ReviewMember.Role.OWNER]

    def test_viewer_cannot_modify_anything(self):
        """VIEWER should not appear in any MODIFY_* permission."""
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.shared.permissions import PERMISSIONS, Permission

        modify_perms = [p for p in Permission if p.value.startswith("modify")]
        for perm in modify_perms:
            assert ReviewMember.Role.VIEWER not in PERMISSIONS[perm], (
                f"VIEWER should not have {perm}"
            )


# ── get_user_role ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestGetUserRole:
    def test_returns_role_for_existing_member(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import get_user_role

        member = ReviewMemberFactory(role=ReviewMember.Role.COLLABORATOR)
        result = get_user_role(member.user, member.review)
        assert result == ReviewMember.Role.COLLABORATOR

    def test_returns_owner_role(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import get_user_role

        member = ReviewMemberFactory(role=ReviewMember.Role.OWNER)
        result = get_user_role(member.user, member.review)
        assert result == ReviewMember.Role.OWNER

    def test_returns_none_for_non_member(self):
        from slrt_project.reviews.tests.factories import ReviewFactory, UserFactory
        from slrt_project.shared.permissions import get_user_role

        review = ReviewFactory()
        user = UserFactory()
        assert get_user_role(user, review) is None


# ── can ────────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCan:
    def test_returns_true_when_role_is_allowed(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, can

        member = ReviewMemberFactory(role=ReviewMember.Role.OWNER)
        assert can(Permission.MODIFY_REVIEW, member.user, member.review) is True

    def test_returns_false_when_role_not_allowed(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, can

        member = ReviewMemberFactory(role=ReviewMember.Role.VIEWER)
        assert can(Permission.MODIFY_REVIEW, member.user, member.review) is False

    def test_returns_false_for_non_member(self):
        from slrt_project.reviews.tests.factories import ReviewFactory, UserFactory
        from slrt_project.shared.permissions import Permission, can

        review = ReviewFactory()
        user = UserFactory()
        assert can(Permission.ACCESS_REVIEW, user, review) is False

    def test_collaborator_can_upload_files(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, can

        member = ReviewMemberFactory(role=ReviewMember.Role.COLLABORATOR)
        assert can(Permission.UPLOAD_FILES, member.user, member.review) is True

    def test_reviewer_cannot_upload_files(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, can

        member = ReviewMemberFactory(role=ReviewMember.Role.REVIEWER)
        assert can(Permission.UPLOAD_FILES, member.user, member.review) is False

    def test_reviewer_can_modify_opinion(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, can

        member = ReviewMemberFactory(role=ReviewMember.Role.REVIEWER)
        assert can(Permission.MODIFY_OPINION, member.user, member.review) is True

    def test_viewer_cannot_access_with_wrong_review(self):
        """A user who is a member of one review cannot access a different review."""
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            ReviewMemberFactory,
        )
        from slrt_project.shared.permissions import Permission, can

        member = ReviewMemberFactory()
        other_review = ReviewFactory()
        assert can(Permission.ACCESS_REVIEW, member.user, other_review) is False


# ── humanize_permission ────────────────────────────────────────────────────────


class TestHumanizePermission:
    def test_non_modify_permission_has_no_the(self):
        from slrt_project.shared.permissions import Permission, humanize_permission

        result = humanize_permission(Permission.ASSIGN)
        assert result == "assign"
        assert "the" not in result

    def test_modify_permission_inserts_the(self):
        from slrt_project.shared.permissions import Permission, humanize_permission

        result = humanize_permission(Permission.MODIFY_NOTE)
        assert result == "modify the note"

    def test_modify_review_humanized(self):
        from slrt_project.shared.permissions import Permission, humanize_permission

        result = humanize_permission(Permission.MODIFY_REVIEW)
        assert result == "modify the review"

    def test_access_review_humanized(self):
        from slrt_project.shared.permissions import Permission, humanize_permission

        result = humanize_permission(Permission.ACCESS_REVIEW)
        assert result == "access review"

    def test_underscores_replaced_with_spaces(self):
        from slrt_project.shared.permissions import Permission, humanize_permission

        result = humanize_permission(Permission.MODIFY_THEMES_CODES)
        assert "_" not in result


# ── permission_denied_message ──────────────────────────────────────────────────


class TestPermissionDeniedMessage:
    def test_message_starts_with_you_cannot(self):
        from slrt_project.shared.permissions import (
            Permission,
            permission_denied_message,
        )

        msg = permission_denied_message(Permission.MODIFY_REVIEW)
        assert msg.startswith("You cannot")

    def test_message_lists_allowed_roles(self):
        from slrt_project.shared.permissions import (
            Permission,
            permission_denied_message,
        )

        msg = permission_denied_message(Permission.MODIFY_REVIEW)
        # MODIFY_REVIEW is owner-only
        assert "owner" in msg

    def test_message_for_reviewer_permission_lists_multiple_roles(self):
        from slrt_project.shared.permissions import (
            Permission,
            permission_denied_message,
        )

        msg = permission_denied_message(Permission.MODIFY_OPINION)
        assert "owner" in msg
        assert "collaborator" in msg
        assert "reviewer" in msg

    def test_message_includes_humanized_action(self):
        from slrt_project.shared.permissions import (
            Permission,
            permission_denied_message,
        )

        msg = permission_denied_message(Permission.MODIFY_NOTE)
        assert "modify the note" in msg


# ── check_permission ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCheckPermission:
    def test_does_not_raise_when_permitted(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, check_permission

        member = ReviewMemberFactory(role=ReviewMember.Role.OWNER)
        # Should not raise
        check_permission(Permission.MODIFY_REVIEW, member.user, member.review)

    def test_raises_permission_denied_when_not_permitted(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, check_permission

        member = ReviewMemberFactory(role=ReviewMember.Role.VIEWER)
        with pytest.raises(PermissionDenied):
            check_permission(Permission.MODIFY_REVIEW, member.user, member.review)

    def test_raised_exception_has_human_readable_message(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, check_permission

        member = ReviewMemberFactory(role=ReviewMember.Role.VIEWER)
        with pytest.raises(PermissionDenied) as exc_info:
            check_permission(Permission.MODIFY_REVIEW, member.user, member.review)
        detail = str(exc_info.value.detail)
        assert "cannot" in detail.lower() or "modify" in detail.lower()

    def test_raises_for_non_member(self):
        from slrt_project.reviews.tests.factories import ReviewFactory, UserFactory
        from slrt_project.shared.permissions import Permission, check_permission

        review = ReviewFactory()
        user = UserFactory()
        with pytest.raises(PermissionDenied):
            check_permission(Permission.ACCESS_REVIEW, user, review)

    def test_collaborator_passes_upload_files(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, check_permission

        member = ReviewMemberFactory(role=ReviewMember.Role.COLLABORATOR)
        check_permission(Permission.UPLOAD_FILES, member.user, member.review)

    def test_reviewer_fails_upload_files(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import Permission, check_permission

        member = ReviewMemberFactory(role=ReviewMember.Role.REVIEWER)
        with pytest.raises(PermissionDenied):
            check_permission(Permission.UPLOAD_FILES, member.user, member.review)


# ── IsReviewOwner ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestIsReviewOwner:
    def _make_request(self, user):
        request = MagicMock()
        request.user = user
        return request

    def test_returns_true_for_owner(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import IsReviewOwner

        member = ReviewMemberFactory(role=ReviewMember.Role.OWNER)
        perm = IsReviewOwner()
        assert (
            perm.has_object_permission(
                self._make_request(member.user), None, member.review
            )
            is True
        )

    def test_returns_false_for_collaborator(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import IsReviewOwner

        member = ReviewMemberFactory(role=ReviewMember.Role.COLLABORATOR)
        perm = IsReviewOwner()
        assert (
            perm.has_object_permission(
                self._make_request(member.user), None, member.review
            )
            is False
        )

    def test_returns_false_for_reviewer(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import IsReviewOwner

        member = ReviewMemberFactory(role=ReviewMember.Role.REVIEWER)
        perm = IsReviewOwner()
        assert (
            perm.has_object_permission(
                self._make_request(member.user), None, member.review
            )
            is False
        )

    def test_returns_false_for_viewer(self):
        from slrt_project.reviews.models import ReviewMember
        from slrt_project.reviews.tests.factories import ReviewMemberFactory
        from slrt_project.shared.permissions import IsReviewOwner

        member = ReviewMemberFactory(role=ReviewMember.Role.VIEWER)
        perm = IsReviewOwner()
        assert (
            perm.has_object_permission(
                self._make_request(member.user), None, member.review
            )
            is False
        )

    def test_returns_false_for_non_member(self):
        from slrt_project.reviews.tests.factories import ReviewFactory, UserFactory
        from slrt_project.shared.permissions import IsReviewOwner

        review = ReviewFactory()
        user = UserFactory()
        perm = IsReviewOwner()
        assert (
            perm.has_object_permission(self._make_request(user), None, review) is False
        )
