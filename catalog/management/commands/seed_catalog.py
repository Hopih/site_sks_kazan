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
        'slug': 'setka-kladochnaya',
        'name': 'Сетка кладочная',
        'short_description': 'Кладочная сетка в картах для армирования кладки',
        'description': 'Кладочная сетка продаётся с ячейками 50×50, 100×100, 150×150 и 200×200. Карты популярных размеров для армирования стен из кирпича, блоков и других материалов.',
        'order': 2,
        'is_featured': True,
        'hero_tagline': 'Популярные размеры для кладочных работ',
        'hero_features': 'Ячейки 50×50, 100×100, 150×150 и 200×200\nКарты от 0,1×2 до 2×3\nДля кирпича, блоков и монолитных работ',
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
        'slug': 'setka-shtukaturnaya',
        'name': 'Сетка штукатурная',
        'short_description': 'Для армирования штукатурных слоёв',
        'description': 'Штукатурная сетка предотвращает растрескивание и отслаивание штукатурки.',
        'order': 5,
        'is_featured': False,
    },
    {
        'slug': 'setka-rulonnaya',
        'name': 'Сетка рулонная',
        'short_description': 'Сетка в рулонах для удобного монтажа',
        'description': 'Рулонная сварная сетка различных размеров ячеек и ширины рулона.',
        'order': 6,
        'is_featured': False,
    },
    {
        'slug': 'setka-armaturnaya',
        'name': 'Сетка арматурная',
        'short_description': 'Арматурная сетка для бетонных работ',
        'description': 'Арматурная сетка для усиления бетонных конструкций и плит перекрытия.',
        'order': 7,
        'is_featured': False,
    },
    {
        'slug': 'setka-ocinkovannaya',
        'name': 'Сетка оцинкованная',
        'short_description': 'С антикоррозийным покрытием',
        'description': 'Оцинкованная металлическая сетка для наружных работ и агрессивных сред.',
        'order': 8,
        'is_featured': False,
    },
    {
        'slug': 'provoloka',
        'name': 'Проволока',
        'short_description': 'Вязальная проволока для строительства',
        'description': 'Вязальная проволока с высоким коэффициентом растяжения и устойчивостью к коррозии.',
        'order': 9,
        'is_featured': False,
    },
]

PRODUCTS = {
    'setka-kladochnaya': [
        ('setka-kladochnaya-01x2', 'Сетка кладочная, карта 0,1×2', True),
        ('setka-kladochnaya-025x2', 'Сетка кладочная, карта 0,25×2', True),
        ('setka-kladochnaya-038x2', 'Сетка кладочная, карта 0,38×2', True),
        ('setka-kladochnaya-05x2', 'Сетка кладочная, карта 0,5×2', True),
        ('setka-kladochnaya-064x2', 'Сетка кладочная, карта 0,64×2', True),
        ('setka-kladochnaya-1x2', 'Сетка кладочная, карта 1×2', True),
        ('setka-kladochnaya-2x3', 'Сетка кладочная, карта 2×3', True),
    ],
    'setka-cvps': [
        ('cpvs-1x50-3x3', 'Сетка ЦПВС 1×50 м, ячейка 3×3 мм', True),
        ('cpvs-1x10-5x5', 'Сетка ЦПВС 1×10 м, ячейка 5×5 мм', True),
        ('cpvs-1x10-8x8', 'Сетка ЦПВС 1×10 м, ячейка 8×8 мм', False),
        ('cpvs-1x10-10x10', 'Сетка ЦПВС 1×10 м, ячейка 10×10 мм', False),
        ('cpvs-1x10-20x20', 'Сетка ЦПВС 1×10 м, ячейка 20×20 мм', False),
    ],
    'setka-dorozhnaya': [
        ('setka-dorozhnaya-100x100', 'Сетка дорожная 100×100, карта 2×3', True),
        ('setka-dorozhnaya-150x150', 'Сетка дорожная 150×150, карта 2×3', False),
    ],
    'setka-armaturnaya': [
        ('setka-armaturnaya-100x100', 'Сетка арматурная 100×100, карта 2×6', True),
        ('setka-armaturnaya-150x150', 'Сетка арматурная 150×150, карта 2×6', True),
        ('setka-armaturnaya-200x200', 'Сетка арматурная 200×200, карта 2×6', False),
    ],
    'armaturnye-karkasy': [
        ('karkas-ploskiy-6x6', 'Каркас плоский 6×6 м', False),
        ('karkas-obemnyy-fundament', 'Каркас объёмный для фундамента', False),
    ],
    'provoloka': [
        ('provoloka-vyazalnaya-12', 'Проволока вязальная', False),
        ('provoloka-vyazalnaya-16', 'Проволока вязальная', False),
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
