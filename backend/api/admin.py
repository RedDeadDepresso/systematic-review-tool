from django.contrib import admin

from api.models import Code, Reference, ReferenceDuplicatePair, Review, Theme, User


admin.site.register(User)
admin.site.register(Review)
admin.site.register(Reference)
admin.site.register(ReferenceDuplicatePair)
admin.site.register(Theme)
admin.site.register(Code)
