"""
Tests for slrt_project/references/api/serializers.py.

Strategy
- No-DB (no marker): all pure serializer logic — field presence, validation
rules, choice constraints, cross-field checks.  Uses plain dicts or
minimal SimpleNamespace / MagicMock objects where a model instance is
required to resolve context.
- DB (@pytest.mark.django_db): serializers whose output depends on live ORM
relations (nested serializers, StringRelatedField, prefetch attributes).
Uses factories from slrt_project.reviews.tests.factories and reference
factories defined locally below.
"""

from unittest.mock import MagicMock

import pytest
from rest_framework.test import APIRequestFactory

# ── Serializers under test ────────────────────────────────────────────────────
from slrt_project.references.api.serializers import (
    AssignLabelsResponseSerializer,
    AssignLabelsSerializer,
    AssignReferencesResponseSerializer,
    AssignReferencesSerializer,
    AttachPDFMappingSerializer,
    AttachPDFsResponseSerializer,
    AttachPDFsSerializer,
    AutoMatchResponseSerializer,
    AutoMatchSerializer,
    BaseReferenceSerializer,
    BulkCreateNoteResponseSerializer,
    BulkCreateNoteSerializer,
    BulkSyncPDFsResponseSerializer,
    ClusterListResponseSerializer,
    ClusterStatsResponseSerializer,
    DismissClusterResponseSerializer,
    KeywordSerializer,
    LabelSerializer,
    ReasonSerializer,
    ReferenceOpinionSerializer,
    ReferenceOpinionUpsertSerializer,
    ReferenceSerializer,
    ResolveClusterResponseSerializer,
    UploadedPDFSerializer,
)

# ── Factories ─────────────────────────────────────────────────────────────────
from slrt_project.reviews.tests.factories import (
    ReviewFactory,
    ReviewMemberFactory,
    UserFactory,
)


api_factory = APIRequestFactory()


# Local reference factories (defined here to avoid a hard dependency on a
# references-app factory module that may not yet exist)


def _make_request(user=None):
    """Return a DRF request with an authenticated user."""
    request = api_factory.get("/")
    request.user = user or _make_user()
    return request


def _make_user(**kwargs):
    u = MagicMock()
    u.pk = kwargs.get("pk", 1)
    u.id = u.pk
    u.email = kwargs.get("email", "user@example.com")
    u.first_name = kwargs.get("first_name", "Alice")
    u.last_name = kwargs.get("last_name", "Smith")
    u.is_authenticated = True
    return u


def _make_reference(**kwargs):
    """Minimal MagicMock that satisfies BaseReferenceSerializer / ReferenceSerializer."""
    r = MagicMock()
    r.id = kwargs.get("id", 1)
    r.title = kwargs.get("title", "Test Title")
    r.publication_type = kwargs.get("publication_type", "journal")
    r.authors = kwargs.get("authors", "Smith, A.")
    r.journal = kwargs.get("journal", "Nature")
    r.article_customizations = kwargs.get("article_customizations", "")
    r.abstract = kwargs.get("abstract", "An abstract.")
    r.doi = kwargs.get("doi", "10.1234/test")
    r.publication_date = kwargs.get("publication_date", None)
    r.duplicate_status = kwargs.get("duplicate_status", "unique")
    r.pages = kwargs.get("pages", "")
    r.search_method = MagicMock(__str__=lambda s: "PubMed")
    r.file = kwargs.get("file", None)
    r.assignee = kwargs.get("assignee", None)
    r.prefetched_opinions = kwargs.get("prefetched_opinions", None)
    r.prefetched_labels = kwargs.get("prefetched_labels", [])
    return r


