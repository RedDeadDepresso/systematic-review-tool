"""
Views for the extraction app.

ViewSet inventory
-----------------
ExtractionSectionViewSet
    Standard CRUD for sections; filterable by ``review``.

ExtractionQuestionViewSet
    Standard CRUD for questions; filterable by section, review, and type.

ExtractionAnswerViewSet
    CRUD for answers + ``bulk-save`` action.
    ``create`` is overridden to update an existing (reference, question) pair
    rather than returning 409, making the endpoint idempotent.

ExtractionTableViewSet
    Inherits ReviewDataViewSet (pagination, filtering, ordering).
    Scopes all queries to ``in_extraction=True`` references.
    Custom actions: ``filter-counts``, ``export-csv``, ``bulk-update-status``.

ExtractionFormViewSet
    Returns a full section → question → answer tree for a single reference
    in one optimised prefetch (``form-data`` action).

BarChartViewSet
    Answer frequencies for single/multi-select and boolean questions
    (``bar-chart`` action).

ScatterPlotViewSet
    (x, y) numeric pairs for two NUMBER questions (``scatter-plot`` action).

EvidenceGapMapViewSet
    Option × option reference-count matrix for two select/boolean questions
    (``evidence-gap-map`` action).

PublicationTimelineViewSet
    Per-year reference counts for the extraction set
    (``publication-timeline`` action).

Helper functions
----------------
_get_question_or_400
    Fetch a question by PK with optional type whitelist; returns an error
    Response on failure so callers can return it immediately.
"""

import csv
from collections import Counter

from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from django_filters import rest_framework as filters
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from slrt_project.extraction.api.filters import (
    ExtractionQuestionFilter,
    ExtractionReferenceFilter,
)
from slrt_project.extraction.api.serializers import (
    BarChartResponseSerializer,
    BulkSaveResponseSerializer,
    BulkUpdateExtractionStatusSerializer,
    BulkUpdateStatusResponseSerializer,
    EvidenceGapMapResponseSerializer,
    ExtractionAnswerBulkSerializer,
    ExtractionAnswerSerializer,
    ExtractionQuestionSerializer,
    ExtractionQuestionTableSerializer,
    ExtractionSectionSerializer,
    ExtractionSectionWithQuestionsSerializer,
    FormDataResponseSerializer,
    PublicationTimelineResponseSerializer,
    ReferenceTableSerializer,
    ScatterPlotResponseSerializer,
)
from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)
from slrt_project.references.api.views import (
    ReferenceAggregationService,
    ReviewDataViewSet,
)
from slrt_project.references.models import Reference


# ===========================================================================
# Helper
# ===========================================================================


