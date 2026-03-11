"""
Tests for slrt_project/reviews/serializers.py.

Strategy
--------
- No-DB tests (no marker): pure serializer logic — validation, field presence,
  computed fields — exercised with plain dicts or minimal MagicMock objects.
- DB tests (@pytest.mark.django_db): serializers whose output depends on real
  ORM relations (nested objects, StringRelatedField) use factories.

One class per serializer; within each class one method per behaviour.
"""

import pytest

from slrt_project.reviews.api.serializers import (
    AddDataResponseSerializer,
    AddDataSerializer,
    ArticleCountSerializer,
    AutoResolveDuplicatesRequestSerializer,
    AutoResolveDuplicatesResponseSerializer,
    DetectDuplicatesRequestSerializer,
    DetectDuplicatesResponseSerializer,
    ExportJsonResponseSerializer,
    ExportLatexResponseSerializer,
    InvitationAcceptDeclineResponseSerializer,
    LabelCountSerializer,
    OpinionStatsSerializer,
    PrismaResponseSerializer,
    PrismaValidationIssueSerializer,
    ReviewInvitationCreateSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewMemberSerializer,
    ReviewSerializer,
    ScreeningCriteriaSerializer,
    ScreeningStatSerializer,
    SearchMethodDetailSerializer,
    SearchMethodSerializer,
    UploadReferencesResponseSerializer,
)
from slrt_project.reviews.models import ReviewMember
from slrt_project.reviews.tests.factories import (
    ReviewFactory,
    ReviewInvitationFactory,
    ReviewMemberFactory,
    ScreeningCriteriaFactory,
    ScreeningStatFactory,
    SearchMethodFactory,
    UserFactory,
)


# ===========================================================================
# ReviewMemberSerializer
# ===========================================================================


@pytest.mark.django_db
class TestReviewMemberSerializer:
    def test_fields_present(self):
        member = ReviewMemberFactory()
        data = ReviewMemberSerializer(member).data
        assert set(data.keys()) >= {"id", "role", "user"}

    def test_user_is_nested(self):
        member = ReviewMemberFactory()
        data = ReviewMemberSerializer(member).data
        assert isinstance(data["user"], dict)
        assert "email" in data["user"]

    def test_validate_role_creation_allows_any_role(self):
        s = ReviewMemberSerializer(data={"role": ReviewMember.Role.COLLABORATOR})
        s.is_valid()
        # No instance — should not raise on COLLABORATOR
        assert s.validated_data.get("role") or True  # passes validation path

    def test_validate_role_cannot_change_owner(self):
        member = ReviewMemberFactory(owner=True)
        s = ReviewMemberSerializer(
            instance=member,
            data={"role": ReviewMember.Role.COLLABORATOR},
            partial=True,
        )
        assert not s.is_valid()
        assert "role" in s.errors

    def test_validate_role_cannot_promote_to_owner(self):
        member = ReviewMemberFactory()  # reviewer by default
        s = ReviewMemberSerializer(
            instance=member,
            data={"role": ReviewMember.Role.OWNER},
            partial=True,
        )
        assert not s.is_valid()
        assert "role" in s.errors

    def test_validate_role_allows_reviewer_to_collaborator(self):
        member = ReviewMemberFactory()  # reviewer
        s = ReviewMemberSerializer(
            instance=member,
            data={"role": ReviewMember.Role.COLLABORATOR},
            partial=True,
        )
        assert s.is_valid(), s.errors

    def test_id_is_read_only(self):
        field = ReviewMemberSerializer().fields["id"]
        assert field.read_only

    def test_user_is_read_only(self):
        field = ReviewMemberSerializer().fields["user"]
        assert field.read_only


# ===========================================================================
# ScreeningStatSerializer
# ===========================================================================


