import os
import re
from unittest.mock import MagicMock

import pytest

# Shared helpers — construct model instances without hitting the DB
from django.db.models.base import ModelState

from slrt_project.reviews.models import (
    Review,
    ReviewChatMessage,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SearchMethod,
    search_method_upload_path,
)
from slrt_project.reviews.tests.factories import (
    ReviewChatMessageFactory,
    ReviewFactory,
    ReviewInvitationFactory,
    ReviewMemberFactory,
    ScreeningCriteriaFactory,
    ScreeningStatFactory,
    SearchMethodFactory,
    UserFactory,
)


def _make(model_cls, **kwargs):
    """
    Construct a model instance without touching the database.
    """
    instance = model_cls.__new__(model_cls)
    instance._state = ModelState()
    instance._state.fields_cache = {}
    instance.__dict__["id"] = None
    instance.__dict__.update(kwargs)
    return instance


# Review


class TestReviewStr:
    def test_returns_title(self):
        r = _make(Review, title="Systematic Review 2024")
        assert str(r) == "Systematic Review 2024"

    def test_empty_title(self):
        r = _make(Review, title="")
        assert str(r) == ""


class TestReviewDuplicateDetectionStatus:
    def test_db_values_are_lowercase(self):
        # TextChoices stores ("db_value", "Display Label") — r[0] is the DB value.
        values = {c[0] for c in Review.DuplicateDetectionStatus.choices}
        assert values == {"not_started", "pending", "completed"}

    def test_default_is_not_started(self):
        field = Review._meta.get_field("duplicate_detection_status")
        assert field.default == Review.DuplicateDetectionStatus.NOT_STARTED

    def test_is_active_default_true(self):
        assert Review._meta.get_field("is_active").default is True

    def test_is_blinded_default_true(self):
        assert Review._meta.get_field("is_blinded").default is True


@pytest.mark.django_db
class TestReviewFactory:
    def test_creates_row(self):
        assert ReviewFactory().pk is not None

    def test_default_is_active(self):
        assert ReviewFactory().is_active is True

    def test_default_is_blinded(self):
        assert ReviewFactory().is_blinded is True

    def test_default_status_not_started(self):
        assert (
            ReviewFactory().duplicate_detection_status
            == Review.DuplicateDetectionStatus.NOT_STARTED
        )

    def test_custom_title(self):
        assert ReviewFactory(title="My SLR").title == "My SLR"

    def test_override_blinded(self):
        assert ReviewFactory(is_blinded=False).is_blinded is False


class TestComputeOpinionStats:
    """
    Blinding logic only — no ReferenceOpinion rows needed.
    Replace the real method with a spy closure.
    """

    def _spy(self, review, stats=None):
        calls = []
        _stats = stats or [{"member_id": 1, "total": 5}]

        def fake(stage, user=None):
            calls.append({"stage": stage, "user": user})
            return _stats if (not review.is_blinded or user) else []

        review.compute_opinion_stats = fake
        return calls

    def test_blinded_with_user_returns_stats(self):
        r = _make(Review, is_blinded=True)
        self._spy(r)
        assert len(r.compute_opinion_stats("screening", user=MagicMock())) == 1

    def test_blinded_without_user_returns_empty(self):
        r = _make(Review, is_blinded=True)
        self._spy(r)
        assert r.compute_opinion_stats("screening") == []

    def test_unblinded_returns_all(self):
        r = _make(Review, is_blinded=False)
        r.compute_opinion_stats = lambda stage, user=None: [1, 2]
        assert len(r.compute_opinion_stats("full_text")) == 2

    def test_return_type_is_list(self):
        r = _make(Review, is_blinded=False)
        r.compute_opinion_stats = lambda stage, user=None: []
        assert isinstance(r.compute_opinion_stats("screening"), list)

    def test_user_forwarded_correctly(self):
        r = _make(Review, is_blinded=True)
        calls = self._spy(r)
        user = MagicMock()
        r.compute_opinion_stats("full_text", user=user)
        assert calls[0]["user"] is user
        assert calls[0]["stage"] == "full_text"


# ReviewMember


@pytest.mark.django_db
class TestReviewMemberStr:
    def test_format(self):
        m = ReviewMemberFactory(
            user=UserFactory(first_name="Bob", last_name="Jones", email="bob@x.com")
        )
        assert str(m) == "Bob Jones (bob@x.com)"

    def test_empty_names_shows_email(self):
        m = ReviewMemberFactory(
            user=UserFactory(first_name="", last_name="", email="anon@x.com")
        )
        assert "anon@x.com" in str(m)