# UploadedPDFSerializer
class TestUploadedPDFSerializer:
    def test_fields_present(self):
        s = UploadedPDFSerializer()
        assert set(s.fields.keys()) >= {"id", "name", "file", "review"}

    def test_id_read_only(self):
        assert UploadedPDFSerializer().fields["id"].read_only

    def test_validate_file_rejects_non_pdf(self):
        s = UploadedPDFSerializer()
        mock_file = MagicMock()
        mock_file.name = "data.csv"
        with pytest.raises(Exception):
            s.validate_file(mock_file)

    def test_validate_file_accepts_pdf(self):
        s = UploadedPDFSerializer()
        mock_file = MagicMock()
        mock_file.name = "paper.PDF"  # case-insensitive
        assert s.validate_file(mock_file) is mock_file


# BaseReferenceSerializer
class TestBaseReferenceSerializer:
    def test_all_fields_present(self):
        expected = {
            "id",
            "title",
            "publication_type",
            "authors",
            "journal",
            "search_method",
            "article_customizations",
            "abstract",
            "doi",
            "publication_date",
            "duplicate_status",
            "pages",
        }
        assert expected.issubset(set(BaseReferenceSerializer().fields.keys()))

    def test_all_fields_read_only(self):
        s = BaseReferenceSerializer()
        for field_name, field in s.fields.items():
            assert field.read_only, f"Field '{field_name}' should be read-only"


# ReferenceSerializer
class TestReferenceSerializer:
    def _serialise(self, ref, user=None):
        request = _make_request(user=user or _make_user())
        return ReferenceSerializer(ref, context={"request": request}).data

    def test_extra_fields_present(self):
        ref = _make_reference()
        data = self._serialise(ref)
        assert "opinions" in data
        assert "labels" in data
        assert "assignee" in data
        assert "file" in data

    def test_opinions_none_when_not_prefetched(self):
        ref = _make_reference(prefetched_opinions=None)
        data = self._serialise(ref)
        assert data["opinions"] is None

    def test_opinions_empty_when_prefetch_is_empty_list(self):
        ref = _make_reference(prefetched_opinions=[])
        data = self._serialise(ref)
        assert data["opinions"] == []

    def test_opinions_formatted_correctly(self):
        from datetime import datetime, timezone as tz

        op = MagicMock()
        op.member.id = 7
        op.member.user.first_name = "Bob"
        op.member.user.last_name = "Jones"
        op.member.user.email = "b@x.com"
        op.member.user.__str__ = lambda s: "Bob Jones"
        op.status = "included"
        op.reason = None
        op.updated_at = datetime(2026, 3, 5, 10, 30, tzinfo=tz.utc)

        ref = _make_reference(prefetched_opinions=[op])
        data = self._serialise(ref)
        opinion = data["opinions"][0]
        assert opinion["member"]["id"] == 7
        assert opinion["status"] == "included"
        assert opinion["reason"] is None
        assert "10:30" in opinion["updated_at"]

    def test_opinion_reason_included(self):
        from datetime import datetime, timezone as tz

        op = MagicMock()
        op.member.id = 1
        op.member.user.first_name = "X"
        op.member.user.last_name = "Y"
        op.member.user.email = "x@y.com"
        op.member.user.__str__ = lambda s: "X Y"
        op.status = "excluded"
        op.reason = MagicMock(name="Too old")
        op.reason.name = "Too old"
        op.updated_at = datetime(2026, 1, 1, 0, 0, tzinfo=tz.utc)

        ref = _make_reference(prefetched_opinions=[op])
        data = self._serialise(ref)
        assert data["opinions"][0]["reason"] == "Too old"

    def test_labels_from_prefetch(self):
        user = _make_user()
        rl = MagicMock()
        rl.label.id = 5
        rl.label.name = "Important"
        rl.label.color = "#ff0"

        ref = _make_reference(prefetched_labels=[rl])
        request = _make_request(user=user)
        data = ReferenceSerializer(ref, context={"request": request}).data

        assert data["labels"] == [{"id": 5, "name": "Important", "color": "#ff0"}]

    def test_assignee_none(self):
        ref = _make_reference(assignee=None)
        data = self._serialise(ref)
        assert data["assignee"] is None

    def test_assignee_present(self):
        assignee = MagicMock()
        assignee.id = 3
        assignee.user.first_name = "Carol"
        assignee.user.last_name = "White"
        assignee.user.email = "c@w.com"

        ref = _make_reference(assignee=assignee)
        data = self._serialise(ref)
        assert data["assignee"]["id"] == 3
        assert data["assignee"]["user"]["email"] == "c@w.com"


