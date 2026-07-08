from django.shortcuts import get_object_or_404, render
from .models import (
    ARMATURNAYA_PRODUCTS,
    ARMATURNAYA_SLUG,
    Category,
    KLADOCHNAYA_SLUG,
    Product,
    CatalogProductCard,
    armaturnaya_product_cards,
    has_legacy_kladochnaya_category,
    normalize_catalog_product,
    normalize_kladochnaya_category,
    visible_categories,
)


def home(request):
    featured_categories = [category for category in visible_categories() if category.is_featured]
    popular_products = Product.objects.filter(is_popular=True).select_related('category')
    if has_legacy_kladochnaya_category():
        popular_products = popular_products.exclude(category__slug=KLADOCHNAYA_SLUG)
    popular_products = popular_products[:8]
    for product in popular_products:
        normalize_catalog_product(product)

    return render(request, 'catalog/home.html', {
        'featured_categories': featured_categories,
        'popular_products': popular_products,
        'categories': visible_categories(),
    })

def category_detail(request, slug):
    category = normalize_kladochnaya_category(get_object_or_404(Category, slug=slug))
    if category.slug == ARMATURNAYA_SLUG:
        products = armaturnaya_product_cards(category)
    else:
        products = [normalize_catalog_product(product) for product in category.products.all()]
    return render(request, 'catalog/category.html', {
        'category': category,
        'products': products,
        'breadcrumbs': [{'label': category.name}],
    })

def product_detail(request, category_slug, slug):
    if category_slug == ARMATURNAYA_SLUG:
        category = get_object_or_404(Category, slug=category_slug)
        specs = {item_slug: (name, is_popular) for item_slug, name, is_popular in ARMATURNAYA_PRODUCTS}
        if slug in specs:
            name, is_popular = specs[slug]
            product = CatalogProductCard(category, slug, name, is_popular)
            related_products = [item for item in armaturnaya_product_cards(category) if item.slug != slug]
            return render(request, 'catalog/product.html', {
                'product': product,
                'related_products': related_products,
                'breadcrumbs': [
                    {'label': category.name, 'url': category.get_absolute_url()},
                    {'label': product.name},
                ],
            })

    product = get_object_or_404(
        Product.objects.select_related('category'),
        category__slug=category_slug,
        slug=slug,
    )
    normalize_catalog_product(product)
    related_products = [
        normalize_catalog_product(related)
        for related in Product.objects.filter(category=product.category).exclude(pk=product.pk)[:4]
    ]
    return render(request, 'catalog/product.html', {
        'product': product,
        'related_products': related_products,
        'breadcrumbs': [
            {'label': product.category.name, 'url': product.category.get_absolute_url()},
            {'label': product.name},
        ],
    })


def docs(request):
    return render(request, 'catalog/docs.html', {
        'breadcrumbs': [{'label': 'Тех. документация'}],
    })


def contracts(request):
    return render(request, 'catalog/contracts.html', {
        'breadcrumbs': [{'label': 'Договоры и реквизиты'}],
    })


def contacts(request):
    return render(request, 'catalog/contacts.html', {
        'breadcrumbs': [{'label': 'Контакты'}],
    })


def page_not_found(request, exception):
    return render(request, '404.html', {
        'breadcrumbs': [{'label': '404'}],
    }, status=404)
