from django.contrib import admin

from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)


# Register your models here.
admin.site.register(ExtractionSection)
admin.site.register(ExtractionQuestion)
admin.site.register(ExtractionAnswer)