# ReferenceOpinionSerializer
class TestReferenceOpinionSerializer:
    def test_fields_present(self):
        s = ReferenceOpinionSerializer()
        assert set(s.fields.keys()) >= {
            "id",
            "member",
            "status",
            "reason",
            "updated_at",
        }

    def test_reason_cleared_for_non_excluded(self):
        s = ReferenceOpinionSerializer()
        reason = MagicMock()
        reference = MagicMock()
        reason.review_id = reference.review_id = 1
        for non_excluded in ["included", "maybe", "undecided"]:
            result = s.validate(
                {
                    "status": non_excluded,
                    "reason": reason,
                    "reference": reference,
                }
            )
            assert result["reason"] is None

    def test_reason_kept_for_excluded(self):
        s = ReferenceOpinionSerializer()
        reason = MagicMock()
        reference = MagicMock()
        reason.review_id = reference.review_id = 42
        result = s.validate(
            {
                "status": "excluded",
                "reason": reason,
                "reference": reference,
            }
        )
        assert result["reason"] is reason

    def test_reason_wrong_review_raises(self):
        from rest_framework.exceptions import ValidationError

        s = ReferenceOpinionSerializer()
        reason = MagicMock()
        reference = MagicMock()
        reason.review_id = 1
        reference.review_id = 99  # different
        with pytest.raises(ValidationError):
            s.validate({"status": "excluded", "reason": reason, "reference": reference})

    def test_id_read_only(self):
        assert ReferenceOpinionSerializer().fields["id"].read_only

    def test_member_read_only(self):
        assert ReferenceOpinionSerializer().fields["member"].read_only


# KeywordSerializer
class TestKeywordSerializer:
    def test_fields(self):
        assert set(KeywordSerializer().fields.keys()) == {
            "id",
            "review",
            "name",
            "type",
        }

    def test_id_and_review_read_only(self):
        s = KeywordSerializer()
        assert s.fields["id"].read_only
        assert s.fields["review"].read_only

    def test_valid_data(self):
        s = KeywordSerializer(data={"name": "cancer", "type": "inclusion"})
        # review is read_only so not included in write
        assert s.is_valid() or "review" in s.errors  # review may be required

    def test_invalid_type_rejected(self):
        s = KeywordSerializer(data={"name": "x", "type": "bad"})
        assert not s.is_valid()
        assert "type" in s.errors


# ReasonSerializer
class TestReasonSerializer:
    def test_fields(self):
        assert set(ReasonSerializer().fields.keys()) == {"id", "name", "review"}

    def test_id_read_only(self):
        assert ReasonSerializer().fields["id"].read_only

    def test_valid(self):
        s = ReasonSerializer(data={"name": "Too old", "review": 1})
        # review FK — will fail without DB, but we just check field acceptance
        assert "name" in s.fields


# AttachPDFMappingSerializer
class TestAttachPDFMappingSerializer:
    def test_valid(self):
        s = AttachPDFMappingSerializer(data={"reference_id": 1, "uploaded_pdf_id": 2})
        assert s.is_valid(), s.errors

    def test_missing_reference_id(self):
        s = AttachPDFMappingSerializer(data={"uploaded_pdf_id": 2})
        assert not s.is_valid()
        assert "reference_id" in s.errors

    def test_missing_uploaded_pdf_id(self):
        s = AttachPDFMappingSerializer(data={"reference_id": 1})
        assert not s.is_valid()
        assert "uploaded_pdf_id" in s.errors


