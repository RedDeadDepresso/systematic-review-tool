from django.contrib import admin
from api.models import Reference, Review, User


admin.site.register(User)
admin.site.register(Review)
admin.site.register(Reference)
