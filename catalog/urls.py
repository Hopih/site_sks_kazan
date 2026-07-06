from django.urls import path

from . import views

app_name = 'catalog'

urlpatterns = [
    path('', views.home, name='home'),
    path('category/<slug:slug>/', views.category_detail, name='category'),
    path('product/<slug:category_slug>/<slug:slug>/', views.product_detail, name='product'),
    path('docs/', views.docs, name='docs'),
    path('contracts/', views.contracts, name='contracts'),
    path('contacts/', views.contacts, name='contacts'),
]
