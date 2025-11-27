import os

import bibtexparser
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django_filters import rest_framework as filters
from rest_framework import generics, status, views
from rest_framework.permissions import (
    SAFE_METHODS,
    AllowAny,
    BasePermission,
    IsAuthenticated,
)
from rest_framework.response import Response

from api.filters import KeywordFilter, ReviewFilter
from api.models import (
    Keyword,
    Note,
    Reference,
    ReferenceDuplicatePair,
    Review,
    ReviewInvitation,
    User,
)
from api.serializers import (
    KeywordSerializer,
    NoteSerializer,
    ReferenceDuplicatePairSerializer,
    ReferenceSerializer,
    RegisterSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


class RetrieveUserView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        user_data = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "display_name": str(user),
            "avatar": "",
        }
        return Response(user_data, status=status.HTTP_200_OK)


class ReviewListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewListSerializer
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = ReviewFilter

    def get_queryset(self):
        user = self.request.user

        return (
            Review.objects.filter(Q(owner=user) | Q(collaborators=user))
            .distinct()
            .annotate(reference_count=Count("reference"))
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ReviewSerializer
        return ReviewListSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class IsOwnerOrCollaboratorReadOnly(BasePermission):
    """
    Owners can do anything.
    Collaborators can only read.
    Others get no access.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user

        # SAFE METHODS: collaborators + owner can view
        if request.method in SAFE_METHODS:
            return user == obj.owner or user in obj.collaborators.all()

        # WRITE METHODS: only owner
        return user == obj.owner


class ReviewRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsOwnerOrCollaboratorReadOnly]
    serializer_class = ReviewSerializer
    queryset = Review.objects.all()


class ReviewUploadReferencesView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Review.objects.all()

    def extract_fields(self, review_id, search_methods, entry):
        publication_types = {
            "article": "Journal Article",
            "book": "Book",
            "inproceedings": "Conference Paper",
            "phdthesis": "PhD Thesis",
            "mastersthesis": "Master's Thesis",
            "techreport": "Technical Report",
            "misc": "Miscellaneous",
        }

        publication_type = publication_types.get(entry.get("ENTRYTYPE", ""), "Other")
        authors = (
            ", ".join(a.strip() for a in entry.get("author", "").split(" and "))
            if "author" in entry
            else ""
        )
        journal = entry.get("journal") or entry.get("booktitle") or ""
        article_customizations = entry.get("note") or entry.get("howpublished")

        return Reference(
            review_id=review_id,
            title=entry.get("title", "No Title"),
            publication_types=publication_type,
            authors=authors,
            journal=journal,
            search_methods=search_methods,
            article_customizations=article_customizations or "",
            abstract=entry.get("abstract", ""),
        )

    def post(self, request, *args, **kwargs):
        review_id = kwargs["pk"]
        review = get_object_or_404(Review, pk=review_id, owner=request.user)
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            return Response(
                {"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST
            )

        if uploaded_file.file:
            _, ext = os.path.splitext(uploaded_file.name)
            if ext != ".bib":
                return Response(
                    {"error": "Invalid file. Please upload a bib file."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        bib_database = bibtexparser.load(uploaded_file)
        search_methods = f"Uploaded References [{uploaded_file.name}]"
        references = [
            self.extract_fields(review_id, search_methods, entry)
            for entry in bib_database.entries
        ]
        Reference.objects.bulk_create(references)

        review.reference_duplicate_detected = False
        review.save()

        return Response(
            {
                "uploaded_reference_count": len(bib_database.entries),
            },
            status=status.HTTP_200_OK,
        )


class ReferenceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceSerializer
    pagination_class = None

    def get_queryset(self):
        review_id = self.kwargs["pk"]
        review = get_object_or_404(Review, pk=review_id)
        if (
            review.owner == self.request.user
            or self.request.user in review.collaborators.all()
        ):
            return Reference.objects.filter(review=review_id)
        return Reference.objects.none()


class ReferenceRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceSerializer

    def get_queryset(self):
        review_id = self.kwargs["review_pk"]
        reference_pk = self.kwargs["pk"]
        review = get_object_or_404(Review, pk=review_id)
        if (
            review.owner == self.request.user
            or self.request.user in review.collaborators.all()
        ):
            return Reference.objects.filter(review=review, pk=reference_pk)
        return Reference.objects.none()


class ReferenceDuplicatePairCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceSerializer

    def post(self, request, *args, **kwargs):
        review_id = self.kwargs["review_pk"]
        review = get_object_or_404(Review, pk=review_id, owner=self.request.user)
        if review.reference_duplicate_detected:
            return Response(
                {
                    "error": "Duplicate detection has already been performed for this review."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Reference.objects.filter(review=review)
        created_count = ReferenceDuplicatePair.create_pairs(review, queryset)

        review.reference_duplicate_detected = True
        review.save()

        return Response(
            {
                "duplicates_found_count": created_count,
            }
        )


class ReferenceDuplicatePairRetrieveView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceDuplicatePairSerializer

    def get_object(self):
        review_id = self.kwargs.get("review_pk")
        review = get_object_or_404(Review, pk=review_id, owner=self.request.user)
        return ReferenceDuplicatePair.objects.filter(review=review).first()

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj is None:
            return Response(
                {"detail": "No reference duplicate pair found for this review."},
                status=status.HTTP_200_OK,
            )
        serializer = self.get_serializer(obj)
        return Response(serializer.data)


class ReferenceDuplicatePairResolveView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        review_id = kwargs.get("review_pk")
        duplicate_pair_id = kwargs.get("pk")

        review = get_object_or_404(Review, pk=review_id, owner=request.user)
        duplicate_pair = get_object_or_404(
            ReferenceDuplicatePair, review=review, pk=duplicate_pair_id
        )

        try:
            selection = int(request.data.get("selection"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Selection must be an integer (1 or 2)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if selection == 1:
            duplicate_pair.reference2.delete()
        elif selection == 2:
            duplicate_pair.reference1.delete()
        else:
            return Response(
                {"detail": "Invalid selection. Must be 1 or 2."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duplicate_pair.delete()
        return Response(
            {"detail": "Reference duplicate resolved successfully."},
            status=status.HTTP_200_OK,
        )


class KeywordListCreateView(generics.ListCreateAPIView):
    serializer_class = KeywordSerializer
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = KeywordFilter

    def get_queryset(self):
        review_id = self.kwargs["review_pk"]
        return Keyword.objects.filter(review_id=review_id)

    def perform_create(self, serializer):
        review_id = self.kwargs["review_pk"]
        serializer.save(review_id=review_id)


class NoteRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]


class NoteListCreateView(generics.ListCreateAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class ReviewInvitationCreateView(views.APIView):
    def post(self, request, *args, **kwargs):
        user = request.user
        review = get_object_or_404(Review, pk=kwargs["pk"], owner=user)
        emails = request.data.get("emails", [])
        for email in emails:
            if email == request.user.email:
                continue
            ReviewInvitation.objects.create(email=email, review=review, invited_by=user)
            # invite_link = request.build_absolute_uri(
            #     reverse("accept-invite", args=[str(invitation.token)])
            # )
            # send_mail(
            #     "You're invited to review!",
            #     f"Click to join the review: {invite_link}",
            #     "no-reply@example.com",
            #     [email],
            # )
        return Response(
            {"detail": "Invitations sent successfully."},
            status=status.HTTP_201_CREATED,
        )


class ReviewInvitationListView(generics.ListAPIView):
    serializer_class = ReviewInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReviewInvitation.objects.filter(email=self.request.user.email)


class ReviewInvitationUpdateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        invitation_id = kwargs.get("pk")
        invitation = get_object_or_404(
            ReviewInvitation, pk=invitation_id, email=request.user.email
        )

        action = request.data.get("action")
        if action == "accept":
            invitation.review.collaborators.add(request.user)
            invitation.delete()
            return Response(
                {"detail": "Invitation accepted."},
                status=status.HTTP_200_OK,
            )
        elif action == "decline":
            invitation.delete()
            return Response(
                {"detail": "Invitation declined."},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"detail": "Invalid action."},
                status=status.HTTP_400_BAD_REQUEST,
            )