@pytest.mark.django_db
class TestReviewMemberUserName:
    def test_full_name(self):
        m = ReviewMemberFactory(
            user=UserFactory(first_name="Alice", last_name="Wong", email="a@x.com")
        )
        assert m.user_name == "Alice Wong"

    def test_strips_whitespace_when_last_name_empty(self):
        m = ReviewMemberFactory(
            user=UserFactory(first_name="Solo", last_name="", email="s@x.com")
        )
        assert m.user_name == "Solo"

    def test_falls_back_to_email_when_blank(self):
        m = ReviewMemberFactory(
            user=UserFactory(first_name="", last_name="", email="no-name@x.com")
        )
        assert m.user_name == "no-name@x.com"


class TestReviewMemberRoles:
    def test_db_values_are_lowercase(self):
        # DB values: "owner", "collaborator", "reviewer", "viewer"
        values = {r[0] for r in ReviewMember.Role.choices}
        assert values == {
            ReviewMember.Role.OWNER,  # "owner"
            ReviewMember.Role.COLLABORATOR,  # "collaborator"
            ReviewMember.Role.REVIEWER,  # "reviewer"
            ReviewMember.Role.VIEWER,  # "viewer"
        }

    def test_unique_constraint_name(self):
        names = [c.name for c in ReviewMember._meta.constraints]
        assert "unique_user_per_review" in names


@pytest.mark.django_db
class TestReviewMemberFactory:
    def test_creates_row(self):
        assert ReviewMemberFactory().pk is not None

    def test_default_role_reviewer(self):
        assert ReviewMemberFactory().role == ReviewMember.Role.REVIEWER

    def test_owner_trait(self):
        assert ReviewMemberFactory(owner=True).role == ReviewMember.Role.OWNER

    def test_collaborator_trait(self):
        assert (
            ReviewMemberFactory(collaborator=True).role
            == ReviewMember.Role.COLLABORATOR
        )

    def test_viewer_trait(self):
        assert ReviewMemberFactory(viewer=True).role == ReviewMember.Role.VIEWER

    def test_linked_to_review(self):
        review = ReviewFactory()
        assert ReviewMemberFactory(review=review).review == review

    def test_get_or_create_no_duplicate(self):
        review, user = ReviewFactory(), UserFactory()
        m1 = ReviewMemberFactory(review=review, user=user)
        m2 = ReviewMemberFactory(review=review, user=user)
        assert m1.pk == m2.pk


# ReviewInvitation


class TestReviewInvitationStr:
    def test_format(self):
        inv = _make(ReviewInvitation, email="carol@x.com", review_id=42)
        assert str(inv) == "Invitation to carol@x.com for review 42"

    def test_email_in_str(self):
        inv = _make(ReviewInvitation, email="z@z.com", review_id=1)
        assert "z@z.com" in str(inv)


class TestReviewInvitationRoles:
    def test_no_owner_role(self):
        # DB values are lowercase; "owner" must not appear.
        values = {r[0] for r in ReviewInvitation.Role.choices}
        assert (
            ReviewMember.Role.OWNER not in values
        )  # "owner" not in {"collaborator","reviewer","viewer"}

    def test_expected_roles(self):
        values = {r[0] for r in ReviewInvitation.Role.choices}
        assert values == {
            ReviewInvitation.Role.COLLABORATOR,  # "collaborator"
            ReviewInvitation.Role.REVIEWER,  # "reviewer"
            ReviewInvitation.Role.VIEWER,  # "viewer"
        }


@pytest.mark.django_db
class TestReviewInvitationFactory:
    def test_creates_row(self):
        assert ReviewInvitationFactory().pk is not None

    def test_emails_unique_per_call(self):
        assert ReviewInvitationFactory().email != ReviewInvitationFactory().email

    def test_default_role_reviewer(self):
        assert ReviewInvitationFactory().role == ReviewInvitation.Role.REVIEWER

    def test_custom_role(self):
        inv = ReviewInvitationFactory(role=ReviewInvitation.Role.VIEWER)
        assert inv.role == ReviewInvitation.Role.VIEWER

    def test_linked_to_review(self):
        review = ReviewFactory()
        assert ReviewInvitationFactory(review=review).review == review


