import csv

from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from django_filters import rest_framework as filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from slrt_project.extraction.api.filters import ExtractionQuestionFilter
from slrt_project.extraction.api.serializers import (
    BulkUpdateExtractionStatusSerializer,
    ExtractionAnswerBulkSerializer,
    ExtractionAnswerSerializer,
    ExtractionQuestionSerializer,
    ExtractionSectionSerializer,
    ExtractionSectionWithQuestionsSerializer,
    ExtractionTableDataSerializer,
)
from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)
from slrt_project.references.models import Reference, ReferenceLabel


class ExtractionSectionViewSet(viewsets.ModelViewSet):
    queryset = ExtractionSection.objects.all()
    serializer_class = ExtractionSectionSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]


class ExtractionQuestionViewSet(viewsets.ModelViewSet):
    queryset = ExtractionQuestion.objects.all()
    serializer_class = ExtractionQuestionSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = ExtractionQuestionFilter


class ExtractionAnswerViewSet(viewsets.ModelViewSet):
    queryset = ExtractionAnswer.objects.all()
    serializer_class = ExtractionAnswerSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["reference", "question"]

    def create(self, request, *args, **kwargs):
        """
        Create or update answer - returns existing answer if reference-question pair exists
        """
        reference_id = request.data.get("reference")
        question_id = request.data.get("question")

        # Check if answer already exists
        existing_answer = ExtractionAnswer.objects.filter(
            reference=reference_id, question=question_id
        ).first()

        if existing_answer:
            # Update existing answer
            serializer = self.get_serializer(
                existing_answer, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            # Create new answer
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data, status=status.HTTP_201_CREATED, headers=headers
            )

    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        """
        Save all answers for a reference in a single transaction
        """
        serializer = ExtractionAnswerBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_id = serializer.validated_data["reference_id"]
        answers_dict = serializer.validated_data["answers"]

        saved_answers = []

        with transaction.atomic():
            for question_id_str, value in answers_dict.items():
                question_id = int(question_id_str)

                answer, _ = ExtractionAnswer.objects.update_or_create(
                    reference_id=reference_id,
                    question_id=question_id,
                    defaults={"value": value},
                )
                saved_answers.append(answer)

        result_serializer = ExtractionAnswerSerializer(saved_answers, many=True)
        return Response(
            {"saved_count": len(saved_answers), "answers": result_serializer.data},
            status=status.HTTP_200_OK,
        )


