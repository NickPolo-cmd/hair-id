# -*- coding: utf-8 -*-
"""Аватар и обложка профиля Авито в фирменных цветах Hair ID."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

КОРЕНЬ = '/Users/nick/Desktop/Волосы'
ЛОГО = os.path.join(КОРЕНЬ, 'site/assets/logo')
ВЫХОД = os.path.join(КОРЕНЬ, 'avito/ПРОФИЛЬ')
os.makedirs(ВЫХОД, exist_ok=True)

ЗЕЛЁНЫЙ_700 = (28, 38, 32)
ЗЕЛЁНЫЙ_900 = (16, 22, 15)
ЗОЛОТО_400 = (192, 160, 112)
ЗОЛОТО_200 = (226, 200, 159)
КРЕМ = (250, 247, 241)

ШРИФТЫ = [
    '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
]


def шрифт(размер, жирный=False):
    для = ['/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf'] + ШРИФТЫ if жирный else ШРИФТЫ
    for п in для:
        if os.path.exists(п):
            try:
                return ImageFont.truetype(п, размер)
            except Exception:
                continue
    return ImageFont.load_default()


def аватар():
    """1000x1000 — квадрат профиля. Берём готовый фирменный знак."""
    им = Image.open(os.path.join(ЛОГО, 'hair-id-badge-ru.jpg')).convert('RGB')
    им = им.resize((1000, 1000), Image.LANCZOS)
    п = os.path.join(ВЫХОД, 'аватар-1000.jpg')
    им.save(п, quality=94, subsampling=1)
    return п


def обложка():
    """1500x300 — шапка профиля: знак слева, название и суть справа."""
    Ш, В = 1500, 300
    хол = Image.new('RGB', (Ш, В), ЗЕЛЁНЫЙ_700)
    d = ImageDraw.Draw(хол)

    # мягкое свечение, чтобы плашка не читалась плоской заливкой
    свет = Image.new('L', (Ш, В), 0)
    ImageDraw.Draw(свет).ellipse([-200, -260, 760, 320], fill=70)
    свет = свет.filter(ImageFilter.GaussianBlur(120))
    хол = Image.composite(Image.new('RGB', (Ш, В), (38, 50, 42)), хол, свет)
    d = ImageDraw.Draw(хол)

    знак = Image.open(os.path.join(ЛОГО, 'hair-id-monogram.png')).convert('RGBA')
    к = 190 / знак.height
    знак = знак.resize((round(знак.width * к), 190), Image.LANCZOS)
    хол.paste(знак, (90, (В - знак.height) // 2), знак)

    x = 90 + знак.width + 70
    d.text((x, 70), 'HAIR ID', font=шрифт(66, True), fill=ЗОЛОТО_200)
    d.line([(x + 3, 160), (x + 240, 160)], fill=ЗОЛОТО_400, width=2)
    d.text((x + 3, 180), 'СТУДИЯ ВОЛОС · УХОД ДОМОЙ', font=шрифт(27), fill=ЗОЛОТО_400)
    d.text((x + 3, 222), 'д. Нижние Осельки, Всеволожский район', font=шрифт(24), fill=(196, 190, 178))

    п = os.path.join(ВЫХОД, 'обложка-1500x300.jpg')
    хол.save(п, quality=94, subsampling=1)
    return п


if __name__ == '__main__':
    for ф in (аватар(), обложка()):
        им = Image.open(ф)
        print(os.path.basename(ф), им.size, round(os.path.getsize(ф) / 1024), 'КБ')