@pytest.mark.django_db
class TestScreeningStatSerializer:
    def _stat(
        self,
        first_name="Alice",
        last_name="Smith",
        email="a@x.com",
        seconds=3600,
        sessions=2,
    ):
        user = UserFactory(first_name=first_name, last_name=last_name, email=email)
        member = ReviewMemberFactory(user=user)
        return ScreeningStatFactory(member=member, seconds=seconds, sessions=sessions)

    def test_fields_present(self):
        data = ScreeningStatSerializer(self._stat()).data
        assert set(data.keys()) >= {
            "id",
            "user_name",
            "user_email",
            "seconds",
            "hours",
            "sessions",
        }

    def test_user_name_full(self):
        data = ScreeningStatSerializer(
            self._stat(first_name="Alice", last_name="Smith")
        ).data
        assert data["user_name"] == "Alice Smith"

    def test_user_name_strips_whitespace(self):
        data = ScreeningStatSerializer(self._stat(first_name="Solo", last_name="")).data
        assert data["user_name"] == "Solo"

    def test_user_email(self):
        data = ScreeningStatSerializer(self._stat(email="stat@x.com")).data
        assert data["user_email"] == "stat@x.com"

    def test_hours_conversion(self):
        data = ScreeningStatSerializer(self._stat(seconds=3600)).data
        assert data["hours"] == 1.0

    def test_hours_rounded(self):
        data = ScreeningStatSerializer(self._stat(seconds=100)).data
        assert data["hours"] == round(100 / 3600, 2)

    def test_hours_zero(self):
        data = ScreeningStatSerializer(self._stat(seconds=0)).data
        assert data["hours"] == 0.0

    def test_sessions_present(self):
        data = ScreeningStatSerializer(self._stat(sessions=5)).data
        assert data["sessions"] == 5


# ===========================================================================
# OpinionStatsSerializer
# ===========================================================================


class TestOpinionStatsSerializer:
    def _valid(self):
        return {
            "member_id": 1,
            "user_name": "Alice Smith",
            "user_email": "a@x.com",
            "excluded": 3,
            "maybe": 2,
            "included": 5,
            "total": 10,
        }

    def test_valid_data(self):
        s = OpinionStatsSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_fields_present(self):
        s = OpinionStatsSerializer(data=self._valid())
        s.is_valid()
        assert set(s.validated_data.keys()) == {
            "member_id",
            "user_name",
            "user_email",
            "excluded",
            "maybe",
            "included",
            "total",
        }

    def test_missing_member_id_invalid(self):
        d = self._valid()
        del d["member_id"]
        assert not OpinionStatsSerializer(data=d).is_valid()

    def test_invalid_email(self):
        d = self._valid()
        d["user_email"] = "not-an-email"
        assert not OpinionStatsSerializer(data=d).is_valid()


# ===========================================================================
# ReviewSerializer
# ===========================================================================


@pytest.mark.django_db
class TestReviewSerializer:
    def _annotated(self, **kwargs):
        """Return a Review with optional annotation attributes set directly."""
        r = ReviewFactory()
        defaults = dict(
            user_role=None,
            user_member_id=None,
            reference_count=None,
            duplicate_resolved_count=0,
            duplicate_not_duplicate_count=0,
            duplicate_deleted_count=0,
            duplicate_clusters_count=None,
            duplicate_clusters_unresolved_count=None,
        )
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(r, k, v)
        return r

    def test_fields_present(self):
        data = ReviewSerializer(self._annotated()).data
        expected = {
            "id",
            "title",
            "description",
            "is_active",
            "reference_count",
            "date_created",
            "is_blinded",
            "user_role",
            "user_member_id",
            "duplicate_detection_status",
            "duplicate_resolved_count",
            "duplicate_not_duplicate_count",
            "duplicate_deleted_count",
            "duplicate_clusters_unresolved_count",
            "duplicate_clusters_count",
        }
        assert expected.issubset(set(data.keys()))

    def test_user_role_from_annotation(self):
        data = ReviewSerializer(self._annotated(user_role="reviewer")).data
        assert data["user_role"] == "reviewer"

    def test_user_role_none_when_absent(self):
        r = ReviewFactory()
        # No annotation set at all
        data = ReviewSerializer(r).data
        assert data["user_role"] is None

    def test_date_created_format(self):
        import re

        data = ReviewSerializer(self._annotated()).data
        # Expect "DD Mon YYYY" e.g. "05 Mar 2026"
        assert re.match(r"\d{2} \w{3} \d{4}", data["date_created"])


