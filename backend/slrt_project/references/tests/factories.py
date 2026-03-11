"""
Factory classes for the references app.

Uses factory_boy with DjangoModelFactory.  Every factory writes a real DB row.

Usage examples
--------------
    # Minimal reference (review + search_method created automatically):
    ref = ReferenceFactory()

    # Reference belonging to a specific review:
    review = ReviewFactory()
    ref = ReferenceFactory(review=review)

    # IMPORTANT: search_method must belong to the same review as the reference.
    # The factory handles this automatically via LazyAttribute, but if you pass
    # an explicit review you should also pass a matching search_method:
    search_method = SearchMethodFactory(review=review)
    ref = ReferenceFactory(review=review, search_method=search_method)

    # Reference already at full-text stage:
    ref = ReferenceFactory(full_text=True)

    # Reference at extraction stage:
    ref = ReferenceFactory(extraction=True)

    # Excluded reference (screening_status set):
    ref = ReferenceFactory(excluded=True)

    # Reference with a DOI:
    ref = ReferenceFactory(doi="10.1234/example")
"""

import factory
from factory import LazyAttribute, Sequence, SubFactory, Trait
from factory.django import DjangoModelFactory

from slrt_project.references.models import Reference, ReferenceOpinionStatus
from slrt_project.reviews.tests.factories import ReviewFactory, SearchMethodFactory


class ReferenceFactory(DjangoModelFactory):
    """
    Creates a Reference with sensible bibliographic defaults.

    The ``search_method`` is always created inside the same review as the
    reference via ``LazyAttribute`` — this satisfies the implicit constraint
    that a reference's search method must belong to its review.

    Traits
    ------
    full_text   — sets in_full_text=True (promoted to full-text stage)
    extraction  — sets in_full_text=True and in_extraction=True
    excluded    — sets screening_status to EXCLUDED
    included    — sets screening_status to INCLUDED
    duplicate   — sets duplicate_status to DELETED (soft-deleted duplicate)
    """

    class Meta:
        model = Reference

    # Every reference needs a review; create a fresh one by default.
    review = SubFactory(ReviewFactory)

    # search_method MUST belong to the same review as the reference.
    # LazyAttribute reads self.review (already resolved by the time this runs)
    # so both objects share the same review FK.
    search_method = LazyAttribute(lambda o: SearchMethodFactory(review=o.review))

    # --- Bibliographic fields ---
    title = Sequence(lambda n: f"Reference Title {n}")
    authors = factory.Faker("name")
    abstract = factory.Faker("paragraph")
    journal = factory.Faker("company")
    publication_type = "journal-article"
    publication_date = None
    doi = ""
    url = ""
    pages = ""
    article_customizations = ""

    # --- Workflow flags ---
    in_full_text = False
    in_extraction = False
    is_extraction_completed = False
    duplicate_status = Reference.DuplicateStatus.UNIQUE
    assignee = None

    # --- Denormalised opinion status ---
    screening_status = ReferenceOpinionStatus.UNDECIDED
    full_text_status = ReferenceOpinionStatus.UNDECIDED

    # --- Zotero ---
    zotero_key = None
    zotero_version = 0
    last_synced = None

    class Params:
        # Promoted to the full-text review stage.
        full_text = Trait(in_full_text=True)

        # Promoted all the way to extraction.
        extraction = Trait(in_full_text=True, in_extraction=True)

        # Common opinion-status shortcuts.
        excluded = Trait(screening_status=ReferenceOpinionStatus.EXCLUDED)
        included = Trait(
            screening_status=ReferenceOpinionStatus.INCLUDED,
            in_full_text=True,
        )

        # Soft-deleted duplicate.
        duplicate = Trait(duplicate_status=Reference.DuplicateStatus.DELETED)
