from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class ExtractionConfig(AppConfig):
    name = "slrt_project.extraction"
    verbose_name = _("Extraction")