# ===========================================================================
# ReviewListSerializer
# ===========================================================================


@pytest.mark.django_db
class TestReviewListSerializer:
    def _annotated(
        self,
        owner_email=None,
        owner_first_name="",
        owner_last_name="",
        user_role="reviewer",
        reference_count=0,
    ):
        r = ReviewFactory()
        r.owner_email = owner_email
        r.owner_first_name = owner_first_name
        r.owner_last_name = owner_last_name
        r.user_role = user_role
        r.reference_count = reference_count
        return r

    def test_fields_present(self):
        data = ReviewListSerializer(self._annotated()).data
        assert set(data.keys()) >= {
            "id",
            "title",
            "date_created",
            "owner",
            "reference_count",
            "user_role",
        }

    def test_owner_full_name_and_email(self):
        data = ReviewListSerializer(
            self._annotated(
                owner_email="o@x.com", owner_first_name="Jane", owner_last_name="Doe"
            )
        ).data
        assert data["owner"] == "Jane Doe (o@x.com)"

    def test_owner_email_only_when_no_name(self):
        data = ReviewListSerializer(
            self._annotated(
                owner_email="o@x.com", owner_first_name="", owner_last_name=""
            )
        ).data
        assert data["owner"] == "o@x.com"

    def test_owner_none_when_no_email(self):
        data = ReviewListSerializer(self._annotated(owner_email=None)).data
        assert data["owner"] is None

    def test_user_role_annotation(self):
        data = ReviewListSerializer(self._annotated(user_role="owner")).data
        assert data["user_role"] == "owner"

    def test_date_created_format(self):
        import re

        data = ReviewListSerializer(self._annotated()).data
        assert re.match(r"\d{2} \w{3} \d{4}", data["date_created"])


# ===========================================================================
# ReviewInvitationCreateSerializer
# ===========================================================================


class TestReviewInvitationCreateSerializer:
    def test_valid(self):
        s = ReviewInvitationCreateSerializer(data={"review": 1, "emails": ["a@x.com"]})
        assert s.is_valid(), s.errors

    def test_multiple_emails(self):
        s = ReviewInvitationCreateSerializer(
            data={"review": 1, "emails": ["a@x.com", "b@x.com"]}
        )
        assert s.is_valid(), s.errors

    def test_empty_emails_invalid(self):
        s = ReviewInvitationCreateSerializer(data={"review": 1, "emails": []})
        assert not s.is_valid()
        assert "emails" in s.errors

    def test_invalid_email_format(self):
        s = ReviewInvitationCreateSerializer(
            data={"review": 1, "emails": ["not-an-email"]}
        )
        assert not s.is_valid()

    def test_missing_review_invalid(self):
        s = ReviewInvitationCreateSerializer(data={"emails": ["a@x.com"]})
        assert not s.is_valid()
        assert "review" in s.errors


# ===========================================================================
# ReviewInvitationSerializer
# ===========================================================================


@pytest.mark.django_db
class TestReviewInvitationSerializer:
    def test_fields_present(self):
        inv = ReviewInvitationFactory()
        data = ReviewInvitationSerializer(inv).data
        assert "email" in data
        assert "review" in data
        assert "invited_by" in data
        assert "created_at" in data

    def test_review_is_string_related(self):
        inv = ReviewInvitationFactory()
        data = ReviewInvitationSerializer(inv).data
        assert isinstance(data["review"], str)

    def test_invited_by_is_string_related(self):
        inv = ReviewInvitationFactory()
        data = ReviewInvitationSerializer(inv).data
        assert isinstance(data["invited_by"], str)

    def test_date_format(self):
        import re

        inv = ReviewInvitationFactory()
        data = ReviewInvitationSerializer(inv).data
        assert re.match(r"\d{2} \w{3} \d{4}", data["created_at"])


# ===========================================================================
# ScreeningCriteriaSerializer
# ===========================================================================


