from django.db import models
from django.urls import reverse
import re


KLADOCHNAYA_LEGACY_SLUG = 'setka-svarnaya'
KLADOCHNAYA_SLUG = 'setka-kladochnaya'


def normalize_kladochnaya_category(category):
    if category and category.slug == KLADOCHNAYA_LEGACY_SLUG:
        category.name = 'Сетка кладочная'
        category.short_description = 'Кладочная сетка в картах для армирования кладки'
        category.description = (
            'Кладочная сетка продаётся с ячейками 50×50, 100×100, 150×150 и 200×200. Карты популярных размеров '
            'для армирования стен из кирпича, блоков и других материалов.'
        )
        category.hero_tagline = 'Популярные размеры для кладочных работ'
        category.hero_features = 'Ячейки 50×50, 100×100, 150×150 и 200×200\nКарты от 0,1×2 до 2×3\nДля кирпича, блоков и монолитных работ'
    return category


def has_legacy_kladochnaya_category():
    return Category.objects.filter(slug=KLADOCHNAYA_LEGACY_SLUG).exists()


def visible_categories():
    categories = Category.objects.all()
    if has_legacy_kladochnaya_category():
        categories = categories.exclude(slug=KLADOCHNAYA_SLUG)
    return [normalize_kladochnaya_category(category) for category in categories]


def normalize_kladochnaya_product(product):
    if not product:
        return product

    normalize_kladochnaya_category(getattr(product, 'category', None))

    if product.name.startswith('Сетка сварная кладочная'):
        product.name = product.name.replace('Сетка сварная кладочная', 'Сетка кладочная', 1)

    if product.name.startswith('Сетка кладочная'):
        product.name = re.sub(r'(50×50|100×100)×[\d,]+(?: ВР-1)?', r'\1', product.name)
        product.name = re.sub(r'\s+(?:50×50|100×100|150×150|200×200),', ',', product.name)
        product.name = product.name.replace('карта 2×0,64', 'карта 0,64×2')
        product.name = product.name.replace('карта 2×0,5', 'карта 0,5×2')
        product.name = product.name.replace('карта 2×0,38', 'карта 0,38×2')
        product.name = product.name.replace('карта 2×1', 'карта 1×2')
        product.name = product.name.replace('карта 3×2', 'карта 2×3')

    return product


class Category(models.Model):
    name = models.CharField('Название', max_length=200)
    slug = models.SlugField('URL', unique=True)
    description = models.TextField('Описание', blank=True)
    short_description = models.CharField('Краткое описание', max_length=300, blank=True)
    order = models.PositiveIntegerField('Порядок', default=0)
    is_featured = models.BooleanField('На главной', default=False)
    hero_tagline = models.CharField('Слоган для слайдера', max_length=300, blank=True)
    hero_features = models.TextField('Пункты слайдера (по строке)', blank=True)
    hero_image = models.CharField('Изображение для слайдера', max_length=200, blank=True)

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
        if self.slug == 'setka-armaturnaya':
            return 'armaturnaya'
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
    preview_image = models.CharField('Изображение', max_length=200, blank=True)
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
