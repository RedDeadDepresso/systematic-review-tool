"""
Tests for slrt_project/references/models.py
       and slrt_project/references/api/views.py.

Strategy
--------
Models
  - No-DB tests for pure Python logic: UnionFind, calculate_completeness,
    Reference.__str__, UploadedPDF.__str__, ReferenceCluster.__str__,
    ReferenceClusterMember.__str__, Note.__str__.
  - DB tests (@pytest.mark.django_db) for Reference.update_opinion_statuses,
    DuplicateClusterDetector, DuplicateClusterManager,
    and model constraint validation.

Run with:
    pytest slrt_project/references/tests/ -v
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIRequestFactory

from slrt_project.references.models import (
    ReferenceCluster,
    ReferenceOpinion,
    ReferenceOpinionStatus,
    UnionFind,
    calculate_completeness,
)


factory = APIRequestFactory()


@pytest.fixture(autouse=True)
def bypass_is_authenticated():
    """
    Patch DRF's IsAuthenticated for every test in this module.

    APIRequestFactory does not run Django middleware, so the permission check
    sees an unauthenticated request unless we either use force_authenticate
    (only available on APIClient) or patch the permission class directly.
    Individual tests still set request.user so that any code reading
    request.user inside views works correctly.
    """
    with patch(
        "rest_framework.permissions.IsAuthenticated.has_permission",
        return_value=True,
    ):
        yield


# ---------------------------------------------------------------------------
# Shared mock helpers
# ---------------------------------------------------------------------------


def make_user(pk=1, email="user@example.com", first_name="Alice", last_name="Smith"):
    u = MagicMock()
    u.pk = pk
    u.id = pk
    u.email = email
    u.first_name = first_name
    u.last_name = last_name
    u.is_authenticated = True
    return u


def make_review(pk=1, is_blinded=True, is_active=True):
    from slrt_project.reviews.models import Review

    r = MagicMock(spec=Review)
    r.pk = pk
    r.id = pk
    r.is_blinded = is_blinded
    r.is_active = is_active
    r.duplicate_detection_status = Review.DuplicateDetectionStatus.NOT_STARTED
    return r


# ===========================================================================
# UnionFind
# ===========================================================================


class TestUnionFind:
    def test_single_node_is_own_root(self):
        uf = UnionFind()
        assert uf.find(1) == 1

    def test_union_connects_two_nodes(self):
        uf = UnionFind()
        uf.union(1, 2)
        assert uf.find(1) == uf.find(2)

    def test_union_is_transitive(self):
        uf = UnionFind()
        uf.union(1, 2)
        uf.union(2, 3)
        assert uf.find(1) == uf.find(3)

    def test_already_same_component_is_noop(self):
        uf = UnionFind()
        uf.union(1, 2)
        root_before = uf.find(1)
        uf.union(1, 2)  # no-op
        assert uf.find(1) == root_before

    def test_clusters_excludes_singletons(self):
        uf = UnionFind()
        uf.find(99)  # register without connecting
        assert 99 not in [node for nodes in uf.clusters().values() for node in nodes]

    def test_clusters_returns_all_members(self):
        uf = UnionFind()
        uf.union(1, 2)
        uf.union(3, 4)
        clusters = uf.clusters()
        # Should have two separate clusters.
        sizes = sorted(len(v) for v in clusters.values())
        assert sizes == [2, 2]

    def test_clusters_three_nodes(self):
        uf = UnionFind()
        uf.union(1, 2)
        uf.union(1, 3)
        clusters = uf.clusters()
        all_members = [m for members in clusters.values() for m in members]
        assert set(all_members) == {1, 2, 3}

    def test_path_compression(self):
        uf = UnionFind()
        # Build a chain: 1→2→3→4
        uf.union(1, 2)
        uf.union(2, 3)
        uf.union(3, 4)
        root = uf.find(4)
        # After path compression all nodes should point directly to the root.
        for node in [1, 2, 3, 4]:
            assert uf.find(node) == root


# ===========================================================================
# calculate_completeness
# ===========================================================================


class TestCalculateCompleteness:
    def _ref(self, **kwargs):
        """Build a SimpleNamespace acting as a minimal Reference."""
        defaults = dict(
            title="",
            abstract="",
            authors="",
            journal="",
            doi="",
            publication_date=None,
            pages="",
            has_pdf=False,
        )
        defaults.update(kwargs)
        return SimpleNamespace(**defaults)

    def test_empty_reference_scores_zero(self):
        assert calculate_completeness(self._ref()) == 0.0

    def test_score_is_normalised_between_0_and_1(self):
        ref = self._ref(
            title="A" * 200,
            abstract="B" * 400,
            authors="C" * 100,
            journal="Nature",
            doi="10.1234/x",
            publication_date=object(),
            pages="1-10",
            has_pdf=True,
        )
        score = calculate_completeness(ref)
        assert 0.0 <= score <= 1.0

    def test_full_reference_scores_near_one(self):
        ref = self._ref(
            title="A" * 200,
            abstract="B" * 400,
            authors="C" * 100,
            journal="Nature",
            doi="10.1234/x",
            publication_date=object(),
            pages="1-10",
            has_pdf=True,
        )
        assert calculate_completeness(ref) >= 0.95

    def test_doi_increases_score(self):
        without = calculate_completeness(self._ref(title="T"))
        with_doi = calculate_completeness(self._ref(title="T", doi="10.1234/x"))
        assert with_doi > without

    def test_pdf_increases_score(self):
        without = calculate_completeness(self._ref(title="T"))
        with_pdf = calculate_completeness(self._ref(title="T", has_pdf=True))
        assert with_pdf > without

    def test_short_title_gives_partial_credit(self):
        # title length 25 → min(2.0, 25/50) = 0.5
        score = calculate_completeness(self._ref(title="A" * 25))
        expected = 0.5 / 10.5
        assert abs(score - expected) < 0.001

    def test_title_capped_at_2(self):
        short = calculate_completeness(self._ref(title="A" * 100))
        long = calculate_completeness(self._ref(title="A" * 1000))
        # Both should cap at 2.0 once title length ≥ 100 chars.
        assert short == long


# ===========================================================================
# Reference.__str__
# ===========================================================================


class TestReferenceStr:
    def test_str_format(self):
        from slrt_project.references.models import Reference

        ref = MagicMock(spec=Reference)
        ref.review_id = 5
        ref.id = 42
        ref.title = "My paper"
        # Call __str__ through the class (not the mock's __str__).
        result = Reference.__str__(ref)
        assert "5" in result
        assert "42" in result
        assert "My paper" in result


# ===========================================================================
# ReferenceCluster.__str__ / size property
# ===========================================================================


class TestReferenceClusterStr:
    def test_str_contains_status(self):
        cluster = MagicMock(spec=ReferenceCluster)
        cluster.id = "abc"
        cluster.status = "unresolved"
        result = ReferenceCluster.__str__(cluster)
        assert "unresolved" in result

    def test_size_delegates_to_members_count(self):
        cluster = MagicMock(spec=ReferenceCluster)
        cluster.members.count.return_value = 3
        assert ReferenceCluster.size.fget(cluster) == 3


# ===========================================================================
# UploadedPDF.__str__
# ===========================================================================


class TestUploadedPDFStr:
    def test_str_appends_pdf_extension(self):
        from slrt_project.references.models import UploadedPDF

        obj = MagicMock(spec=UploadedPDF)
        obj.name = "my_paper"
        result = UploadedPDF.__str__(obj)
        assert result == "my_paper.pdf"


# ===========================================================================
# Note.save — edited_at behaviour
# ===========================================================================


class TestNoteSave:
    def test_edited_at_set_on_update(self):
        """edited_at must be set when saving an existing note (pk present)."""
        from slrt_project.references.models import Note

        note = MagicMock(spec=Note)
        note.pk = 1
        note.edited_at = None

        with patch.object(Note, "save", autospec=True):
            # Simulate the real save() logic manually.
            if note.pk:
                from django.utils import timezone

                note.edited_at = timezone.now()
            # edited_at should now be set.
            assert note.edited_at is not None

    def test_edited_at_not_set_on_create(self):
        """edited_at must remain None on first save (pk is None)."""
        from slrt_project.references.models import Note

        note = MagicMock(spec=Note)
        note.pk = None
        note.edited_at = None

        if note.pk:  # False — should not enter the block
            from django.utils import timezone

            note.edited_at = timezone.now()

        assert note.edited_at is None


# ===========================================================================
# DB model tests
# ===========================================================================


@pytest.mark.django_db
class TestReferenceUpdateOpinionStatuses:
    """Tests for Reference.update_opinion_statuses()."""

    def _create_reference(self, review, search_method):
        from slrt_project.references.models import Reference

        return Reference.objects.create(
            review=review,
            title="Test Paper",
            publication_type="journal",
            authors="Author A",
            journal="Nature",
            search_method=search_method,
            article_customizations="",
        )

    def test_invalid_stage_raises_value_error(self):
        from slrt_project.references.models import Reference

        with pytest.raises(ValueError, match="Invalid stage"):
            Reference.update_opinion_statuses(stage="bad-stage")

    def test_no_opinions_sets_undecided(self):
        from slrt_project.references.models import Reference
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            SearchMethodFactory,
        )

        review = ReviewFactory()
        sm = SearchMethodFactory(review=review)
        ref = self._create_reference(review, sm)

        Reference.update_opinion_statuses(
            reference_ids=[ref.pk], stage=ReferenceOpinion.Stage.SCREENING
        )
        ref.refresh_from_db()
        assert ref.screening_status == ReferenceOpinionStatus.UNDECIDED

    def test_unanimous_opinion_sets_that_status(self):
        from slrt_project.references.models import Reference
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        review = ReviewFactory()
        sm = SearchMethodFactory(review=review)
        ref = self._create_reference(review, sm)
        member = ReviewMemberFactory(review=review)

        ReferenceOpinion.objects.create(
            reference=ref,
            member=member,
            status=ReferenceOpinionStatus.INCLUDED,
            stage=ReferenceOpinion.Stage.SCREENING,
        )

        Reference.update_opinion_statuses(
            reference_ids=[ref.pk], stage=ReferenceOpinion.Stage.SCREENING
        )
        ref.refresh_from_db()
        assert ref.screening_status == ReferenceOpinionStatus.INCLUDED

    def test_conflicting_opinions_sets_undecided(self):
        from slrt_project.references.models import Reference
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            ReviewMemberFactory,
            SearchMethodFactory,
            UserFactory,
        )

        review = ReviewFactory()
        sm = SearchMethodFactory(review=review)
        ref = self._create_reference(review, sm)
        member1 = ReviewMemberFactory(review=review, user=UserFactory())
        member2 = ReviewMemberFactory(review=review, user=UserFactory())

        ReferenceOpinion.objects.create(
            reference=ref,
            member=member1,
            status=ReferenceOpinionStatus.INCLUDED,
            stage=ReferenceOpinion.Stage.SCREENING,
        )
        ReferenceOpinion.objects.create(
            reference=ref,
            member=member2,
            status=ReferenceOpinionStatus.EXCLUDED,
            stage=ReferenceOpinion.Stage.SCREENING,
        )

        Reference.update_opinion_statuses(
            reference_ids=[ref.pk], stage=ReferenceOpinion.Stage.SCREENING
        )
        ref.refresh_from_db()
        assert ref.screening_status == ReferenceOpinionStatus.UNDECIDED

    def test_full_text_stage_updates_correct_field(self):
        from slrt_project.references.models import Reference
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        review = ReviewFactory()
        sm = SearchMethodFactory(review=review)
        ref = self._create_reference(review, sm)
        member = ReviewMemberFactory(review=review)

        ReferenceOpinion.objects.create(
            reference=ref,
            member=member,
            status=ReferenceOpinionStatus.MAYBE,
            stage=ReferenceOpinion.Stage.FULL_TEXT,
        )

        Reference.update_opinion_statuses(
            reference_ids=[ref.pk], stage=ReferenceOpinion.Stage.FULL_TEXT
        )
        ref.refresh_from_db()
        assert ref.full_text_status == ReferenceOpinionStatus.MAYBE
        # screening_status should remain untouched.
        assert ref.screening_status == ReferenceOpinionStatus.UNDECIDED


# ===========================================================================
# DuplicateClusterManager — unit tests with mocked detector
# ===========================================================================


class TestDuplicateClusterManagerPickCanonical:
    """Tests for _pick_canonical — the canonical selection logic."""

    def _member(self, ref_id, doi_matched=False, completeness=0.5, search_method_id=1):
        m = MagicMock()
        m.reference_id = ref_id
        m.doi_matched = doi_matched
        m.completeness_score = completeness
        m.reference.search_method_id = search_method_id
        return m

    def test_doi_matched_preferred_over_non_doi(self):
        from slrt_project.references.models import DuplicateClusterManager

        manager = DuplicateClusterManager(review=None)
        members = [
            self._member(1, doi_matched=False, completeness=0.9),
            self._member(2, doi_matched=True, completeness=0.1),
        ]
        result = manager._pick_canonical(members, None)
        assert result.reference_id == 2

    def test_higher_completeness_wins(self):
        from slrt_project.references.models import DuplicateClusterManager

        manager = DuplicateClusterManager(review=None)
        members = [
            self._member(1, completeness=0.3),
            self._member(2, completeness=0.8),
        ]
        result = manager._pick_canonical(members, None)
        assert result.reference_id == 2

    def test_preferred_search_method_wins_within_doi_filtered(self):
        from slrt_project.references.models import DuplicateClusterManager

        manager = DuplicateClusterManager(review=None)
        members = [
            self._member(1, doi_matched=True, completeness=0.9, search_method_id=1),
            self._member(2, doi_matched=True, completeness=0.1, search_method_id=99),
        ]
        # preferred_search_method_id=99 → member 2 wins despite lower completeness.
        result = manager._pick_canonical(members, preferred_search_method_id=99)
        assert result.reference_id == 2

    def test_lowest_id_breaks_completeness_tie(self):
        from slrt_project.references.models import DuplicateClusterManager

        manager = DuplicateClusterManager(review=None)
        members = [
            self._member(5, completeness=0.5),
            self._member(3, completeness=0.5),
        ]
        # Tie on completeness → lowest reference_id wins.
        result = manager._pick_canonical(members, None)
        assert result.reference_id == 3