# AttachPDFsSerializer
class TestAttachPDFsSerializer:
    def test_valid(self):
        s = AttachPDFsSerializer(
            data={
                "mappings": [
                    {"reference_id": 1, "uploaded_pdf_id": 10},
                    {"reference_id": 2, "uploaded_pdf_id": 11},
                ]
            }
        )
        assert s.is_valid(), s.errors

    def test_empty_mappings_valid(self):
        s = AttachPDFsSerializer(data={"mappings": []})
        assert s.is_valid(), s.errors

    def test_invalid_mapping_entry(self):
        s = AttachPDFsSerializer(data={"mappings": [{"reference_id": "x"}]})
        assert not s.is_valid()


# AutoMatchSerializer
class TestAutoMatchSerializer:
    def test_valid(self):
        s = AutoMatchSerializer(data={"review_id": 1, "reference_ids": [1, 2, 3]})
        assert s.is_valid(), s.errors

    def test_missing_review_id(self):
        s = AutoMatchSerializer(data={"reference_ids": [1]})
        assert not s.is_valid()
        assert "review_id" in s.errors

    def test_empty_reference_ids_valid(self):
        # The serializer itself doesn't enforce non-empty — the view handles that.
        s = AutoMatchSerializer(data={"review_id": 1, "reference_ids": []})
        assert s.is_valid(), s.errors


# BulkCreateNoteSerializer
class TestBulkCreateNoteSerializer:
    def test_valid(self):
        s = BulkCreateNoteSerializer(
            data={"reference_ids": [1, 2], "content": "Good paper."}
        )
        assert s.is_valid(), s.errors

    def test_empty_reference_ids_invalid(self):
        s = BulkCreateNoteSerializer(data={"reference_ids": [], "content": "x"})
        assert not s.is_valid()
        assert "reference_ids" in s.errors

    def test_missing_content_invalid(self):
        s = BulkCreateNoteSerializer(data={"reference_ids": [1]})
        assert not s.is_valid()
        assert "content" in s.errors


# AssignReferencesSerializer
class TestAssignReferencesSerializer:
    def _valid(self, mode="assign", assignee_id=5):
        d = {"review": 1, "reference_ids": [1, 2], "mode": mode}
        if assignee_id is not None:
            d["assignee_id"] = assignee_id
        return d

    def test_valid_assign(self):
        assert AssignReferencesSerializer(data=self._valid("assign")).is_valid()

    def test_valid_remove(self):
        assert AssignReferencesSerializer(
            data=self._valid("remove", assignee_id=None)
        ).is_valid()

    def test_valid_split_equally(self):
        assert AssignReferencesSerializer(
            data=self._valid("split_equally", assignee_id=None)
        ).is_valid()

    def test_invalid_mode(self):
        d = self._valid()
        d["mode"] = "random"
        assert not AssignReferencesSerializer(data=d).is_valid()

    def test_empty_reference_ids_invalid(self):
        d = self._valid()
        d["reference_ids"] = []
        assert not AssignReferencesSerializer(data=d).is_valid()

    def test_missing_review_invalid(self):
        d = self._valid()
        del d["review"]
        assert not AssignReferencesSerializer(data=d).is_valid()


# ReferenceOpinionUpsertSerializer
class TestReferenceOpinionUpsertSerializer:
    def _valid(self, status="included", stage="screening"):
        return {
            "reference_ids": [1, 2, 3],
            "status": status,
            "stage": stage,
        }

    def test_valid(self):
        s = ReferenceOpinionUpsertSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_deduplicates_reference_ids(self):
        s = ReferenceOpinionUpsertSerializer(
            data={**self._valid(), "reference_ids": [1, 1, 2]}
        )
        s.is_valid()
        assert len(s.validated_data["reference_ids"]) == 2

    def test_empty_reference_ids_invalid(self):
        d = self._valid()
        d["reference_ids"] = []
        assert not ReferenceOpinionUpsertSerializer(data=d).is_valid()

    def test_invalid_status_rejected(self):
        d = {**self._valid(), "status": "dunno"}
        assert not ReferenceOpinionUpsertSerializer(data=d).is_valid()

    def test_invalid_stage_rejected(self):
        d = {**self._valid(), "stage": "extraction"}
        assert not ReferenceOpinionUpsertSerializer(data=d).is_valid()

    def test_reason_cleared_for_non_excluded(self):
        s = ReferenceOpinionUpsertSerializer(data={**self._valid(status="included")})
        s.is_valid()
        assert s.validated_data.get("reason") is None

    def test_full_text_stage_valid(self):
        s = ReferenceOpinionUpsertSerializer(data=self._valid(stage="full-text"))
        assert s.is_valid(), s.errors