def _get_question_or_400(
    question_id: int | str,
    allowed_types: list[str] | None = None,
) -> tuple:
    """
    Fetch an ExtractionQuestion by PK.

    Returns
    -------
    (question, None)
        When the question exists and its type is in *allowed_types*
        (or *allowed_types* is ``None``).
    (None, Response)
        On ``DoesNotExist`` → 404; on type mismatch → 400.
        The caller should return the Response immediately.
    """
    try:
        q = ExtractionQuestion.objects.get(pk=question_id)
    except ExtractionQuestion.DoesNotExist:
        return None, Response(
            {"error": f"Question {question_id} not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if allowed_types and q.type not in allowed_types:
        return None, Response(
            {
                "error": (
                    f"Question {question_id} has type '{q.type}'. "
                    f"Allowed types for this chart: {allowed_types}."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return q, None


# ===========================================================================
# ExtractionSectionViewSet
# ===========================================================================


class ExtractionSectionViewSet(viewsets.ModelViewSet):
    """
    CRUD for ExtractionSection.

    Filter params
    -------------
    review (int) — filter by review PK
    """

    queryset = ExtractionSection.objects.all()
    serializer_class = ExtractionSectionSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]


# ===========================================================================
# ExtractionQuestionViewSet
# ===========================================================================


class ExtractionQuestionViewSet(viewsets.ModelViewSet):
    """
    CRUD for ExtractionQuestion.

    Filter params
    -------------
    section         (int)    — filter by section PK
    section__review (int)    — filter by parent review PK
    type            (str[])  — comma-separated QuestionType values
    """

    queryset = ExtractionQuestion.objects.all()
    serializer_class = ExtractionQuestionSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = ExtractionQuestionFilter


# ===========================================================================
# ExtractionAnswerViewSet
# ===========================================================================


class ExtractionAnswerViewSet(viewsets.ModelViewSet):
    """
    CRUD for ExtractionAnswer + bulk-save action.

    Filter params
    -------------
    reference (int) — filter by reference PK
    question  (int) — filter by question PK

    Notes
    -----
    ``create`` checks for an existing (reference, question) pair and updates
    it rather than returning 409, making the endpoint idempotent.
    """

    queryset = ExtractionAnswer.objects.all()
    serializer_class = ExtractionAnswerSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["reference", "question"]

    @extend_schema(
        summary="Create or update a single answer",
        description=(
            "If an answer for this (reference, question) pair already exists "
            "it is updated and the response status is 200.  Otherwise a new "
            "answer is created and 201 is returned."
        ),
        request=ExtractionAnswerSerializer,
        responses={
            200: ExtractionAnswerSerializer,
            201: ExtractionAnswerSerializer,
            400: OpenApiResponse(description="Validation error"),
        },
    )
    def create(self, request, *args, **kwargs):
        """
        Upsert a single answer.

        Checks for an existing (reference, question) row first so the client
        does not need to track whether an answer already exists.
        """
        reference_id = request.data.get("reference")
        question_id = request.data.get("question")

        # Check if answer already exists for this (reference, question) pair.
        existing_answer = ExtractionAnswer.objects.filter(
            reference=reference_id, question=question_id
        ).first()

        if existing_answer:
            # Partial update of the existing answer.
            serializer = self.get_serializer(
                existing_answer, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        # No existing answer — create a new one.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    @extend_schema(
        summary="Save all answers for a reference",
        description=(
            "Accepts a dict of {question_id: value} pairs and persists them "
            "for the given reference in a single atomic transaction.  Each "
            "pair uses update-or-create semantics so the endpoint is idempotent."
        ),
        request=ExtractionAnswerBulkSerializer,
        responses={
            200: BulkSaveResponseSerializer,
            400: OpenApiResponse(
                description="Validation error — one or more values failed type checks"
            ),
        },
    )
    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        """
        Atomically persist all answers for a single reference.

        Validates the entire payload before opening the transaction so a type
        error returns 400 without a partial write.
        """
        serializer = ExtractionAnswerBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_id = serializer.validated_data["reference_id"]
        answers_dict = serializer.validated_data["answers"]

        saved_answers = []
        with transaction.atomic():
            for question_id_str, value in answers_dict.items():
                answer, _ = ExtractionAnswer.objects.update_or_create(
                    reference_id=reference_id,
                    question_id=int(question_id_str),
                    defaults={"value": value},
                )
                saved_answers.append(answer)

        return Response(
            BulkSaveResponseSerializer(
                {"saved_count": len(saved_answers), "answers": saved_answers}
            ).data,
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# ExtractionTableViewSet
# ===========================================================================


class ExtractionTableViewSet(ReviewDataViewSet):
    """
    Paginated extraction table — inherits filtering, ordering, and pagination
    from ReviewDataViewSet and scopes everything to ``in_extraction=True``.

    Custom actions
    --------------
    filter-counts       GET  — sidebar aggregation counts
    export-csv          GET  — full CSV download
    bulk-update-status  POST — mark references complete/incomplete
    """

    filterset_class = ExtractionReferenceFilter

    def get_base_queryset(self):
        """Restrict all queries to references that are in the extraction stage."""
        return super().get_base_queryset().filter(in_extraction=True)

    def get_queryset(self):
        """Add extraction-answer prefetch on top of the base queryset."""
        return (
            super()
            .get_queryset()
            .prefetch_related(
                Prefetch(
                    "extraction_answers",
                    queryset=ExtractionAnswer.objects.select_related("question"),
                )
            )
        )

    def get_base_queryset_for_counts(self):
        """Count-only queryset scoped to extraction references."""
        return super().get_base_queryset_for_counts().filter(in_extraction=True)

    # ------------------------------------------------------------------
    # list
    # ------------------------------------------------------------------

    @extend_schema(
        summary="List extraction references with questions",
        description=(
            "Returns a paginated list of references in the extraction stage "
            "alongside all questions for the review.  The response envelope "
            "includes total_count, filtered_count, next, previous, "
            "references, and questions."
        ),
        parameters=[
            OpenApiParameter("review", int, description="Review PK (required)"),
        ],
        responses={
            200: ReferenceTableSerializer(many=True),
            400: OpenApiResponse(description="review parameter missing"),
        },
    )
    def list(self, request, *args, **kwargs):
        """
        Return paginated extraction references and all questions for the review.

        The ``questions`` key is injected into the standard paginator envelope
        so clients receive both datasets in one request.
        """
        review = self.get_review()
        if not review:
            return Response(
                {"error": "review is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Questions ordered for the table header columns.
        questions = (
            ExtractionQuestion.objects.filter(section__review=review)
            .select_related("section")
            .order_by("section__order", "order")
        )

        filtered_qs = self.filter_queryset(self.get_queryset())
        total_count = self.get_base_queryset_for_counts().count()
        filtered_count = filtered_qs.count()
        page = self.paginate_queryset(filtered_qs)

        references_serializer = ReferenceTableSerializer(
            page, many=True, context={"request": request}
        )
        questions_serializer = ExtractionQuestionTableSerializer(
            questions, many=True, context={"request": request}
        )

        # Inject questions into the paginator's envelope.
        paginated_response = self.get_paginated_response(references_serializer.data)
        paginated_response.data["questions"] = questions_serializer.data
        paginated_response.data["total_count"] = total_count
        paginated_response.data["filtered_count"] = filtered_count
        return paginated_response

    # ------------------------------------------------------------------
    # filter-counts
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Extraction sidebar filter counts",
        description=(
            "Returns unfiltered aggregation counts for the sidebar scoped to "
            "in_extraction=True references."
        ),
        parameters=[
            OpenApiParameter("review", int, description="Review PK (required)"),
        ],
        responses={
            200: OpenApiResponse(description="Aggregation dict"),
            400: OpenApiResponse(description="review parameter missing"),
        },
    )
    @action(detail=False, methods=["get"], url_path="filter-counts")
    def filter_counts(self, request, *args, **kwargs):
        """Return sidebar aggregation counts for the extraction table."""
        review = self.get_review()
        if not review:
            return Response(
                {"error": "review parameter required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        aggregations = ReferenceAggregationService.build(
            self.get_base_queryset_for_counts(),
            request.user,
            include_duplicate_status=False,
            include_extraction_counts=True,
        )
        return Response(aggregations)

    # ------------------------------------------------------------------
    # export-csv
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Export extraction data as CSV",
        description=(
            "Streams a CSV file with one row per extraction reference.  "
            "Columns: Title, URL, DOI, then one column per question in "
            "section/order sequence.  Unanswered questions use empty string."
        ),
        parameters=[
            OpenApiParameter("review_id", int, description="Review PK (required)"),
        ],
        responses={
            200: OpenApiResponse(description="CSV file download"),
            400: OpenApiResponse(description="review_id parameter missing"),
        },
    )
    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        """Stream an extraction CSV for the given review."""
        review_id = request.query_params.get("review_id")
        if not review_id:
            return Response(
                {"error": "review_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        questions = (
            ExtractionQuestion.objects.filter(section__review_id=review_id)
            .select_related("section")
            .order_by("section__order", "order")
        )

        # Reuse the view's filtered + prefetched queryset.
        references = self.get_queryset().filter(review_id=review_id)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="extraction_data_review_{review_id}.csv"'
        )

        writer = csv.writer(response)

        # Header: fixed columns + one column per question.
        header = ["Title", "URL", "DOI"] + [q.column_title for q in questions]
        writer.writerow(header)

        for ref in references:
            # Build quick-lookup dict from the prefetched answers.
            answers_dict = {
                answer.question_id: answer.value
                for answer in ref.extraction_answers.all()
            }
            row = [ref.title, ref.url, ref.doi] + [
                answers_dict.get(q.id, "") for q in questions
            ]
            writer.writerow(row)

        return response

    # ------------------------------------------------------------------
    # bulk-update-status
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Bulk update extraction completion status",
        description=(
            "Sets ``is_extraction_completed`` to the given value for all "
            "listed references in a single UPDATE statement."
        ),
        request=BulkUpdateExtractionStatusSerializer,
        responses={
            200: BulkUpdateStatusResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
        },
    )
    @action(detail=False, methods=["post"], url_path="bulk-update-status")
    def bulk_update_status(self, request):
        """Mark a batch of references as extraction-complete or incomplete."""
        serializer = BulkUpdateExtractionStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_ids = serializer.validated_data["reference_ids"]
        is_extraction_completed = serializer.validated_data["is_extraction_completed"]

        updated_count = Reference.objects.filter(id__in=reference_ids).update(
            is_extraction_completed=is_extraction_completed
        )

        return Response(
            BulkUpdateStatusResponseSerializer(
                {
                    "updated_count": updated_count,
                    "reference_ids": reference_ids,
                    "is_extraction_completed": is_extraction_completed,
                }
            ).data,
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# ExtractionFormViewSet
# ===========================================================================


class ExtractionFormViewSet(viewsets.ViewSet):
    """
    Fetches the full extraction form for a single reference in one query.
    """

    @extend_schema(
        summary="Fetch extraction form data for a reference",
        description=(
            "Returns all sections with their questions and the current "
            "reference's answer for each question.  Uses a single optimised "
            "prefetch to avoid N+1 queries."
        ),
        parameters=[
            OpenApiParameter(
                "reference_id", int, description="Reference PK (required)"
            ),
            OpenApiParameter("review_id", int, description="Review PK (required)"),
        ],
        responses={
            200: FormDataResponseSerializer,
            400: OpenApiResponse(
                description="reference_id or review_id missing / non-integer"
            ),
            404: OpenApiResponse(
                description="Reference not found or not in this review"
            ),
        },
    )
    @action(detail=False, methods=["get"], url_path="form-data")
    def form_data(self, request):
        """
        Return sections + questions + answers for a single reference.

        The view attaches the per-reference answer as ``question.user_answer``
        before passing questions to the serializer so no additional DB queries
        occur during serialization.
        """
        reference_id = request.query_params.get("reference_id")
        review_id = request.query_params.get("review_id")

        if not reference_id or not review_id:
            return Response(
                {"error": "reference_id and review_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reference_id = int(reference_id)
            review_id = int(review_id)
        except (ValueError, TypeError):
            return Response(
                {"error": "reference_id and review_id must be integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the reference exists and belongs to this review.
        if not Reference.objects.filter(id=reference_id, review_id=review_id).exists():
            return Response(
                {"error": "Reference not found or does not belong to this review"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Single optimised prefetch: sections → questions → answers for this ref.
        sections = (
            ExtractionSection.objects.filter(review_id=review_id)
            .prefetch_related(
                Prefetch(
                    "questions",
                    queryset=ExtractionQuestion.objects.prefetch_related(
                        Prefetch(
                            "answers",
                            queryset=ExtractionAnswer.objects.filter(
                                reference_id=reference_id
                            ),
                            to_attr="reference_answers",
                        )
                    ).order_by("order"),
                )
            )
            .order_by("order")
        )

        # Attach the single answer (or None) to each question object so the
        # serializer can read it without an extra query.
        for section in sections:
            for question in section.questions.all():
                answers = question.reference_answers
                question.user_answer = answers[0] if answers else None

        serializer = ExtractionSectionWithQuestionsSerializer(sections, many=True)
        return Response({"sections": serializer.data})


# ===========================================================================
# BarChartViewSet
# ===========================================================================


class BarChartViewSet(viewsets.ViewSet):
    """
    Returns answer-value frequencies for a single/multi-select or boolean question.

    For multi-select questions every chosen token is counted separately so a
    reference answering "A,B" increments both "A" and "B".
    """

    @extend_schema(
        summary="Answer frequency bar chart",
        description=(
            "Returns value counts for a single-select, multi-select, or boolean "
            "question.  Multi-select answers are tokenised so each chosen option "
            "is counted separately.  Options defined on the question are always "
            "included even with a 0 count."
        ),
        parameters=[
            OpenApiParameter(
                "question_id",
                int,
                description="PK of a single-select, multi-select, or boolean question.",
            ),
        ],
        responses={
            200: BarChartResponseSerializer,
            400: OpenApiResponse(description="question_id missing or wrong type"),
            404: OpenApiResponse(description="Question not found"),
        },
    )
    @action(detail=False, methods=["get"], url_path="bar-chart")
    def bar_chart(self, request):
        """Return per-option answer counts for the given question."""
        question_id = request.query_params.get("question_id")
        if not question_id:
            return Response(
                {"error": "question_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question, err = _get_question_or_400(
            question_id,
            allowed_types=[
                ExtractionQuestion.QuestionType.SINGLE_SELECT,
                ExtractionQuestion.QuestionType.MULTI_SELECT,
                ExtractionQuestion.QuestionType.BOOLEAN,
            ],
        )
        if err:
            return err

        # Boolean questions synthesise their options list; others use question.options.
        options = (
            ["true", "false"]
            if question.type == ExtractionQuestion.QuestionType.BOOLEAN
            else (question.options or [])
        )

        answers_qs = ExtractionAnswer.objects.filter(question=question).exclude(
            value=""
        )

        # ── single-select / boolean: aggregate counts in the DB ────────────
        if question.type in (
            ExtractionQuestion.QuestionType.SINGLE_SELECT,
            ExtractionQuestion.QuestionType.BOOLEAN,
        ):
            counts_map = {
                row["value"]: row["count"]
                for row in answers_qs.values("value").annotate(count=Count("id"))
            }

        # ── multi-select: explode comma-separated tokens in Python ─────────
        else:
            counts_map: dict[str, int] = {}
            for answer in answers_qs.values_list("value", flat=True):
                for token in answer.split(","):
                    token = token.strip()
                    if token:
                        counts_map[token] = counts_map.get(token, 0) + 1

        # Build response in option order; include 0 for options with no answers.
        known = set(options)
        data = [{"label": opt, "count": counts_map.get(opt, 0)} for opt in options]

        # Guard: include any unexpected values not in question.options.
        for label, count in counts_map.items():
            if label not in known:
                data.append({"label": label, "count": count})

        return Response(
            BarChartResponseSerializer(
                {
                    "question_id": question.id,
                    "question": question.question,
                    "column_title": question.column_title,
                    "type": question.type,
                    "data": data,
                }
            ).data
        )


# ===========================================================================
# ScatterPlotViewSet
# ===========================================================================


class ScatterPlotViewSet(viewsets.ViewSet):
    """
    Returns (x, y) numeric pairs for two NUMBER-type questions.

    Only references that have both an x-answer and a y-answer are included.
    Each point carries a ``bubble_size`` — the count of references sharing
    the same (x, y) coordinate — so the frontend can render a bubble plot.
    """

    @extend_schema(
        summary="Scatter / bubble plot data for two numeric questions",
        description=(
            "Returns (x, y) pairs for all references that have answers to "
            "both questions.  ``bubble_size`` counts how many references share "
            "each coordinate."
        ),
        parameters=[
            OpenApiParameter(
                "question_x", int, description="PK of the x-axis NUMBER question."
            ),
            OpenApiParameter(
                "question_y", int, description="PK of the y-axis NUMBER question."
            ),
            OpenApiParameter(
                "review_id", int, required=False, description="Optional review filter."
            ),
        ],
        responses={
            200: ScatterPlotResponseSerializer,
            400: OpenApiResponse(description="Missing params or wrong question type"),
            404: OpenApiResponse(description="Question not found"),
        },
    )
    @action(detail=False, methods=["get"], url_path="scatter-plot")
    def scatter_plot(self, request):
        """Return (x, y) numeric pairs for two NUMBER-type questions."""
        q_x_id = request.query_params.get("question_x")
        q_y_id = request.query_params.get("question_y")
        review_id = request.query_params.get("review_id")

        if not q_x_id or not q_y_id:
            return Response(
                {"error": "question_x and question_y are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        q_x, err = _get_question_or_400(
            q_x_id, allowed_types=[ExtractionQuestion.QuestionType.NUMBER]
        )
        if err:
            return err
        q_y, err = _get_question_or_400(
            q_y_id, allowed_types=[ExtractionQuestion.QuestionType.NUMBER]
        )
        if err:
            return err

        x_filter = Q(question=q_x, value_number__isnull=False)
        y_filter = Q(question=q_y, value_number__isnull=False)
        if review_id:
            x_filter &= Q(reference__review_id=review_id)
            y_filter &= Q(reference__review_id=review_id)

        # Fetch x and y answers in two queries then join in Python.
        x_answers = {
            a["reference_id"]: a["value_number"]
            for a in ExtractionAnswer.objects.filter(x_filter).values(
                "reference_id", "value_number"
            )
        }
        y_answers = {
            a["reference_id"]: a["value_number"]
            for a in ExtractionAnswer.objects.filter(y_filter).values(
                "reference_id", "value_number"
            )
        }

        # Only include references that have both an x and a y answer.
        common_ref_ids = set(x_answers) & set(y_answers)

        title_map = {
            r["id"]: r["title"]
            for r in Reference.objects.filter(id__in=common_ref_ids).values(
                "id", "title"
            )
        }

        points = [
            {
                "reference_id": ref_id,
                "title": title_map.get(ref_id, ""),
                "x": x_answers[ref_id],
                "y": y_answers[ref_id],
            }
            for ref_id in sorted(common_ref_ids)
        ]

        # Annotate bubble size: number of references at the same (x, y) coordinate.
        coord_count = Counter((p["x"], p["y"]) for p in points)
        for p in points:
            p["bubble_size"] = coord_count[(p["x"], p["y"])]

        return Response(
            ScatterPlotResponseSerializer(
                {
                    "question_x": {"id": q_x.id, "column_title": q_x.column_title},
                    "question_y": {"id": q_y.id, "column_title": q_y.column_title},
                    "data": points,
                }
            ).data
        )


# ===========================================================================
# EvidenceGapMapViewSet
# ===========================================================================


class EvidenceGapMapViewSet(viewsets.ViewSet):
    """
    Returns a row-option × column-option matrix of reference counts.

    Each cell shows how many references have *both* the row option and the
    column option, along with a list of {id, title} stubs for drill-down.

    Supports single-select, multi-select, and boolean questions on both axes.
    """

    @extend_schema(
        summary="Evidence gap map matrix",
        description=(
            "Builds a row × col matrix of reference counts.  Multi-select "
            "values are tokenised so 'A,B' counts for both A and B."
        ),
        parameters=[
            OpenApiParameter(
                "question_row", int, description="PK of the row-axis question."
            ),
            OpenApiParameter(
                "question_col", int, description="PK of the column-axis question."
            ),
            OpenApiParameter(
                "review_id", int, required=False, description="Optional review filter."
            ),
        ],
        responses={
            200: EvidenceGapMapResponseSerializer,
            400: OpenApiResponse(description="Missing params or wrong question type"),
            404: OpenApiResponse(description="Question not found"),
        },
    )
    @action(detail=False, methods=["get"], url_path="evidence-gap-map")
    def evidence_gap_map(self, request):
        """Return an option × option reference-count matrix."""
        q_row_id = request.query_params.get("question_row")
        q_col_id = request.query_params.get("question_col")
        review_id = request.query_params.get("review_id")

        if not q_row_id or not q_col_id:
            return Response(
                {"error": "question_row and question_col are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _allowed = [
            ExtractionQuestion.QuestionType.BOOLEAN,
            ExtractionQuestion.QuestionType.SINGLE_SELECT,
            ExtractionQuestion.QuestionType.MULTI_SELECT,
        ]
        q_row, err = _get_question_or_400(q_row_id, allowed_types=_allowed)
        if err:
            return err
        q_col, err = _get_question_or_400(q_col_id, allowed_types=_allowed)
        if err:
            return err

        row_options = self._get_options(q_row)
        col_options = self._get_options(q_col)

        # Build reference_id filter for the optional review scope.
        ref_filter = {}
        if review_id:
            ref_filter["review_id"] = review_id

        row_answers_qs = (
            ExtractionAnswer.objects.filter(
                question=q_row,
                **{"reference__" + k: v for k, v in ref_filter.items()},
            )
            .exclude(value="")
            .values_list("reference_id", "value")
        )
        col_answers_qs = (
            ExtractionAnswer.objects.filter(
                question=q_col,
                **{"reference__" + k: v for k, v in ref_filter.items()},
            )
            .exclude(value="")
            .values_list("reference_id", "value")
        )

        # Expand values into sets of option tokens per reference.
        row_map = self._expand(row_answers_qs, q_row)
        col_map = self._expand(col_answers_qs, q_col)

        common_refs = set(row_map) & set(col_map)
        title_map = {
            r["id"]: r["title"]
            for r in Reference.objects.filter(id__in=common_refs).values("id", "title")
        }

        # Flatten matrix to a list of cells in row × col order.
        cells = []
        for row_opt in row_options:
            for col_opt in col_options:
                refs_here = [
                    {"id": ref_id, "title": title_map.get(ref_id, "")}
                    for ref_id in sorted(common_refs)
                    if row_opt in row_map.get(ref_id, set())
                    and col_opt in col_map.get(ref_id, set())
                ]
                cells.append(
                    {
                        "row": row_opt,
                        "col": col_opt,
                        "count": len(refs_here),
                        "references": refs_here,
                    }
                )

        max_count = max((c["count"] for c in cells), default=0)

        return Response(
            EvidenceGapMapResponseSerializer(
                {
                    "question_row": {
                        "id": q_row.id,
                        "column_title": q_row.column_title,
                        "options": row_options,
                    },
                    "question_col": {
                        "id": q_col.id,
                        "column_title": q_col.column_title,
                        "options": col_options,
                    },
                    "max_count": max_count,
                    "cells": cells,
                }
            ).data
        )

    def _get_options(self, question: ExtractionQuestion) -> list[str]:
        """Return the option list; boolean questions use ["Yes", "No"]."""
        if question.type == ExtractionQuestion.QuestionType.BOOLEAN:
            return ["Yes", "No"]
        return question.options or []

    def _expand(self, answers_qs, question: ExtractionQuestion) -> dict[int, set[str]]:
        """
        Build a mapping of reference_id → {option_value, ...}.

        * Multi-select: comma-separated tokens are split individually.
        * Boolean: raw ``true/1/yes`` → ``"Yes"``; ``false/0/no`` → ``"No"``.
        * Single-select: value is used as-is.
        """
        result: dict[int, set[str]] = {}
        is_multi = question.type == ExtractionQuestion.QuestionType.MULTI_SELECT
        is_boolean = question.type == ExtractionQuestion.QuestionType.BOOLEAN

        for ref_id, value in answers_qs:
            if not value:
                continue

            if is_multi:
                tokens = {t.strip() for t in value.split(",") if t.strip()}
            elif is_boolean:
                v = value.strip().lower()
                if v in ("true", "1", "yes"):
                    tokens = {"Yes"}
                elif v in ("false", "0", "no"):
                    tokens = {"No"}
                else:
                    continue  # ignore unrecognised boolean values
            else:
                tokens = {value.strip()}

            result.setdefault(ref_id, set()).update(tokens)

        return result


# ===========================================================================
# PublicationTimelineViewSet
# ===========================================================================


class PublicationTimelineViewSet(viewsets.ViewSet):
    """
    Returns reference counts by publication year for a review's extraction set.

    Missing years within the [min, max] range are filled with 0 so the
    frontend can render a continuous line chart without gaps.
    """

    @extend_schema(
        summary="Publication year timeline",
        description=(
            "Counts extraction references per publication year for the given "
            "review.  All years between the earliest and latest are included "
            "with a 0 count for years with no publications."
        ),
        parameters=[
            OpenApiParameter("review_id", int, description="Review PK (required)"),
        ],
        responses={
            200: PublicationTimelineResponseSerializer,
            400: OpenApiResponse(description="review_id missing or non-integer"),
        },
    )
    @action(detail=False, methods=["get"], url_path="publication-timeline")
    def publication_timeline(self, request):
        """Return per-year reference counts for the extraction set."""
        review_id = request.query_params.get("review_id")
        if not review_id:
            return Response(
                {"error": "review_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            review_id = int(review_id)
        except (ValueError, TypeError):
            return Response(
                {"error": "review_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pub_dates = Reference.objects.filter(
            review_id=review_id,
            in_extraction=True,
            publication_date__isnull=False,
        ).values_list("publication_date", flat=True)

        # Count per year in Python to avoid a DB EXTRACT GROUP BY round-trip.
        year_counts: dict[int, int] = {}
        for pub_date in pub_dates:
            year_counts[pub_date.year] = year_counts.get(pub_date.year, 0) + 1

        if not year_counts:
            return Response(
                PublicationTimelineResponseSerializer(
                    {
                        "data": [],
                        "total_references": 0,
                        "year_range": None,
                    }
                ).data
            )

        sorted_years = sorted(year_counts)
        min_year = sorted_years[0]
        max_year = sorted_years[-1]

        # Fill gaps so the line chart is continuous.
        data = [
            {"year": year, "count": year_counts.get(year, 0)}
            for year in range(min_year, max_year + 1)
        ]

        return Response(
            PublicationTimelineResponseSerializer(
                {
                    "data": data,
                    "total_references": sum(year_counts.values()),
                    "year_range": {"min": min_year, "max": max_year},
                }
            ).data
        )
