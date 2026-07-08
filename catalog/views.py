from django.http import Http404
from django.shortcuts import get_object_or_404, render
from .models import (
    ARMATURNAYA_PRODUCTS,
    ARMATURNAYA_SLUG,
    Category,
    HIDDEN_CATEGORY_SLUGS,
    KLADOCHNAYA_SLUG,
    POLIMERNAYA_PRODUCTS,
    POLIMERNAYA_SLUG,
    Product,
    RULONNAYA_PRODUCTS,
    RULONNAYA_SLUG,
    CatalogProductCard,
    armaturnaya_product_cards,
    has_legacy_kladochnaya_category,
    normalize_category,
    normalize_catalog_product,
    polimernaya_category_card,
    polimernaya_product_cards,
    rulonnaya_product_cards,
    visible_categories,
)


def home(request):
    featured_categories = [category for category in visible_categories() if category.is_featured]
    popular_products = Product.objects.filter(is_popular=True).exclude(category__slug__in=HIDDEN_CATEGORY_SLUGS).select_related('category')
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
    if slug in HIDDEN_CATEGORY_SLUGS:
        raise Http404

    if slug == POLIMERNAYA_SLUG:
        category = polimernaya_category_card()
        products = polimernaya_product_cards(category)
        return render(request, 'catalog/category.html', {
            'category': category,
            'products': products,
            'breadcrumbs': [{'label': category.name}],
        })

    category = normalize_category(get_object_or_404(Category, slug=slug))
    if category.slug == ARMATURNAYA_SLUG:
        products = armaturnaya_product_cards(category)
    elif category.slug == RULONNAYA_SLUG:
        products = rulonnaya_product_cards(category)
    else:
        products = [normalize_catalog_product(product) for product in category.products.all()]
    return render(request, 'catalog/category.html', {
        'category': category,
        'products': products,
        'breadcrumbs': [{'label': category.name}],
    })

def product_detail(request, category_slug, slug):
    if category_slug in HIDDEN_CATEGORY_SLUGS:
        raise Http404

    if category_slug == ARMATURNAYA_SLUG:
        category = get_object_or_404(Category, slug=category_slug)
        normalize_category(category)
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

    if category_slug == RULONNAYA_SLUG:
        category = normalize_category(get_object_or_404(Category, slug=category_slug))
        specs = {item_slug: (name, is_popular) for item_slug, name, is_popular in RULONNAYA_PRODUCTS}
        if slug in specs:
            name, is_popular = specs[slug]
            product = CatalogProductCard(category, slug, name, is_popular)
            product.description = category.description
            related_products = [item for item in rulonnaya_product_cards(category) if item.slug != slug]
            return render(request, 'catalog/product.html', {
                'product': product,
                'related_products': related_products,
                'breadcrumbs': [
                    {'label': category.name, 'url': category.get_absolute_url()},
                    {'label': product.name},
                ],
            })

    if category_slug == POLIMERNAYA_SLUG:
        category = polimernaya_category_card()
        specs = {item_slug: (name, is_popular) for item_slug, name, is_popular in POLIMERNAYA_PRODUCTS}
        if slug in specs:
            name, is_popular = specs[slug]
            product = CatalogProductCard(category, slug, name, is_popular)
            product.description = category.description
            related_products = [item for item in polimernaya_product_cards(category) if item.slug != slug]
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
