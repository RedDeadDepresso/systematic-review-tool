from django.contrib import admin

from slrt_project.reviews.models import (
    Review,
    ReviewChatMessage,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SearchMethod,
)


# Register your models here.

admin.site.register(Review)

admin.site.register(ReviewMember)

admin.site.register(ReviewInvitation)

admin.site.register(ReviewChatMessage)

admin.site.register(ScreeningStat)

admin.site.register(ScreeningCriteria)

admin.site.register(SearchMethod)