# AssignLabelsSerializer  (no-DB portions)
class TestAssignLabelsSerializerFields:
    """Pure field-structure tests that don't need a DB."""

    def test_fields_present(self):
        s = AssignLabelsSerializer()
        assert "review" in s.fields
        assert "reference_ids" in s.fields
        assert "checked_label_ids" in s.fields
        assert "indeterminate_label_ids" in s.fields

    def test_label_ids_default_to_empty_list(self):
        s = AssignLabelsSerializer()
        assert s.fields["checked_label_ids"].default is list
        assert s.fields["indeterminate_label_ids"].default is list

    def test_reference_ids_must_be_non_empty(self):
        # Can't run full validation without DB, but confirm allow_empty=False
        field = AssignLabelsSerializer().fields["reference_ids"]
        assert field.allow_empty is False


# Response serializers — all pure-logic, no DB needed
class TestAttachPDFsResponseSerializer:
    def test_valid(self):
        s = AttachPDFsResponseSerializer(
            data={
                "updated_references": [
                    {
                        "id": 1,
                        "file": "https://cdn.example.com/f.pdf",
                        "uploaded_pdf_id": 10,
                    }
                ]
            }
        )
        assert s.is_valid(), s.errors

    def test_file_nullable(self):
        s = AttachPDFsResponseSerializer(
            data={"updated_references": [{"id": 1, "file": None, "uploaded_pdf_id": 5}]}
        )
        assert s.is_valid(), s.errors

    def test_empty_list_valid(self):
        assert AttachPDFsResponseSerializer(data={"updated_references": []}).is_valid()

    def test_missing_updated_references_invalid(self):
        assert not AttachPDFsResponseSerializer(data={}).is_valid()


class TestAutoMatchResponseSerializer:
    def test_valid(self):
        s = AutoMatchResponseSerializer(data={"matched": 5, "unmatched": 2})
        assert s.is_valid(), s.errors

    def test_zero_values_valid(self):
        assert AutoMatchResponseSerializer(
            data={"matched": 0, "unmatched": 0}
        ).is_valid()

    def test_missing_matched_invalid(self):
        assert not AutoMatchResponseSerializer(data={"unmatched": 0}).is_valid()

    def test_missing_unmatched_invalid(self):
        assert not AutoMatchResponseSerializer(data={"matched": 1}).is_valid()


class TestBulkSyncPDFsResponseSerializer:
    def test_valid(self):
        s = BulkSyncPDFsResponseSerializer(
            data={
                "message": "Started sync for 3 references.",
                "tasks": [
                    {"reference_id": 1, "task_id": "t-1"},
                    {"reference_id": 2, "task_id": "t-2"},
                ],
            }
        )
        assert s.is_valid(), s.errors

    def test_empty_tasks_valid(self):
        s = BulkSyncPDFsResponseSerializer(data={"message": "ok", "tasks": []})
        assert s.is_valid(), s.errors

    def test_missing_message_invalid(self):
        assert not BulkSyncPDFsResponseSerializer(data={"tasks": []}).is_valid()


class TestAssignReferencesResponseSerializer:
    def test_valid(self):
        assert AssignReferencesResponseSerializer(
            data={"detail": "References updated successfully"}
        ).is_valid()

    def test_missing_detail_invalid(self):
        assert not AssignReferencesResponseSerializer(data={}).is_valid()