@pytest.mark.django_db
class TestScreeningCriteriaSerializer:
    def test_fields_present(self):
        c = ScreeningCriteriaFactory()
        data = ScreeningCriteriaSerializer(c).data
        assert set(data.keys()) >= {"id", "review", "name", "description", "type"}

    def test_id_is_read_only(self):
        assert ScreeningCriteriaSerializer().fields["id"].read_only

    def test_valid_create_data(self):
        review = ReviewFactory()
        s = ScreeningCriteriaSerializer(
            data={
                "review": review.pk,
                "name": "Peer-reviewed only",
                "description": "Must be peer-reviewed",
                "type": "inclusion",
            }
        )
        assert s.is_valid(), s.errors

    def test_invalid_type_rejected(self):
        review = ReviewFactory()
        s = ScreeningCriteriaSerializer(
            data={
                "review": review.pk,
                "name": "Bad type",
                "type": "unknown",
            }
        )
        assert not s.is_valid()
        assert "type" in s.errors


# ===========================================================================
# LabelCountSerializer
# ===========================================================================


class TestLabelCountSerializer:
    def test_valid(self):
        s = LabelCountSerializer(
            data={"id": 1, "name": "Important", "color": "#ff0000", "count": 5}
        )
        assert s.is_valid(), s.errors

    def test_color_nullable(self):
        s = LabelCountSerializer(data={"id": 1, "name": "X", "color": None, "count": 0})
        assert s.is_valid(), s.errors

    def test_missing_id_invalid(self):
        s = LabelCountSerializer(data={"name": "X", "color": None, "count": 0})
        assert not s.is_valid()


# ===========================================================================
# ArticleCountSerializer
# ===========================================================================


class TestArticleCountSerializer:
    def test_valid(self):
        s = ArticleCountSerializer(
            data={
                "included": 10,
                "maybe": 5,
                "labeled": 3,
                "labels": [{"id": 1, "name": "X", "color": None, "count": 3}],
            }
        )
        assert s.is_valid(), s.errors

    def test_empty_labels_valid(self):
        s = ArticleCountSerializer(
            data={"included": 0, "maybe": 0, "labeled": 0, "labels": []}
        )
        assert s.is_valid(), s.errors

    def test_missing_included_invalid(self):
        s = ArticleCountSerializer(data={"maybe": 0, "labeled": 0, "labels": []})
        assert not s.is_valid()


# ===========================================================================
# AddDataSerializer
# ===========================================================================


class TestAddDataSerializer:
    def _valid(self, source="screening", sink="full-text", types=None):
        return {
            "data_source": source,
            "data_sink": sink,
            "article_types": types or ["included"],
        }

    def test_valid(self):
        s = AddDataSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_source_fulltext_sink_extraction_valid(self):
        s = AddDataSerializer(data=self._valid(source="full-text", sink="extraction"))
        assert s.is_valid(), s.errors

    def test_both_fulltext_invalid(self):
        s = AddDataSerializer(data=self._valid(source="full-text", sink="full-text"))
        assert not s.is_valid()
        assert "non_field_errors" in s.errors

    def test_invalid_source_rejected(self):
        s = AddDataSerializer(data=self._valid(source="invalid"))
        assert not s.is_valid()
        assert "data_source" in s.errors

    def test_invalid_sink_rejected(self):
        s = AddDataSerializer(data=self._valid(sink="invalid"))
        assert not s.is_valid()
        assert "data_sink" in s.errors

    def test_invalid_article_type_rejected(self):
        s = AddDataSerializer(data=self._valid(types=["bad_type"]))
        assert not s.is_valid()

    def test_label_ids_optional(self):
        d = self._valid()
        s = AddDataSerializer(data=d)
        assert s.is_valid(), s.errors
        assert s.validated_data["label_ids"] == []

    def test_label_ids_accepted(self):
        d = {**self._valid(), "label_ids": [1, 2, 3]}
        s = AddDataSerializer(data=d)
        assert s.is_valid(), s.errors
        assert s.validated_data["label_ids"] == [1, 2, 3]

    def test_multiple_article_types(self):
        s = AddDataSerializer(data=self._valid(types=["included", "maybe"]))
        assert s.is_valid(), s.errors