class ExtractionTableViewSet(viewsets.ViewSet):
    """
    ViewSet for extraction table operations
    """

    @action(detail=False, methods=["get"], url_path="table-data")
    def table_data(self, request):
        """
        Get all data needed for extraction table in a single request
        """
        review_id = request.query_params.get("review")

        if not review_id:
            return Response(
                {"error": "review is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get questions with sections, ordered
        questions = (
            ExtractionQuestion.objects.filter(section__review=review_id)
            .select_related("section")
            .order_by("section__order", "order")
        )

        # Get references with prefetched answers for efficiency
        references = (
            Reference.objects.filter(review=review_id, in_extraction=True)
            .prefetch_related(
                Prefetch(
                    "extraction_answers",
                    queryset=ExtractionAnswer.objects.select_related("question"),
                ),
                Prefetch(
                    "labels",
                    queryset=ReferenceLabel.objects.filter(
                        label__user=self.request.user
                    ).select_related("label"),
                    to_attr="prefetched_labels",
                ),
            )
            .select_related("assignee__user")
        )

        serializer = ExtractionTableDataSerializer(
            {"questions": questions, "references": references},
            context={"request": request},
        )

        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        """
        Export extraction data as CSV
        """
        review_id = request.query_params.get("review_id")

        if not review_id:
            return Response(
                {"error": "review_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get questions with sections, ordered
        questions = (
            ExtractionQuestion.objects.filter(section__review_id=review_id)
            .select_related("section")
            .order_by("section__order", "order")
        )

        # Get references with prefetched answers
        references = (
            Reference.objects.filter(review_id=review_id)
            .prefetch_related(
                Prefetch(
                    "extraction_answers",
                    queryset=ExtractionAnswer.objects.select_related("question"),
                )
            )
            .order_by("id")
        )

        # Create CSV response
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="extraction_data_review_{review_id}.csv"'
        )

        writer = csv.writer(response)

        # Write header row
        header = ["Title"]
        for question in questions:
            header.append(question.column_title)
        writer.writerow(header)

        # Write data rows
        for ref in references:
            row = [ref.title]

            # Create answers dict for quick lookup
            answers_dict = {}
            for answer in ref.extraction_answers.all():
                answers_dict[answer.question_id] = answer.value

            # Add answer values in question order
            for question in questions:
                row.append(answers_dict.get(question.id, ""))

            writer.writerow(row)

        return response

    @action(detail=False, methods=["post"], url_path="bulk-update-status")
    def bulk_update_status(self, request):
        """
        Bulk update extraction completion status for multiple references
        """
        serializer = BulkUpdateExtractionStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_ids = serializer.validated_data["reference_ids"]
        is_extraction_completed = serializer.validated_data["is_extraction_completed"]

        # Update references
        updated_count = Reference.objects.filter(id__in=reference_ids).update(
            is_extraction_completed=is_extraction_completed
        )

        return Response(
            {
                "updated_count": updated_count,
                "reference_ids": reference_ids,
                "is_extraction_completed": is_extraction_completed,
            },
            status=status.HTTP_200_OK,
        )


class ExtractionFormViewSet(viewsets.ViewSet):
    """
    ViewSet for fetching extraction form data (sections + questions + answers)
    """

    @action(detail=False, methods=["get"], url_path="form-data")
    def form_data(self, request):
        """
        Get all sections, questions, and answers for a reference in a single optimized query.
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

        # Verify reference exists and belongs to the review
        if not Reference.objects.filter(id=reference_id, review_id=review_id).exists():
            return Response(
                {"error": "Reference not found or does not belong to this review"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Fetch sections with prefetched questions and answers in a single optimized query
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

        # Attach the single answer to each question for easy serialization
        for section in sections:
            for question in section.questions.all():
                # Get the answer for this specific reference (should be 0 or 1)
                answers = question.reference_answers
                question.user_answer = answers[0] if answers else None

        serializer = ExtractionSectionWithQuestionsSerializer(sections, many=True)

        return Response({"sections": serializer.data})


def _get_question_or_400(question_id, allowed_types=None):
    """
    Fetch a question by PK; return (question, error_response) pair.
    error_response is None when everything is fine.
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


class BarChartViewSet(viewsets.ViewSet):
    """
    Returns answer-value frequencies for a single-select or multi-select question.

    For multi-select questions every chosen token counts separately so a reference
    with answer "A,B" increments both "A" and "B".
    """

    @action(detail=False, methods=["get"], url_path="bar-chart")
    def bar_chart(self, request):
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

        options = question.options or []

        # For boolean questions synthesise options list
        if question.type == ExtractionQuestion.QuestionType.BOOLEAN:
            options = ["true", "false"]

        # Fetch all non-blank answers for this question
        answers_qs = ExtractionAnswer.objects.filter(question=question).exclude(
            value=""
        )

        # ── single-select / boolean: one value per answer row ──────────────
        if question.type in (
            ExtractionQuestion.QuestionType.SINGLE_SELECT,
            ExtractionQuestion.QuestionType.BOOLEAN,
        ):
            counts_raw = answers_qs.values("value").annotate(count=Count("id"))
            counts_map = {row["value"]: row["count"] for row in counts_raw}

        # ── multi-select: explode comma-separated values in Python ─────────
        else:
            counts_map: dict[str, int] = {}
            for answer in answers_qs.values_list("value", flat=True):
                for token in answer.split(","):
                    token = token.strip()
                    if token:
                        counts_map[token] = counts_map.get(token, 0) + 1

        # Build response in option-order; include 0 counts for defined options
        data = [{"label": opt, "count": counts_map.get(opt, 0)} for opt in options]

        # Append any values not in question.options (data integrity guard)
        known = set(options)
        for label, count in counts_map.items():
            if label not in known:
                data.append({"label": label, "count": count})

        return Response(
            {
                "question_id": question.id,
                "question": question.question,
                "column_title": question.column_title,
                "type": question.type,
                "data": data,
            }
        )


class ScatterPlotViewSet(viewsets.ViewSet):
    """
    Returns (x, y) numeric pairs for two number-type questions.

    The frontend can render this as:
      • Scatter plot - one dot per reference
      • Bubble plot  - dot sized by local density  (same x,y value cluster)

    Optional query params:
      review_id  - filter by review
    """

    @action(detail=False, methods=["get"], url_path="scatter-plot")
    def scatter_plot(self, request):
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

        # Answers for X
        x_filter = Q(question=q_x, value_number__isnull=False)
        y_filter = Q(question=q_y, value_number__isnull=False)
        if review_id:
            x_filter &= Q(reference__review_id=review_id)
            y_filter &= Q(reference__review_id=review_id)

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

        # Only references that have BOTH x and y
        common_ref_ids = set(x_answers) & set(y_answers)

        # Fetch reference titles in one query
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

        # Bubble metadata: count duplicates at each (x, y) coordinate
        from collections import Counter

        coord_count = Counter((p["x"], p["y"]) for p in points)
        for p in points:
            p["bubble_size"] = coord_count[(p["x"], p["y"])]

        return Response(
            {
                "question_x": {
                    "id": q_x.id,
                    "column_title": q_x.column_title,
                },
                "question_y": {
                    "id": q_y.id,
                    "column_title": q_y.column_title,
                },
                "data": points,
            }
        )


class EvidenceGapMapViewSet(viewsets.ViewSet):
    """
    Returns a matrix of evidence density for two option-type questions.

    Row options  → question_row  (single-select or multi-select)
    Column options → question_col (single-select or multi-select)

    Each cell contains:
      count   - number of references that have both row_option AND col_option
      references - list of {id, title} for tooltip drilling
    """

    @action(detail=False, methods=["get"], url_path="evidence-gap-map")
    def evidence_gap_map(self, request):
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

        ref_filter = {}
        if review_id:
            ref_filter["review_id"] = review_id

        # Build reference_id → [row_values] mapping
        row_answers_qs = (
            ExtractionAnswer.objects.filter(
                question=q_row, **{"reference__" + k: v for k, v in ref_filter.items()}
            )
            .exclude(value="")
            .values_list("reference_id", "value")
        )

        col_answers_qs = (
            ExtractionAnswer.objects.filter(
                question=q_col, **{"reference__" + k: v for k, v in ref_filter.items()}
            )
            .exclude(value="")
            .values_list("reference_id", "value")
        )

        row_map = self._expand(row_answers_qs, q_row)
        col_map = self._expand(col_answers_qs, q_col)

        # All refs that appear in both maps
        common_refs = set(row_map) & set(col_map)

        # Fetch titles
        title_map = {
            r["id"]: r["title"]
            for r in Reference.objects.filter(id__in=common_refs).values("id", "title")
        }

        # Build matrix
        matrix: dict[str, dict] = {r: {} for r in row_options}
        for row_opt in row_options:
            for col_opt in col_options:
                refs_here = [
                    {"id": ref_id, "title": title_map.get(ref_id, "")}
                    for ref_id in sorted(common_refs)
                    if row_opt in row_map.get(ref_id, set())
                    and col_opt in col_map.get(ref_id, set())
                ]
                matrix[row_opt][col_opt] = {
                    "count": len(refs_here),
                    "references": refs_here,
                }

        # Flatten to list form for easy frontend consumption
        cells = []
        for row_opt in row_options:
            for col_opt in col_options:
                cell = matrix[row_opt][col_opt]
                cells.append(
                    {
                        "row": row_opt,
                        "col": col_opt,
                        "count": cell["count"],
                        "references": cell["references"],
                    }
                )

        max_count = max((c["count"] for c in cells), default=0)

        return Response(
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
        )

    def _get_options(self, question):
        if question.type == ExtractionQuestion.QuestionType.BOOLEAN:
            return ["Yes", "No"]
        return question.options or []

    def _expand(self, answers_qs, question):
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

                if v in ["true", "1", "yes"]:
                    tokens = {"Yes"}
                elif v in ["false", "0", "no"]:
                    tokens = {"No"}
                else:
                    continue  # skip invalid

            else:
                tokens = {value.strip()}

            result.setdefault(ref_id, set()).update(tokens)

        return result


class PublicationTimelineViewSet(viewsets.ViewSet):
    """
    Returns count of references per publication year for extraction references.

    Query params:
        review_id (required): Review ID to filter references

    Returns:
        {
            "data": [
                {"year": 2020, "count": 5},
                {"year": 2021, "count": 8},
                {"year": 2022, "count": 12}
            ],
            "total_references": 25,
            "year_range": {"min": 2020, "max": 2022}
        }
    """

    @action(detail=False, methods=["get"], url_path="publication-timeline")
    def publication_timeline(self, request):
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

        # Get references in extraction with publication dates
        references = Reference.objects.filter(
            review_id=review_id, in_extraction=True, publication_date__isnull=False
        ).values_list("publication_date", flat=True)

        # Count references by year
        year_counts: dict[int, int] = {}
        for pub_date in references:
            year = pub_date.year
            year_counts[year] = year_counts.get(year, 0) + 1

        # Sort by year and build response
        if year_counts:
            sorted_years = sorted(year_counts.keys())

            # Fill in missing years with 0 count for continuous line
            min_year = sorted_years[0]
            max_year = sorted_years[-1]

            data = []
            for year in range(min_year, max_year + 1):
                data.append({"year": year, "count": year_counts.get(year, 0)})

            return Response(
                {
                    "data": data,
                    "total_references": sum(year_counts.values()),
                    "year_range": {"min": min_year, "max": max_year},
                }
            )
        else:
            # No references with publication dates
            return Response({"data": [], "total_references": 0, "year_range": None})
