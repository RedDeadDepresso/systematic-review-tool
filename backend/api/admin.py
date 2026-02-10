from django.contrib import admin

from api.models import (
    Code,
    Keyword,
    MainTheme,
    Reference,
    ReferenceDuplicatePair,
    Review,
    ScreeningStat,
    SubTheme,
    User,
)


admin.site.register(User)
admin.site.register(Review)
admin.site.register(Reference)
admin.site.register(ReferenceDuplicatePair)
admin.site.register(MainTheme)
admin.site.register(SubTheme)
admin.site.register(Code)
admin.site.register(Keyword)
admin.site.register(ScreeningStat)
