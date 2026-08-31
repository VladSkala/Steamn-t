from django.contrib import admin

from community.models import (
    CommunityPost,
    GameReview,
    GameWishlist,
    PostComment,
    PostReaction,
    UserFollow,
)


admin.site.register(CommunityPost)
admin.site.register(PostReaction)
admin.site.register(PostComment)
admin.site.register(GameReview)
admin.site.register(UserFollow)
admin.site.register(GameWishlist)