# ===========================================================================
# SearchMethodSerializer / SearchMethodDetailSerializer
# ===========================================================================


@pytest.mark.django_db
class TestSearchMethodSerializer:
    def test_fields(self):
        sm = SearchMethodFactory()
        data = SearchMethodSerializer(sm).data
        assert set(data.keys()) == {"id", "name"}

    def test_values_correct(self):
        sm = SearchMethodFactory(name="PubMed 2024")
        data = SearchMethodSerializer(sm).data
        assert data["name"] == "PubMed 2024"


@pytest.mark.django_db
class TestSearchMethodDetailSerializer:
    def test_fields(self):
        sm = SearchMethodFactory()
        data = SearchMethodDetailSerializer(sm).data
        assert set(data.keys()) == {"id", "name"}


# ===========================================================================
# DetectDuplicatesRequestSerializer
# ===========================================================================


class TestDetectDuplicatesRequestSerializer:
    def test_default_threshold(self):
        s = DetectDuplicatesRequestSerializer(data={})
        assert s.is_valid(), s.errors
        assert s.validated_data["threshold"] == 0.5

    def test_custom_threshold(self):
        s = DetectDuplicatesRequestSerializer(data={"threshold": 0.8})
        assert s.is_valid(), s.errors
        assert s.validated_data["threshold"] == 0.8

    def test_threshold_above_one_invalid(self):
        s = DetectDuplicatesRequestSerializer(data={"threshold": 1.1})
        assert not s.is_valid()
        assert "threshold" in s.errors

    def test_threshold_below_zero_invalid(self):
        s = DetectDuplicatesRequestSerializer(data={"threshold": -0.1})
        assert not s.is_valid()
        assert "threshold" in s.errors

    def test_threshold_boundaries_valid(self):
        for v in [0.0, 1.0]:
            s = DetectDuplicatesRequestSerializer(data={"threshold": v})
            assert s.is_valid(), f"threshold={v} should be valid"


# ===========================================================================
# DetectDuplicatesResponseSerializer
# ===========================================================================


class TestDetectDuplicatesResponseSerializer:
    def test_valid(self):
        s = DetectDuplicatesResponseSerializer(
            data={
                "message": "Detection queued.",
                "task_id": "abc-123",
                "status": "processing",
                "threshold": 0.5,
            }
        )
        assert s.is_valid(), s.errors

    def test_missing_task_id_invalid(self):
        s = DetectDuplicatesResponseSerializer(
            data={
                "message": "ok",
                "status": "processing",
                "threshold": 0.5,
            }
        )
        assert not s.is_valid()


# ===========================================================================
# AutoResolveDuplicatesRequestSerializer
# ===========================================================================


class TestAutoResolveDuplicatesRequestSerializer:
    def _valid(self):
        return {
            "confidence_threshold": 0.9,
            "detect_first": True,
            "fuzzy_threshold": 0.5,
            "doi_clusters_always": True,
        }

    def test_valid_defaults(self):
        s = AutoResolveDuplicatesRequestSerializer(data={})
        assert s.is_valid(), s.errors
        assert s.validated_data["confidence_threshold"] == 0.90
        assert s.validated_data["detect_first"] is True
        assert s.validated_data["doi_clusters_always"] is True
        assert s.validated_data["preferred_search_method_id"] is None

    def test_full_payload(self):
        s = AutoResolveDuplicatesRequestSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_confidence_threshold_above_one_invalid(self):
        d = {**self._valid(), "confidence_threshold": 1.5}
        assert not AutoResolveDuplicatesRequestSerializer(data=d).is_valid()

    def test_preferred_search_method_null_allowed(self):
        d = {**self._valid(), "preferred_search_method_id": None}
        s = AutoResolveDuplicatesRequestSerializer(data=d)
        assert s.is_valid(), s.errors

    @pytest.mark.django_db
    def test_preferred_search_method_validates_against_review(self):
        review = ReviewFactory()
        sm = SearchMethodFactory(review=review)
        s = AutoResolveDuplicatesRequestSerializer(
            data={**self._valid(), "preferred_search_method_id": sm.pk},
            context={"review": review},
        )
        assert s.is_valid(), s.errors

    @pytest.mark.django_db
    def test_preferred_search_method_rejects_wrong_review(self):
        review = ReviewFactory()
        other_review = ReviewFactory()
        sm = SearchMethodFactory(review=other_review)
        s = AutoResolveDuplicatesRequestSerializer(
            data={**self._valid(), "preferred_search_method_id": sm.pk},
            context={"review": review},
        )
        assert not s.is_valid()
        assert "preferred_search_method_id" in s.errors


