from django.shortcuts import get_object_or_404, render
from .models import Category, Product


def home(request):
    return render(request, 'catalog/home.html', {
        'featured_categories': Category.objects.filter(is_featured=True),
        'popular_products': Product.objects.filter(is_popular=True).select_related('category')[:8],
        'categories': Category.objects.all(),
    })

def category_detail(request, slug):
    category = get_object_or_404(Category, slug=slug)
    return render(request, 'catalog/category.html', {
        'category': category,
        'products': category.products.all(),
    })

def product_detail(request, category_slug, slug):
    product = get_object_or_404(
        Product.objects.select_related('category'),
        category__slug=category_slug,
        slug=slug,
    )
    return render(request, 'catalog/product.html', {
        'product': product,
        'related_products': Product.objects.filter(category=product.category).exclude(pk=product.pk)[:4],
    })


def docs(request):
    return render(request, 'catalog/docs.html')


def contracts(request):
    return render(request, 'catalog/contracts.html')


def contacts(request):
    return render(request, 'catalog/contacts.html')
