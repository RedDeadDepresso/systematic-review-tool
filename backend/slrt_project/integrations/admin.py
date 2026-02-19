from django.contrib import admin

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog


# Register your models here.
admin.site.register(ZoteroIntegration)
admin.site.register(ZoteroSyncLog)
