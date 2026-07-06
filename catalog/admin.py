from django.contrib import admin

from .models import Category, Product


class ProductInline(admin.TabularInline):
    model = Product
    extra = 1
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'order', 'is_featured']
    list_editable = ['order', 'is_featured']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductInline]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_popular', 'order']
    list_filter = ['category', 'is_popular']
    list_editable = ['is_popular', 'order']
    prepopulated_fields = {'slug': ('name',)}
