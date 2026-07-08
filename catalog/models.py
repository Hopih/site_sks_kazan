from django.db import models
from django.urls import reverse
import re


KLADOCHNAYA_LEGACY_SLUG = 'setka-svarnaya'
KLADOCHNAYA_SLUG = 'setka-kladochnaya'
ARMATURNAYA_SLUG = 'setka-armaturnaya'
RULONNAYA_SLUG = 'setka-rulonnaya'
POLIMERNAYA_SLUG = 'setka-polimernaya'
HIDDEN_CATEGORY_SLUGS = {'setka-shtukaturnaya', 'setka-ocinkovannaya'}
ARMATURNAYA_PRODUCTS = [
    ('setka-armaturnaya-100x100', 'Сетка арматурная 100×100, карта 2×6', True),
    ('setka-armaturnaya-150x150', 'Сетка арматурная 150×150, карта 2×6', True),
    ('setka-armaturnaya-200x200', 'Сетка арматурная 200×200, карта 2×6', False),
]
RULONNAYA_PRODUCTS = [
    ('setka-rulonnaya-1x10', 'Сетка рулонная оцинкованная 1×10', True),
    ('setka-rulonnaya-15x10', 'Сетка рулонная оцинкованная 1,5×10', True),
    ('setka-rulonnaya-15x15', 'Сетка рулонная оцинкованная 1,5×15', False),
    ('setka-rulonnaya-15x25', 'Сетка рулонная оцинкованная 1,5×25', False),
    ('setka-rulonnaya-18x10', 'Сетка рулонная оцинкованная 1,8×10', False),
    ('setka-rulonnaya-2x10', 'Сетка рулонная оцинкованная 2×10', True),
]
POLIMERNAYA_PRODUCTS = [
    ('setka-polimernaya-15x10', 'Сетка с полимерным покрытием 1,5×10', True),
    ('setka-polimernaya-18x10', 'Сетка с полимерным покрытием 1,8×10', True),
]
POLIMERNAYA_CATEGORY = {
    'slug': POLIMERNAYA_SLUG,
    'name': 'Сетка с полимерным покрытием',
    'short_description': 'Сварная сетка в рулонах с полимерным покрытием',
    'description': 'Вся сетка с полимерным покрытием продаётся с ячейками 50×50 и 50×75.',
    'order': 7,
    'is_featured': False,
    'hero_tagline': 'Рулонная сетка с защитным полимерным покрытием',
    'hero_features': 'Ячейки 50×50 и 50×75\nРазмеры 1,5×10 и 1,8×10\nЗелёное полимерное покрытие',
}


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


def normalize_category(category):
    normalize_kladochnaya_category(category)
    if not category:
        return category

    if category.slug == 'setka-cvps':
        category.name = 'Сетка ЦПВС штукатурная оцинкованная'
    elif category.slug == RULONNAYA_SLUG:
        category.name = 'Сетка рулонная оцинкованная'
        category.short_description = 'Оцинкованная сварная сетка в рулонах'
        category.description = 'Вся рулонная оцинкованная сетка продаётся с ячейками 25×25 и 50×50.'
    return category


class CatalogCategoryCard:
    def __init__(self, data):
        self.slug = data['slug']
        self.name = data['name']
        self.short_description = data.get('short_description', '')
        self.description = data.get('description', '')
        self.order = data.get('order', 0)
        self.is_featured = data.get('is_featured', False)
        self.hero_tagline = data.get('hero_tagline', '')
        self.hero_features = data.get('hero_features', '')
        self.hero_image = data.get('hero_image', '')

    def get_absolute_url(self):
        return reverse('catalog:category', kwargs={'slug': self.slug})

    @property
    def hero_features_list(self):
        return [line.strip() for line in self.hero_features.splitlines() if line.strip()]

    @property
    def mesh_type(self):
        if self.slug == POLIMERNAYA_SLUG:
            return 'polimernaya'
        return 'svarnaya'


def has_legacy_kladochnaya_category():
    return Category.objects.filter(slug=KLADOCHNAYA_LEGACY_SLUG).exists()