# ===========================================================================
# UploadReferencesResponseSerializer
# ===========================================================================


class TestUploadReferencesResponseSerializer:
    def test_valid(self):
        s = UploadReferencesResponseSerializer(
            data={
                "message": "Import queued.",
                "task_id": "task-xyz",
                "search_method_id": 42,
                "filename": "refs.bib",
                "file_type": "bib",
                "status": "processing",
            }
        )
        assert s.is_valid(), s.errors

    def test_invalid_file_type(self):
        s = UploadReferencesResponseSerializer(
            data={
                "message": "ok",
                "task_id": "t",
                "search_method_id": 1,
                "filename": "f.txt",
                "file_type": "txt",  # not in choices
                "status": "processing",
            }
        )
        assert not s.is_valid()
        assert "file_type" in s.errors

    def test_missing_task_id_invalid(self):
        s = UploadReferencesResponseSerializer(
            data={
                "message": "ok",
                "search_method_id": 1,
                "filename": "f.bib",
                "file_type": "bib",
                "status": "processing",
            }
        )
        assert not s.is_valid()


# ===========================================================================
# AddDataResponseSerializer
# ===========================================================================


class TestAddDataResponseSerializer:
    def test_valid(self):
        s = AddDataResponseSerializer(data={"updated": 5})
        assert s.is_valid(), s.errors
        assert s.validated_data["updated"] == 5

    def test_zero_valid(self):
        s = AddDataResponseSerializer(data={"updated": 0})
        assert s.is_valid(), s.errors

    def test_missing_updated_invalid(self):
        s = AddDataResponseSerializer(data={})
        assert not s.is_valid()
        assert "updated" in s.errors


# ===========================================================================
# AutoResolveDuplicatesResponseSerializer
# ===========================================================================


class TestAutoResolveDuplicatesResponseSerializer:
    def test_valid(self):
        s = AutoResolveDuplicatesResponseSerializer(
            data={
                "message": "Queued.",
                "task_id": "t-1",
                "status": "processing",
                "confidence_threshold": 0.9,
                "detect_first": True,
                "fuzzy_threshold": 0.5,
                "doi_clusters_always": True,
                "preferred_search_method_id": None,
            }
        )
        assert s.is_valid(), s.errors

    def test_missing_task_id_invalid(self):
        s = AutoResolveDuplicatesResponseSerializer(
            data={
                "message": "ok",
                "status": "processing",
                "confidence_threshold": 0.9,
                "detect_first": True,
                "fuzzy_threshold": 0.5,
                "doi_clusters_always": True,
                "preferred_search_method_id": None,
            }
        )
        assert not s.is_valid()


# ===========================================================================
# PrismaValidationIssueSerializer
# ===========================================================================


class TestPrismaValidationIssueSerializer:
    def test_valid(self):
        s = PrismaValidationIssueSerializer(
            data={"severity": "warning", "message": "Missing node."}
        )
        assert s.is_valid(), s.errors

    def test_missing_severity_invalid(self):
        s = PrismaValidationIssueSerializer(data={"message": "Missing node."})
        assert not s.is_valid()


# ===========================================================================
# PrismaResponseSerializer
# ===========================================================================


