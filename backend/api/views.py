import os
import bibtexparser
from api.models import Reference, Review, User
from rest_framework import generics, status, views
from api.serializers import RegisterSerializer, ReviewListSerializer, ReviewSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django_filters import rest_framework as filters
from api.filters import ReviewFilter
from django.db.models import Count
from rest_framework import permissions


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
            "avatar": "",
        }
        return Response(user_data, status=status.HTTP_200_OK)
    

class ReviewListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewListSerializer
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = ReviewFilter

    def get_queryset(self):
        return Review.objects.filter(owner=self.request.user).annotate(reference_count=Count('reference'))
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ReviewSerializer
        return ReviewListSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class IsReviewOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class ReviewRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsReviewOwner]
    serializer_class = ReviewSerializer
    queryset = Review.objects.all()


class ReviewUploadReferencesView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsReviewOwner]
    queryset = Review.objects.all()
    
    def extract_fields(self, review_id, search_methods, entry):
        publication_types = {
            "article": "Journal Article",
            "book": "Book",
            "inproceedings": "Conference Paper",
            "phdthesis": "PhD Thesis",
            "mastersthesis": "Master's Thesis",
            "techreport": "Technical Report",
            "misc": "Miscellaneous"
        }

        publication_type = publication_types.get(entry.get("ENTRYTYPE", ""), "Other")
        authors = [a.strip() for a in entry.get("author", "").split(" and ")] if "author" in entry else []
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
        uploaded_file = request.FILES.get('file')

        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        if uploaded_file.file:
            _, ext = os.path.splitext(uploaded_file.name)
            if ext != '.bib':
                return Response({"error": "Invalid file. Please upload a bib file."}, status=status.HTTP_400_BAD_REQUEST)
        
        bib_database = bibtexparser.load(uploaded_file)
        review_id = kwargs['pk']
        search_methods = f"Uploaded References [{uploaded_file.name}]"
        references = [self.extract_fields(review_id, search_methods, entry) for entry in bib_database.entries]
        Reference.objects.bulk_create(references)

        return Response({
            "uploaded_reference_count": len(bib_database.entries),
        }, status=status.HTTP_200_OK)