from django.contrib import admin

from slrt_project.coding.models import Code, MainTheme, SubTheme


# Register your models here.
admin.site.register(MainTheme)
admin.site.register(SubTheme)
admin.site.register(Code)