def visible_categories():
    categories = Category.objects.all()
    categories = categories.exclude(slug__in=HIDDEN_CATEGORY_SLUGS)
    if has_legacy_kladochnaya_category():
        categories = categories.exclude(slug=KLADOCHNAYA_SLUG)
    normalized_categories = [normalize_category(category) for category in categories]
    if not any(category.slug == POLIMERNAYA_SLUG for category in normalized_categories):
        normalized_categories.append(CatalogCategoryCard(POLIMERNAYA_CATEGORY))
    return sorted(normalized_categories, key=lambda category: (category.order, category.name))


def normalize_kladochnaya_product(product):
    if not product:
        return product

    normalize_category(getattr(product, 'category', None))

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


def normalize_armaturnaya_product(product):
    if not product or getattr(getattr(product, 'category', None), 'slug', None) != ARMATURNAYA_SLUG:
        return product

    product.name = re.sub(r'(Сетка арматурная\s+\d+×\d+)×\d+', r'\1', product.name)
    return product


def remove_diameter_from_product(product):
    if not product:
        return product

    name = product.name
    name = re.sub(r'\s*ВР-1', '', name)
    name = re.sub(r',?\s*Ø\s*[\d,]+(?:\s*мм)?', '', name)
    name = re.sub(r'(Сетка\s+(?:дорожная|арматурная)\s+\d+×\d+)×[\d,]+', r'\1', name)
    name = re.sub(r'(Сетка\s+(?:сварная\s+)?кладочная\s+\d+×\d+)×[\d,]+', r'\1', name)
    name = re.sub(r'(\d+×\d+)\s+карта', r'\1, карта', name)
    name = re.sub(r'\s+,', ',', name)
    name = re.sub(r'\s{2,}', ' ', name).strip(' ,')
    product.name = name
    return product


def normalize_flat_karkas_product(product):
    if not product:
        return product

    if product.slug.startswith('karkas-ploskiy') or product.name.lower().startswith('каркас плоский'):
        product.name = 'Каркас плоский'
    return product


def normalize_wire_product(product):
    if not product:
        return product

    if product.slug == 'provoloka-vyazalnaya-12':
        product.name = 'Вязальная проволока 1,2 мм'
    elif product.slug == 'provoloka-vyazalnaya-16':
        product.name = 'Вязальная проволока 6 мм'
    return product


def normalize_catalog_product(product):
    normalize_kladochnaya_product(product)
    normalize_armaturnaya_product(product)
    normalize_flat_karkas_product(product)
    normalize_wire_product(product)
    remove_diameter_from_product(product)
    return product


class CatalogProductCard:
    def __init__(self, category, slug, name, is_popular=False):
        self.category = category
        self.slug = slug
        self.name = name
        self.is_popular = is_popular
        self.description = ''
        self.preview_image = ''

    def get_absolute_url(self):
        return reverse('catalog:product', kwargs={
            'category_slug': self.category.slug,
            'slug': self.slug,
        })

    @property
    def mesh_type(self):
        return self.category.mesh_type


def armaturnaya_product_cards(category):
    return [
        CatalogProductCard(category, slug, name, is_popular)
        for slug, name, is_popular in ARMATURNAYA_PRODUCTS
    ]


def rulonnaya_product_cards(category):
    return [
        CatalogProductCard(category, slug, name, is_popular)
        for slug, name, is_popular in RULONNAYA_PRODUCTS
    ]


def polimernaya_category_card():
    return CatalogCategoryCard(POLIMERNAYA_CATEGORY)


def polimernaya_product_cards(category):
    return [
        CatalogProductCard(category, slug, name, is_popular)
        for slug, name, is_popular in POLIMERNAYA_PRODUCTS
    ]


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
        if self.slug == ARMATURNAYA_SLUG:
            return 'armaturnaya'
        if self.slug == RULONNAYA_SLUG:
            return 'rulonnaya'
        if self.slug == POLIMERNAYA_SLUG:
            return 'polimernaya'
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

    @property
    def mesh_type(self):
        if self.category.slug == 'armaturnye-karkasy' and self.slug == 'karkas-obemnyy-fundament':
            return 'karkas-obemnyy'
        return self.category.mesh_type

    def get_absolute_url(self):
        return reverse('catalog:product', kwargs={'category_slug': self.category.slug, 'slug': self.slug})
