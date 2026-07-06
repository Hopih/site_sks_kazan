from catalog.models import visible_categories


def nav_categories(request):
    return {'nav_categories': visible_categories()}
