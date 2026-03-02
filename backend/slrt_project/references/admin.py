from django.contrib import admin

from slrt_project.references.models import (
    Keyword,
    Label,
    Note,
    Reason,
    Reference,
    ReferenceCluster,
    ReferenceLabel,
    ReferenceOpinion,
    UploadedPDF,
)


# Register your models here.
admin.site.register(Reference)
admin.site.register(Label)
admin.site.register(ReferenceLabel)
admin.site.register(Keyword)
admin.site.register(Note)
admin.site.register(ReferenceOpinion)
admin.site.register(Reason)
admin.site.register(ReferenceCluster)
admin.site.register(UploadedPDF)
