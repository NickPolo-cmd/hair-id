# -*- coding: utf-8 -*-
"""Раскладывает фото владельца по 12 объявлениям Авито.

Каждое фото приводится к одному формату 1200x1600 (3:4):
вертикальные — кадрируются по центру, горизонтальные и коллажи —
вписываются целиком на мягкий фирменный фон, чтобы ничего не обрезать.
Первым кадром в каждой папке идёт готовая инфографика объявления.
"""
import os, shutil, json
from PIL import Image, ImageFilter

КОРЕНЬ = '/Users/nick/Desktop/Волосы'
ИСТОЧНИК = os.path.join(КОРЕНЬ, 'фото-от-владельца')
ИНФО = os.path.join(КОРЕНЬ, 'avito/фото-инфографика')
ВЫХОД = os.path.join(КОРЕНЬ, 'avito/ФОТО-И-ВИДЕО')

Ш, В = 1200, 1600
ФОН = (243, 238, 230)

# Разбор всех 75 кадров по смыслу. Номер = tg-0NN.jpg
ОБЪЯВЛЕНИЯ = [
    ('01-holodnoe-vosstanovlenie', 'Холодное восстановление',
     [12, 13, 15, 60, 61, 72, 14, 34]),
    ('02-vosstanovlenie-posle-osvetleniya', 'Восстановление после осветления',
     [64, 65, 66, 68, 69, 31, 16, 6]),
    ('03-pitanie-uvlazhnenie', 'Питание и увлажнение',
     [2, 4, 5, 57, 58, 73, 11, 12]),
    ('04-podbor-obraza', 'Подбор образа',
     [3, 30, 32, 33, 67, 19, 20, 24]),
    ('05-chelka-shtorka', 'Чёлка-шторка',
     [25, 26, 33, 30, 3, 11, 32, 67]),
    ('06-pricheski', 'Причёски на мероприятия',
     [39, 40, 41, 46, 43, 44, 9, 10]),
    ('07-spa', 'СПА для волос',
     [18, 23, 49, 51, 22, 47, 52, 45]),
    ('08-keratin', 'Кератиновое выпрямление',
     [59, 63, 74, 75, 14, 34, 24, 4]),
    ('09-botoks', 'Ботокс для волос',
     [2, 57, 58, 13, 61, 12, 5, 73]),
    ('10-spasu-volosy', 'Спасу ваши волосы',
     [1, 6, 16, 27, 28, 31, 62, 70]),
    ('11-ochishchenie-kozhi', 'Очищение кожи головы',
     [21, 23, 50, 51, 18, 42, 53, 55]),
    ('12-schastie', 'Счастье для волос',
     [11, 15, 60, 61, 72, 73, 34, 63]),
]


def привести(путь, вых):
    """Один формат 1200x1600 без искажения пропорций."""
    im = Image.open(путь).convert('RGB')
    доля = im.width / im.height
    цель = Ш / В
    if 0.55 <= доля <= 0.92:
        # вертикальный кадр — кадрируем по центру, верх оставляем (там лицо)
        к = max(Ш / im.width, В / im.height)
        нов = im.resize((round(im.width * к), round(im.height * к)), Image.LANCZOS)
        x = (нов.width - Ш) // 2
        y = int((нов.height - В) * 0.35)
        холст = нов.crop((x, y, x + Ш, y + В))
    else:
        # горизонтальный или коллаж — вписываем целиком, ничего не режем
        холст = Image.new('RGB', (Ш, В), ФОН)
        размытый = im.resize((Ш, В), Image.LANCZOS).filter(ImageFilter.GaussianBlur(38))
        холст.paste(Image.blend(размытый, Image.new('RGB', (Ш, В), ФОН), 0.62), (0, 0))
        к = min(Ш / im.width, В / im.height) * 0.94
        м = im.resize((round(im.width * к), round(im.height * к)), Image.LANCZOS)
        холст.paste(м, ((Ш - м.width) // 2, (В - м.height) // 2))
    холст.save(вых, quality=90, subsampling=1)
    return холст.size


if __name__ == '__main__':
    отчёт = {}
    for папка, название, номера in ОБЪЯВЛЕНИЯ:
        цель = os.path.join(ВЫХОД, папка)
        os.makedirs(цель, exist_ok=True)
        for старый in os.listdir(цель):
            if старый.lower().endswith('.jpg'):
                os.remove(os.path.join(цель, старый))
        сделано = []
        # 1-й кадр — инфографика объявления
        инфо = os.path.join(ИНФО, папка + '.jpg')
        if os.path.exists(инфо):
            привести(инфо, os.path.join(цель, '01-инфографика.jpg'))
            сделано.append('01-инфографика.jpg')
        for i, н in enumerate(номера, start=2):
            ф = os.path.join(ИСТОЧНИК, 'tg-%03d.jpg' % н)
            if not os.path.exists(ф):
                print('НЕТ ФАЙЛА', ф); continue
            имя = '%02d.jpg' % i
            привести(ф, os.path.join(цель, имя))
            сделано.append(имя)
        отчёт[папка] = сделано
        print(папка, '->', len(сделано), 'кадров')
    with open(os.path.join(ВЫХОД, '_опись.json'), 'w', encoding='utf-8') as f:
        json.dump(отчёт, f, ensure_ascii=False, indent=1)
    print('всего кадров:', sum(len(v) for v in отчёт.values()))
