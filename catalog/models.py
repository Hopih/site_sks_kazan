from django.db import models
from django.urls import reverse


class Category(models.Model):
    name = models.CharField('Название', max_length=200)
    slug = models.SlugField('URL', unique=True)
    description = models.TextField('Описание', blank=True)
    short_description = models.CharField('Краткое описание', max_length=300, blank=True)
    order = models.PositiveIntegerField('Порядок', default=0)
    is_featured = models.BooleanField('На главной', default=False)
    hero_tagline = models.CharField('Слоган для слайдера', max_length=300, blank=True)
    hero_features = models.TextField('Пункты слайдера (по строке)', blank=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('catalog:category', kwargs={'slug': self.slug})

    @property
    def hero_features_list(self):
        return [line.strip() for line in self.hero_features.splitlines() if line.strip()]

    @property
    def mesh_type(self):
        if self.slug == 'armaturnye-karkasy':
            return 'karkasy'
        if self.slug == 'setka-cvps':
            return 'cpvs'
        if self.slug == 'provoloka':
            return 'provoloka'
        return 'svarnaya'


class Product(models.Model):
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name='products', verbose_name='Категория'
    )
    name = models.CharField('Название', max_length=300)
    slug = models.SlugField('URL')
    description = models.TextField('Описание', blank=True)
    is_popular = models.BooleanField('Популярный', default=False)
    order = models.PositiveIntegerField('Порядок', default=0)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Товар'
        verbose_name_plural = 'Товары'
        unique_together = [['category', 'slug']]

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('catalog:product', kwargs={'category_slug': self.category.slug, 'slug': self.slug})
