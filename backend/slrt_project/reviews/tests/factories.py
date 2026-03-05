"""
Factory classes for the reviews app.

Uses factory_boy (https://factoryboy.readthedocs.io/) with DjangoModelFactory
so that every factory writes a real DB row when called, making it easy to
compose realistic object graphs in tests.

Usage examples
--------------
    # One review, one member:
    review = ReviewFactory()
    member = ReviewMemberFactory(review=review)

    # Owner member (shortcut via trait):
    owner = ReviewMemberFactory(owner=True)

    # Blinded review with a pre-created member:
    review = ReviewFactory(is_blinded=True)
    ReviewMemberFactory(review=review, role="Reviewer")

    # Stat for an existing member:
    stat = ScreeningStatFactory(member=member, seconds=3600, sessions=2)

    # System chat message:
    msg = ReviewChatMessageFactory(system=True)

    # Human chat message:
    msg = ReviewChatMessageFactory(review=review, member=member)
"""

import factory

# ---------------------------------------------------------------------------
# UserFactory
# ---------------------------------------------------------------------------
# Defined here so reviews tests are self-contained.  If your project already
# has a UserFactory elsewhere, import it instead of duplicating this one.
from django.contrib.auth import get_user_model
from factory import Faker, LazyAttribute, SubFactory, Trait
from factory.django import DjangoModelFactory

from slrt_project.reviews.models import (
    Review,
    ReviewChatMessage,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SearchMethod,
)


User = get_user_model()


class UserFactory(DjangoModelFactory):
    """Creates a regular (non-staff) user with a unique e-mail address."""

    first_name = Faker("first_name")
    last_name = Faker("last_name")
    # Sequence ensures every factory call gets a unique address.
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    # Use set_password so the hash is stored correctly.
    password = factory.PostGenerationMethodCall("set_password", "test-password")

    class Meta:
        model = User
        django_get_or_create = ("email",)
        skip_postgeneration_save = True


# ---------------------------------------------------------------------------
# ReviewFactory
# ---------------------------------------------------------------------------


class ReviewFactory(DjangoModelFactory):
    """Creates a Review with sensible defaults."""

    class Meta:
        model = Review

    title = Faker("sentence", nb_words=4)
    description = Faker("paragraph")
    is_active = True
    is_blinded = True
    duplicate_detection_status = Review.DuplicateDetectionStatus.NOT_STARTED


# ---------------------------------------------------------------------------
# ReviewMemberFactory
# ---------------------------------------------------------------------------


class ReviewMemberFactory(DjangoModelFactory):
    """
    Creates a ReviewMember linking a User to a Review.

    Traits
    ------
    owner        — sets role to OWNER
    collaborator — sets role to COLLABORATOR
    viewer       — sets role to VIEWER
    """

    class Meta:
        model = ReviewMember
        # Prevent duplicate (review, user) pairs in tests that call the factory
        # several times with the same arguments.
        django_get_or_create = ("review", "user")

    review = SubFactory(ReviewFactory)
    user = SubFactory(UserFactory)
    role = ReviewMember.Role.REVIEWER  # "reviewer"

    class Params:
        owner = Trait(role=ReviewMember.Role.OWNER)  # "owner"
        collaborator = Trait(role=ReviewMember.Role.COLLABORATOR)  # "collaborator"
        viewer = Trait(role=ReviewMember.Role.VIEWER)  # "viewer"


# ---------------------------------------------------------------------------
# ReviewInvitationFactory
# ---------------------------------------------------------------------------


class ReviewInvitationFactory(DjangoModelFactory):
    """Creates a pending ReviewInvitation."""

    class Meta:
        model = ReviewInvitation

    email = factory.Sequence(lambda n: f"invited{n}@example.com")
    review = SubFactory(ReviewFactory)
    invited_by = SubFactory(UserFactory)
    role = ReviewInvitation.Role.REVIEWER  # "reviewer"


# ---------------------------------------------------------------------------
# ScreeningCriteriaFactory
# ---------------------------------------------------------------------------


class ScreeningCriteriaFactory(DjangoModelFactory):
    """Creates a ScreeningCriteria for a review."""

    class Meta:
        model = ScreeningCriteria

    review = SubFactory(ReviewFactory)
    name = factory.Sequence(lambda n: f"Criterion {n}")
    description = Faker("sentence")
    type = ScreeningCriteria.Type.INCLUSION  # "inclusion"

    class Params:
        exclusive = Trait(type=ScreeningCriteria.Type.EXCLUSION)  # "exclusion"


# ---------------------------------------------------------------------------
# ScreeningStatFactory
# ---------------------------------------------------------------------------


class ScreeningStatFactory(DjangoModelFactory):
    """Creates a ScreeningStat for a ReviewMember."""

    class Meta:
        model = ScreeningStat

    # Each stat must belong to a unique member (OneToOneField).
    member = SubFactory(ReviewMemberFactory)
    seconds = 0
    sessions = 0


# ---------------------------------------------------------------------------
# ReviewChatMessageFactory
# ---------------------------------------------------------------------------


class ReviewChatMessageFactory(DjangoModelFactory):
    """
    Creates a ReviewChatMessage.

    Traits
    ------
    system — creates a system message (member set to None, is_system_message=True)
    """

    class Meta:
        model = ReviewChatMessage

    review = SubFactory(ReviewFactory)
    # Human messages need a member; lazy so it shares the same review.
    member = SubFactory(
        ReviewMemberFactory, review=LazyAttribute(lambda o: o.factory_parent.review)
    )
    message = Faker("sentence")
    is_system_message = False
    metadata = None

    class Params:
        system = Trait(
            member=None,
            is_system_message=True,
            metadata={"event": "task_complete"},
        )


# ---------------------------------------------------------------------------
# SearchMethodFactory
# ---------------------------------------------------------------------------


class SearchMethodFactory(DjangoModelFactory):
    """Creates a SearchMethod with no file attached by default."""

    class Meta:
        model = SearchMethod

    review = SubFactory(ReviewFactory)
    name = factory.Sequence(lambda n: f"Search Method {n}")
    # file left blank — override in tests that exercise file-upload logic