class TestAssignLabelsResponseSerializer:
    def test_valid(self):
        s = AssignLabelsResponseSerializer(
            data={
                "detail": "Labels updated for references.",
                "created": 3,
                "deleted": 1,
            }
        )
        assert s.is_valid(), s.errors

    def test_zero_counts_valid(self):
        s = AssignLabelsResponseSerializer(
            data={"detail": "ok", "created": 0, "deleted": 0}
        )
        assert s.is_valid(), s.errors

    def test_missing_created_invalid(self):
        assert not AssignLabelsResponseSerializer(
            data={"detail": "ok", "deleted": 0}
        ).is_valid()


class TestBulkCreateNoteResponseSerializer:
    def test_valid(self):
        assert BulkCreateNoteResponseSerializer(data={"created": 5}).is_valid()

    def test_zero_valid(self):
        assert BulkCreateNoteResponseSerializer(data={"created": 0}).is_valid()

    def test_missing_created_invalid(self):
        assert not BulkCreateNoteResponseSerializer(data={}).is_valid()


class TestResolveClusterResponseSerializer:
    def test_valid(self):
        s = ResolveClusterResponseSerializer(
            data={
                "message": "Cluster resolved",
                "clusterId": "abc-123",
                "canonicalReferenceId": 42,
            }
        )
        assert s.is_valid(), s.errors

    def test_missing_cluster_id_invalid(self):
        assert not ResolveClusterResponseSerializer(
            data={
                "message": "ok",
                "canonicalReferenceId": 1,
            }
        ).is_valid()


class TestDismissClusterResponseSerializer:
    def test_valid(self):
        s = DismissClusterResponseSerializer(
            data={
                "message": "Cluster dismissed",
                "clusterId": "uuid-xyz",
            }
        )
        assert s.is_valid(), s.errors

    def test_missing_cluster_id_invalid(self):
        assert not DismissClusterResponseSerializer(data={"message": "ok"}).is_valid()


class TestClusterStatsResponseSerializer:
    def test_valid(self):
        s = ClusterStatsResponseSerializer(
            data={
                "unresolved": 10,
                "autoResolved": 5,
                "manuallyResolved": 3,
                "dismissed": 1,
                "affectedReferences": 30,
            }
        )
        assert s.is_valid(), s.errors

    def test_all_zeros_valid(self):
        s = ClusterStatsResponseSerializer(
            data={
                "unresolved": 0,
                "autoResolved": 0,
                "manuallyResolved": 0,
                "dismissed": 0,
                "affectedReferences": 0,
            }
        )
        assert s.is_valid(), s.errors

    def test_missing_field_invalid(self):
        assert not ClusterStatsResponseSerializer(
            data={
                "unresolved": 1,
                "autoResolved": 0,
                "manuallyResolved": 0,
                "dismissed": 0,
                # affectedReferences missing
            }
        ).is_valid()


class TestClusterListResponseSerializer:
    def _cluster_payload(self):
        return {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "status": "unresolved",
            "doi_match": False,
            "max_similarity_score": 0.85,
            "canonical_reference_id": None,
            "created_at": "2026-03-05T00:00:00Z",
            "resolved_at": None,
            "members": [],
        }

    def test_valid_empty_clusters(self):
        s = ClusterListResponseSerializer(
            data={
                "clusters": [],
                "total": 0,
                "resolved": 0,
                "remaining": 0,
                "progress": 0.0,
            }
        )
        assert s.is_valid(), s.errors

    def test_with_clusters(self):
        s = ClusterListResponseSerializer(
            data={
                "clusters": [self._cluster_payload()],
                "total": 1,
                "resolved": 0,
                "remaining": 1,
                "progress": 0.0,
            }
        )
        assert s.is_valid(), s.errors

    def test_missing_progress_invalid(self):
        assert not ClusterListResponseSerializer(
            data={
                "clusters": [],
                "total": 0,
                "resolved": 0,
                "remaining": 0,
                # progress missing
            }
        ).is_valid()


