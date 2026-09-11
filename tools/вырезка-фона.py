# -*- coding: utf-8 -*-
"""Вырезка товара с фона и приведение к единому складскому виду.

Нейросеть ISNet даёт маску главного предмета, дальше выбирается самая крупная
связная область (сам флакон, а не реквизит), обрезается по ней и ставится
на общий прозрачный холст: один размер, один масштаб, одна тень.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
import onnxruntime as ort
import cv2

МОДЕЛЬ = os.path.expanduser('~/.claude/models/isnet-general-use.onnx')
КОРЕНЬ = '/Users/nick/Desktop/Волосы'
ВХОД = os.path.join(КОРЕНЬ, 'bot/фото-товаров')
ВЫХОД = os.path.join(КОРЕНЬ, 'site-shop/assets/photo/tovary')
ХОЛСТ = 1200          # сторона итогового квадрата
ДОЛЯ = 0.80           # какую долю высоты холста занимает товар
ОТСТУП_ТЕНИ = 18

сессия = ort.InferenceSession(МОДЕЛЬ, providers=['CPUExecutionProvider'])
вход_имя = сессия.get_inputs()[0].name


def маска(im):
    """Маска главного предмета в градациях серого, размер как у исходника."""
    ш, в = im.size
    м = im.convert('RGB').resize((1024, 1024), Image.LANCZOS)
    a = np.array(м).astype(np.float32) / 255.0
    a = (a - 0.5) / 1.0
    a = a.transpose(2, 0, 1)[None, ...]
    вых = сессия.run(None, {вход_имя: a})[0]
    p = вых[:, 0, :, :]
    mi, ma = p.min(), p.max()
    p = (p - mi) / (ma - mi + 1e-8)
    m = (p.squeeze() * 255).astype(np.uint8)
    return Image.fromarray(m).resize((ш, в), Image.LANCZOS)


def главная_область(маска_np, порог=140):
    """Самая крупная связная область маски — сам товар, без реквизита."""
    _, дв = cv2.threshold(маска_np, порог, 255, cv2.THRESH_BINARY)
    дв = cv2.morphologyEx(дв, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, метки, стат, _ = cv2.connectedComponentsWithStats(дв, 8)
    if n <= 1:
        return None, 0
    площади = стат[1:, cv2.CC_STAT_AREA]
    лучшая = 1 + int(np.argmax(площади))
    доля = площади.max() / float(маска_np.size)
    маска_области = (метки == лучшая).astype(np.uint8) * 255
    return маска_области, доля


# Кадры, где в кадре несколько флаконов или реквизит: доля исходника,
# внутри которой лежит нужный товар. (x0, y0, x1, y1) от 0 до 1.
ОБРЕЗКА = {
    't001': (0.22, 0.15, 0.66, 0.88),
    't003': (0.63, 0.08, 1.00, 0.70),
    't004': (0.30, 0.48, 0.72, 0.92),
    't005': (0.40, 0.13, 0.63, 0.95),
    't006': (0.42, 0.22, 0.72, 0.99),
    't008': (0.24, 0.22, 0.45, 1.00),
    't009': (0.30, 0.22, 0.95, 0.72),
    't017': (0.11, 0.28, 0.75, 0.85),
    't018': (0.31, 0.29, 0.66, 0.72),
    't019': (0.60, 0.10, 0.85, 0.78),
    't021': (0.22, 0.11, 0.49, 0.78),
    't031': (0.09, 0.33, 0.31, 0.66),
}


def обработать(путь, ид, только_главный=True):
    im = Image.open(путь).convert('RGB')
    if ид in ОБРЕЗКА:
        x0, y0, x1, y1 = ОБРЕЗКА[ид]
        ш, в = im.size
        im = im.crop((int(ш * x0), int(в * y0), int(ш * x1), int(в * y1)))
    м = маска(im)
    м_np = np.array(м)

    if только_главный:
        главная, доля = главная_область(м_np)
        if главная is not None:
            # сглаживаем края главной области и оставляем полутона из исходной маски
            главная = cv2.GaussianBlur(главная, (0, 0), 1.6)
            м_np = np.minimum(м_np, главная).astype(np.uint8)

    альфа = Image.fromarray(м_np)
    rgba = im.convert('RGBA')
    rgba.putalpha(альфа)

    # обрезка по непрозрачному
    bbox = альфа.point(lambda p: 255 if p > 24 else 0).getbbox()
    if not bbox:
        return None
    товар = rgba.crop(bbox)

    # единый холст: товар по центру, одинаковая высота
    цель_в = int(ХОЛСТ * ДОЛЯ)
    к = цель_в / товар.height
    if товар.width * к > ХОЛСТ * 0.86:      # широкие кадры не выпускаем за поля
        к = (ХОЛСТ * 0.86) / товар.width
    новый = товар.resize((max(1, int(товар.width * к)), max(1, int(товар.height * к))), Image.LANCZOS)

    холст = Image.new('RGBA', (ХОЛСТ, ХОЛСТ), (0, 0, 0, 0))
    x = (ХОЛСТ - новый.width) // 2
    y = (ХОЛСТ - новый.height) // 2

    # мягкая тень под товаром — одинаковая у всех, держит «складской» вид
    тень = Image.new('RGBA', (ХОЛСТ, ХОЛСТ), (0, 0, 0, 0))
    тш = int(новый.width * 0.82)
    тв = max(10, int(новый.height * 0.055))
    тx = (ХОЛСТ - тш) // 2
    тy = y + новый.height - тв // 2 + ОТСТУП_ТЕНИ
    эллипс = Image.new('L', (ХОЛСТ, ХОЛСТ), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(эллипс).ellipse([тx, тy, тx + тш, тy + тв], fill=88)
    эллипс = эллипс.filter(ImageFilter.GaussianBlur(16))
    тень.putalpha(эллипс)
    тень = Image.composite(Image.new('RGBA', (ХОЛСТ, ХОЛСТ), (26, 20, 16, 255)), тень, эллипс)
    тень.putalpha(эллипс)

    холст.alpha_composite(тень)
    холст.alpha_composite(новый, (x, y))
    os.makedirs(ВЫХОД, exist_ok=True)
    путь_вых = os.path.join(ВЫХОД, ид + '.png')
    холст.save(путь_вых)
    непрозр = (np.array(холст)[:, :, 3] > 24).mean()
    return {'файл': ид + '.png', 'заполнение': round(float(непрозр), 3), 'исходный_bbox': bbox}


if __name__ == '__main__':
    только = sys.argv[1:] if len(sys.argv) > 1 else None
    файлы = sorted(os.listdir(ВХОД))
    отчёт = []
    for ф in файлы:
        ид = ф.split('-')[0]
        if только and ид not in только:
            continue
        r = обработать(os.path.join(ВХОД, ф), ид)
        отчёт.append({'id': ид, **(r or {'ошибка': 'пустая маска'})})
        print(ид, r['заполнение'] if r else 'ПУСТО', flush=True)
    print(json.dumps(отчёт, ensure_ascii=False)[:200])