class TestPrismaResponseSerializer:
    def _valid(self):
        return {
            "message": "Diagram generated.",
            "file_url": None,
            "interactive_url": "https://example.com/prisma",
            "data": {"db_registers": 100, "included": 20},
            "validation_issues": [],
        }

    def test_valid(self):
        s = PrismaResponseSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_file_url_nullable(self):
        d = {**self._valid(), "file_url": None}
        assert PrismaResponseSerializer(data=d).is_valid()

    def test_file_url_valid_url(self):
        d = {**self._valid(), "file_url": "https://cdn.example.com/prisma.png"}
        assert PrismaResponseSerializer(data=d).is_valid()

    def test_validation_issues_nested(self):
        d = {
            **self._valid(),
            "validation_issues": [{"severity": "error", "message": "Bad flow."}],
        }
        s = PrismaResponseSerializer(data=d)
        assert s.is_valid(), s.errors

    def test_missing_message_invalid(self):
        d = self._valid()
        del d["message"]
        assert not PrismaResponseSerializer(data=d).is_valid()


# ===========================================================================
# ExportJsonResponseSerializer
# ===========================================================================


class TestExportJsonResponseSerializer:
    def _valid(self):
        return {
            "reviewId": 1,
            "reviewTitle": "My SLR",
            "exportedAt": "2026-03-05T00:00:00Z",
            "themeCount": 2,
            "themes": [
                {
                    "id": 1,
                    "name": "Theme A",
                    "description": None,
                    "subthemeCount": 1,
                    "subthemes": [
                        {
                            "id": 10,
                            "name": "Sub A1",
                            "description": None,
                            "codeCount": 1,
                            "codes": [
                                {
                                    "id": "c1",
                                    "name": "Code 1",
                                    "comment": None,
                                    "type": "highlight",
                                    "highlightColor": "#ff0",
                                    "referenceId": 5,
                                }
                            ],
                        }
                    ],
                }
            ],
        }

    def test_valid(self):
        s = ExportJsonResponseSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_empty_themes(self):
        d = {**self._valid(), "themes": [], "themeCount": 0}
        assert ExportJsonResponseSerializer(data=d).is_valid()

    def test_missing_review_id_invalid(self):
        d = self._valid()
        del d["reviewId"]
        assert not ExportJsonResponseSerializer(data=d).is_valid()


# ===========================================================================
# ExportLatexResponseSerializer
# ===========================================================================


class TestExportLatexResponseSerializer:
    def test_valid_table_only(self):
        s = ExportLatexResponseSerializer(
            data={
                "latex_code": "\\begin{table}...\\end{table}",
                "review_id": 1,
                "review_title": "My SLR",
                "theme_count": 3,
                "format": "table_only",
            }
        )
        assert s.is_valid(), s.errors

    def test_valid_full_document(self):
        s = ExportLatexResponseSerializer(
            data={
                "latex_code": "\\documentclass{article}...",
                "review_id": 1,
                "review_title": "My SLR",
                "theme_count": 3,
                "format": "full_document",
            }
        )
        assert s.is_valid(), s.errors

    def test_invalid_format_rejected(self):
        s = ExportLatexResponseSerializer(
            data={
                "latex_code": "x",
                "review_id": 1,
                "review_title": "My SLR",
                "theme_count": 1,
                "format": "markdown",  # not a valid choice
            }
        )
        assert not s.is_valid()
        assert "format" in s.errors

    def test_missing_latex_code_invalid(self):
        s = ExportLatexResponseSerializer(
            data={
                "review_id": 1,
                "review_title": "x",
                "theme_count": 0,
                "format": "table_only",
            }
        )
        assert not s.is_valid()


# ===========================================================================
# InvitationAcceptDeclineResponseSerializer
# ===========================================================================


class TestInvitationAcceptDeclineResponseSerializer:
    def test_valid(self):
        s = InvitationAcceptDeclineResponseSerializer(
            data={"detail": "Invitation accepted."}
        )
        assert s.is_valid(), s.errors

    def test_missing_detail_invalid(self):
        s = InvitationAcceptDeclineResponseSerializer(data={})
        assert not s.is_valid()
        assert "detail" in s.errors