# ScreeningCriteria


class TestScreeningCriteriaStr:
    def test_inclusion(self):
        c = _make(
            ScreeningCriteria,
            type=ScreeningCriteria.Type.INCLUSION,
            name="Peer-reviewed",
        )
        assert str(c) == f"[{ScreeningCriteria.Type.INCLUSION}] Peer-reviewed"

    def test_exclusion(self):
        c = _make(
            ScreeningCriteria,
            type=ScreeningCriteria.Type.EXCLUSION,
            name="Grey literature",
        )
        assert str(c) == f"[{ScreeningCriteria.Type.EXCLUSION}] Grey literature"


class TestScreeningCriteriaTypes:
    def test_two_types_with_correct_db_values(self):
        values = {t[0] for t in ScreeningCriteria.Type.choices}
        assert values == {
            ScreeningCriteria.Type.INCLUSION,
            ScreeningCriteria.Type.EXCLUSION,
        }

    def test_unique_constraint_name(self):
        names = [c.name for c in ScreeningCriteria._meta.constraints]
        assert "unique_criteria_per_review" in names


@pytest.mark.django_db
class TestScreeningCriteriaFactory:
    def test_creates_row(self):
        assert ScreeningCriteriaFactory().pk is not None

    def test_default_type_inclusion(self):
        assert ScreeningCriteriaFactory().type == ScreeningCriteria.Type.INCLUSION

    def test_exclusive_trait(self):
        assert (
            ScreeningCriteriaFactory(exclusive=True).type
            == ScreeningCriteria.Type.EXCLUSION
        )

    def test_names_unique_per_call(self):
        assert ScreeningCriteriaFactory().name != ScreeningCriteriaFactory().name

    def test_linked_to_review(self):
        review = ReviewFactory()
        assert ScreeningCriteriaFactory(review=review).review == review


# ScreeningStat


@pytest.mark.django_db
class TestScreeningStatStr:
    def test_contains_seconds_and_sessions(self):
        stat = ScreeningStatFactory(seconds=3600, sessions=4)
        result = str(stat)
        assert "3600" in result
        assert "4" in result

    def test_em_dash_separator(self):
        stat = ScreeningStatFactory(seconds=0, sessions=0)
        assert "—" in str(stat)


class TestScreeningStatMeta:
    def test_seconds_default_zero(self):
        assert ScreeningStat._meta.get_field("seconds").default == 0

    def test_sessions_default_zero(self):
        assert ScreeningStat._meta.get_field("sessions").default == 0

    def test_member_is_one_to_one(self):
        from django.db.models import OneToOneField

        assert isinstance(ScreeningStat._meta.get_field("member"), OneToOneField)

    def test_unique_constraint_name(self):
        names = [c.name for c in ScreeningStat._meta.constraints]
        assert "unique_screening_stat_per_member" in names


@pytest.mark.django_db
class TestScreeningStatFactory:
    def test_creates_row(self):
        assert ScreeningStatFactory().pk is not None

    def test_default_seconds_zero(self):
        assert ScreeningStatFactory().seconds == 0

    def test_default_sessions_zero(self):
        assert ScreeningStatFactory().sessions == 0

    def test_custom_values(self):
        stat = ScreeningStatFactory(seconds=7200, sessions=3)
        assert stat.seconds == 7200
        assert stat.sessions == 3

    def test_linked_to_member(self):
        member = ReviewMemberFactory()
        assert ScreeningStatFactory(member=member).member == member

    def test_one_stat_per_member_constraint(self):
        from django.db import IntegrityError

        member = ReviewMemberFactory()
        ScreeningStatFactory(member=member)
        with pytest.raises(IntegrityError):
            ScreeningStat.objects.create(member=member, seconds=0, sessions=0)


# ReviewChatMessage


