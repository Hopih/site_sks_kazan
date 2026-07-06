from django.core.management.base import BaseCommand

from catalog.models import Category, Product


CATEGORIES = [
    {
        'slug': 'armaturnye-karkasy',
        'name': 'Арматурные каркасы',
        'short_description': 'Плоские и объёмные каркасы для монолитных работ',
        'description': 'Арматурные каркасы для фундаментов, перекрытий, свай и монолитных конструкций. Изготовление по чертежам заказчика.',
        'order': 1,
        'is_featured': True,
        'hero_tagline': 'Плоские и объёмные, для любых задач',
        'hero_features': 'Монолитные бетонные работы и отделка\nФундамент, перекрытия и сваи\nИзготовление по чертежам',
    },
    {
        'slug': 'setka-svarnaya',
        'name': 'Сетка сварная',
        'short_description': 'В картах и рулонах с высокопрочными сварными соединениями',
        'description': 'Сварная сетка из проволоки ВР-1. Широкий ассортимент ячеек и диаметров. Карты и рулоны.',
        'order': 2,
        'is_featured': True,
        'hero_tagline': 'Широкий ассортимент производимой продукции',
        'hero_features': 'Изготавливаем в картах и в рулонах\nВысокопрочные сварные соединения\nСоответствие ГОСТ и ТУ',
    },
    {
        'slug': 'setka-cvps',
        'name': 'Сетка ЦПВС',
        'short_description': 'Цельная просечно-вытяжная сетка',
        'description': 'Сетка ЦПВС оцинкованная и без покрытия. Применяется в строительстве, промышленности и для усиления конструкций.',
        'order': 3,
        'is_featured': True,
        'hero_tagline': 'Прочная просечно-вытяжная сетка',
        'hero_features': 'Оцинкованная\nБез покрытия\nРазличные размеры ячеек',
    },
    {
        'slug': 'setka-dorozhnaya',
        'name': 'Сетка дорожная',
        'short_description': 'Для армирования дорожных покрытий',
        'description': 'Дорожная сетка для армирования асфальтобетонных и цементобетонных покрытий.',
        'order': 4,
        'is_featured': False,
    },
    {
        'slug': 'setka-kladochnaya',
        'name': 'Сетка кладочная',
        'short_description': 'Для армирования кладки',
        'description': 'Кладочная сварная сетка для армирования стен из кирпича, блоков и других материалов.',
        'order': 5,
        'is_featured': False,
    },
    {
        'slug': 'setka-shtukaturnaya',
        'name': 'Сетка штукатурная',
        'short_description': 'Для армирования штукатурных слоёв',
        'description': 'Штукатурная сетка предотвращает растрескивание и отслаивание штукатурки.',
        'order': 6,
        'is_featured': False,
    },
    {
        'slug': 'setka-rulonnaya',
        'name': 'Сетка рулонная',
        'short_description': 'Сетка в рулонах для удобного монтажа',
        'description': 'Рулонная сварная сетка различных размеров ячеек и ширины рулона.',
        'order': 7,
        'is_featured': False,
    },
    {
        'slug': 'setka-armaturnaya',
        'name': 'Сетка арматурная',
        'short_description': 'Арматурная сетка для бетонных работ',
        'description': 'Арматурная сетка для усиления бетонных конструкций и плит перекрытия.',
        'order': 8,
        'is_featured': False,
    },
    {
        'slug': 'setka-ocinkovannaya',
        'name': 'Сетка оцинкованная',
        'short_description': 'С антикоррозийным покрытием',
        'description': 'Оцинкованная металлическая сетка для наружных работ и агрессивных сред.',
        'order': 9,
        'is_featured': False,
    },
    {
        'slug': 'provoloka',
        'name': 'Проволока',
        'short_description': 'Вязальная проволока для строительства',
        'description': 'Вязальная проволока с высоким коэффициентом растяжения и устойчивостью к коррозии.',
        'order': 10,
        'is_featured': False,
    },
]

PRODUCTS = {
    'setka-svarnaya': [
        ('setka-svarnaya-kladochnaya-50x50x25-3-2', 'Сетка сварная кладочная 50×50×2,5 ВР-1, карта 3×2', True),
        ('setka-svarnaya-kladochnaya-50x50x25-2-1', 'Сетка сварная кладочная 50×50×2,5 ВР-1, карта 2×1', True),
        ('setka-svarnaya-kladochnaya-50x50x25-2-064', 'Сетка сварная кладочная 50×50×2,5 ВР-1, карта 2×0,64', True),
        ('setka-svarnaya-kladochnaya-50x50x25-2-05', 'Сетка сварная кладочная 50×50×2,5 ВР-1, карта 2×0,5', True),
        ('setka-svarnaya-kladochnaya-50x50x25-2-038', 'Сетка сварная кладочная 50×50×2,5 ВР-1, карта 2×0,38', True),
        ('setka-svarnaya-kladochnaya-50x50x35-2-038', 'Сетка сварная кладочная 50×50×3,5 ВР-1, карта 2×0,38', True),
    ],
    'setka-dorozhnaya': [
        ('setka-dorozhnaya-100x100', 'Сетка дорожная 100×100×4, карта 2×3', True),
        ('setka-dorozhnaya-150x150', 'Сетка дорожная 150×150×5, карта 2×3', False),
    ],
    'setka-kladochnaya': [
        ('setka-kladochnaya-50x50', 'Сетка кладочная 50×50×2,5, карта 1×2', True),
        ('setka-kladochnaya-100x100', 'Сетка кладочная 100×100×3, карта 1×2', False),
    ],
    'setka-armaturnaya': [
        ('setka-armaturnaya-150x150', 'Сетка арматурная 150×150×5, карта 2×6', True),
    ],
    'armaturnye-karkasy': [
        ('karkas-ploskiy-6x6', 'Каркас плоский 6×6 м, Ø12', False),
        ('karkas-obemnyy-fundament', 'Каркас объёмный для фундамента', False),
    ],
    'provoloka': [
        ('provoloka-vyazalnaya-12', 'Проволока вязальная Ø1,2 мм', False),
        ('provoloka-vyazalnaya-16', 'Проволока вязальная Ø1,6 мм', False),
    ],
}


class Command(BaseCommand):
    help = 'Заполнить каталог начальными данными'

    def handle(self, *args, **options):
        Category.objects.all().delete()

        for cat_data in CATEGORIES:
            category = Category.objects.create(**cat_data)
            for order, (slug, name, is_popular) in enumerate(PRODUCTS.get(cat_data['slug'], [])):
                Product.objects.create(
                    category=category,
                    slug=slug,
                    name=name,
                    is_popular=is_popular,
                    order=order,
                )

        self.stdout.write(self.style.SUCCESS('Каталог успешно заполнен!'))
