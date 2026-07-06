from django.shortcuts import get_object_or_404, render
from .models import (
    Category,
    KLADOCHNAYA_SLUG,
    Product,
    has_legacy_kladochnaya_category,
    normalize_kladochnaya_category,
    normalize_kladochnaya_product,
    visible_categories,
)


def home(request):
    featured_categories = [category for category in visible_categories() if category.is_featured]
    popular_products = Product.objects.filter(is_popular=True).select_related('category')
    if has_legacy_kladochnaya_category():
        popular_products = popular_products.exclude(category__slug=KLADOCHNAYA_SLUG)
    popular_products = popular_products[:8]
    for product in popular_products:
        normalize_kladochnaya_product(product)

    return render(request, 'catalog/home.html', {
        'featured_categories': featured_categories,
        'popular_products': popular_products,
        'categories': visible_categories(),
    })

def category_detail(request, slug):
    category = normalize_kladochnaya_category(get_object_or_404(Category, slug=slug))
    products = [normalize_kladochnaya_product(product) for product in category.products.all()]
    return render(request, 'catalog/category.html', {
        'category': category,
        'products': products,
        'breadcrumbs': [{'label': category.name}],
    })

def product_detail(request, category_slug, slug):
    product = get_object_or_404(
        Product.objects.select_related('category'),
        category__slug=category_slug,
        slug=slug,
    )
    normalize_kladochnaya_product(product)
    related_products = [
        normalize_kladochnaya_product(related)
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