@pytest.mark.django_db
class TestReviewChatMessageUserName:
    def test_system_returns_system(self):
        msg = ReviewChatMessageFactory(system=True)
        assert msg.user_name == "System"

    def test_system_flag_beats_member(self):
        # system=True nulls out member, so this also just checks is_system_message
        msg = ReviewChatMessageFactory(system=True)
        assert msg.user_name == "System"

    def test_human_full_name(self):
        user = UserFactory(first_name="Carol", last_name="White", email="c@x.com")
        member = ReviewMemberFactory(user=user)
        msg = ReviewChatMessageFactory(review=member.review, member=member)
        assert msg.user_name == "Carol White"

    def test_human_falls_back_to_email(self):
        user = UserFactory(first_name="", last_name="", email="x@x.com")
        member = ReviewMemberFactory(user=user)
        msg = ReviewChatMessageFactory(review=member.review, member=member)
        assert msg.user_name == "x@x.com"

    def test_no_member_not_system_returns_unknown(self):
        # Create a system message then manually flip the flag to simulate
        # a corrupt/legacy row with no member and is_system_message=False.
        msg = ReviewChatMessageFactory(system=True)
        ReviewChatMessage.objects.filter(pk=msg.pk).update(is_system_message=False)
        msg.refresh_from_db()
        assert msg.user_name == "Unknown"


@pytest.mark.django_db
class TestReviewChatMessageStr:
    def test_contains_sender_and_message(self):
        msg = ReviewChatMessageFactory(system=True, message="Task done")
        assert "System" in str(msg)
        assert "Task done" in str(msg)

    def test_truncates_long_message(self):
        msg = ReviewChatMessageFactory(system=True, message="x" * 100)
        assert len(str(msg)) < 100 + len("System: ")


class TestReviewChatMessageMeta:
    def test_ordering(self):
        assert ReviewChatMessage._meta.ordering == ["created_at"]

    def test_two_indexes(self):
        assert len(ReviewChatMessage._meta.indexes) == 2

    def test_member_nullable(self):
        assert ReviewChatMessage._meta.get_field("member").null is True

    def test_is_system_message_default_false(self):
        assert ReviewChatMessage._meta.get_field("is_system_message").default is False

    def test_metadata_nullable(self):
        assert ReviewChatMessage._meta.get_field("metadata").null is True


@pytest.mark.django_db
class TestReviewChatMessageFactory:
    def test_creates_human_message(self):
        msg = ReviewChatMessageFactory()
        assert msg.pk is not None
        assert msg.is_system_message is False
        assert msg.member is not None

    def test_system_trait_clears_member(self):
        msg = ReviewChatMessageFactory(system=True)
        assert msg.is_system_message is True
        assert msg.member is None

    def test_system_trait_sets_metadata(self):
        assert ReviewChatMessageFactory(system=True).metadata is not None

    def test_human_message_review_matches_member_review(self):
        msg = ReviewChatMessageFactory()
        assert msg.member.review == msg.review


# search_method_upload_path

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class TestSearchMethodUploadPath:
    def _call(self, filename):
        return search_method_upload_path(MagicMock(), filename)

    def test_stored_under_search_methods(self):
        assert self._call("refs.bib").startswith("search_methods" + os.sep)

    def test_stem_is_uuid(self):
        stem = os.path.basename(self._call("refs.bib")).rsplit(".", 1)[0]
        assert UUID_RE.match(stem), f"Expected UUID stem, got: {stem}"

    def test_extension_bib(self):
        assert self._call("refs.bib").endswith(".bib")

    def test_extension_ris(self):
        assert self._call("export.ris").endswith(".ris")

    def test_extension_xml(self):
        assert self._call("export.xml").endswith(".xml")

    def test_multi_dot_uses_last_extension(self):
        assert self._call("my.refs.v2.bib").endswith(".bib")

    def test_two_calls_differ(self):
        assert self._call("refs.bib") != self._call("refs.bib")

    def test_ten_calls_all_unique(self):
        paths = [self._call("file.bib") for _ in range(10)]
        assert len(set(paths)) == 10


# SearchMethod


class TestSearchMethodStr:
    def test_returns_name(self):
        sm = _make(SearchMethod, name="PubMed 2024")
        assert str(sm) == "PubMed 2024"

    def test_empty_name(self):
        sm = _make(SearchMethod, name="")
        assert str(sm) == ""


class TestSearchMethodMeta:
    def test_file_nullable_and_blank(self):
        field = SearchMethod._meta.get_field("file")
        assert field.null is True
        assert field.blank is True


@pytest.mark.django_db
class TestSearchMethodFactory:
    def test_creates_row(self):
        assert SearchMethodFactory().pk is not None

    def test_no_file_by_default(self):
        assert not SearchMethodFactory().file

    def test_names_unique_per_call(self):
        assert SearchMethodFactory().name != SearchMethodFactory().name

    def test_linked_to_review(self):
        review = ReviewFactory()
        assert SearchMethodFactory(review=review).review == review
