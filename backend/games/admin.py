from django.contrib import admin

from games.models import Game, Genre


admin.site.register(Game)
admin.site.register(Genre)