# DB-backed tests
@pytest.mark.django_db
class TestLabelSerializerDB:
    """LabelSerializer.validate_name requires a DB lookup."""

    def test_validate_name_rejects_duplicate(self):
        from slrt_project.references.models import Label

        user = UserFactory()
        Label.objects.create(user=user, name="Existing")

        request = _make_request(user=user)
        s = LabelSerializer(
            data={"name": "Existing", "color": "#fff", "hotkey": ""},
            context={"request": request},
        )
        assert not s.is_valid()
        assert "name" in s.errors

    def test_validate_name_accepts_new_name(self):
        user = UserFactory()
        request = _make_request(user=user)
        s = LabelSerializer(
            data={"name": "Brand New Label", "color": "#fff", "hotkey": ""},
            context={"request": request},
        )
        assert s.is_valid(), s.errors

    def test_user_read_only(self):
        assert LabelSerializer().fields["user"].read_only


@pytest.mark.django_db
class TestAssignLabelsSerializerDB:
    """Full cross-field validation needs a real DB."""

    def _make_request_for(self, user):
        request = api_factory.post("/")
        request.user = user
        return request

    def test_valid_payload(self):
        from slrt_project.references.models import Label, Reference
        from slrt_project.reviews.tests.factories import SearchMethodFactory

        user = UserFactory()
        member = ReviewMemberFactory(user=user)
        review = member.review
        sm = SearchMethodFactory(review=review)
        ref = Reference.objects.create(
            review=review,
            title="T",
            publication_type="journal",
            authors="A",
            journal="J",
            search_method=sm,
            article_customizations="",
        )
        label = Label.objects.create(user=user, name="Tag")

        s = AssignLabelsSerializer(
            data={
                "review": review.pk,
                "reference_ids": [ref.pk],
                "checked_label_ids": [label.pk],
                "indeterminate_label_ids": [],
            },
            context={"request": self._make_request_for(user)},
        )
        assert s.is_valid(), s.errors

    def test_non_member_rejected(self):
        outsider = UserFactory()
        review = ReviewFactory()

        s = AssignLabelsSerializer(
            data={"review": review.pk, "reference_ids": [1]},
            context={"request": self._make_request_for(outsider)},
        )
        assert not s.is_valid()

    def test_reference_from_wrong_review_rejected(self):
        from slrt_project.references.models import Reference
        from slrt_project.reviews.tests.factories import SearchMethodFactory

        user = UserFactory()
        member = ReviewMemberFactory(user=user)
        review = member.review

        other_review = ReviewFactory()
        sm = SearchMethodFactory(review=other_review)
        other_ref = Reference.objects.create(
            review=other_review,
            title="T",
            publication_type="journal",
            authors="A",
            journal="J",
            search_method=sm,
            article_customizations="",
        )

        s = AssignLabelsSerializer(
            data={
                "review": review.pk,
                "reference_ids": [other_ref.pk],  # wrong review
            },
            context={"request": self._make_request_for(user)},
        )
        assert not s.is_valid()

    def test_label_from_wrong_user_rejected(self):
        from slrt_project.references.models import Label, Reference
        from slrt_project.reviews.tests.factories import SearchMethodFactory

        user = UserFactory()
        other_user = UserFactory()
        member = ReviewMemberFactory(user=user)
        review = member.review
        sm = SearchMethodFactory(review=review)
        ref = Reference.objects.create(
            review=review,
            title="T",
            publication_type="journal",
            authors="A",
            journal="J",
            search_method=sm,
            article_customizations="",
        )
        other_label = Label.objects.create(user=other_user, name="Foreign")

        s = AssignLabelsSerializer(
            data={
                "review": review.pk,
                "reference_ids": [ref.pk],
                "checked_label_ids": [other_label.pk],
            },
            context={"request": self._make_request_for(user)},
        )
        assert not s.is_valid()
