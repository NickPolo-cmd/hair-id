# -*- coding: utf-8 -*-
"""Собирает по одному видео на каждое объявление из его же фотографий.

Медленный наезд на каждый кадр плюс перекрёстное затухание между ними.
Звука нет намеренно: Авито показывает превью без звука, а музыка требует прав.
"""
import os, subprocess, sys

КОРЕНЬ = '/Users/nick/Desktop/Волосы'
БАЗА = os.path.join(КОРЕНЬ, 'avito/ФОТО-И-ВИДЕО')
Ш, В = 1080, 1440
КАДР = 2.8          # секунд на снимок
ПЕРЕХОД = 0.6       # длительность затухания
ЧАСТОТА = 25
СНИМКОВ = 6


def собрать(папка):
    путь = os.path.join(БАЗА, папка)
    фото = sorted(f for f in os.listdir(путь) if f.lower().endswith('.jpg'))[:СНИМКОВ]
    if len(фото) < 2:
        return None
    вых = os.path.join(путь, 'видео.mp4')

    кадров = int(КАДР * ЧАСТОТА)
    вход, фильтры = [], []
    for i, ф in enumerate(фото):
        # ровно один входной кадр: zoompan сам размножит его на нужную длительность.
        # если подать поток кадров, каждый из них будет размножен — ролик раздувается в десятки раз
        вход += ['-loop', '1', '-framerate', '1', '-t', '1', '-i', os.path.join(путь, ф)]
        # наезд: чётные кадры приближаются, нечётные отдаляются — не выглядит однообразно
        if i % 2 == 0:
            z = "min(1+0.0012*on,1.10)"
        else:
            z = "max(1.10-0.0012*on,1.0)"
        фильтры.append(
            "[%d:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
            "zoompan=z='%s':d=%d:s=%dx%d:fps=%d,setsar=1[v%d]"
            % (i, int(Ш * 1.3), int(В * 1.3), int(Ш * 1.3), int(В * 1.3), z, кадров, Ш, В, ЧАСТОТА, i)
        )

    # цепочка перекрёстных затуханий
    поток = 'v0'
    смещение = КАДР - ПЕРЕХОД
    for i in range(1, len(фото)):
        новый = 'x%d' % i
        фильтры.append("[%s][v%d]xfade=transition=fade:duration=%.2f:offset=%.2f[%s]"
                       % (поток, i, ПЕРЕХОД, смещение, новый))
        поток = новый
        смещение += КАДР - ПЕРЕХОД

    команда = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + вход + [
        '-filter_complex', ';'.join(фильтры),
        '-map', '[%s]' % поток,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        вых,
    ]
    r = subprocess.run(команда, capture_output=True, text=True)
    if r.returncode != 0:
        print('ОШИБКА', папка, r.stderr[-400:])
        return None
    return вых, os.path.getsize(вых), len(фото)


if __name__ == '__main__':
    папки = sys.argv[1:] or sorted(d for d in os.listdir(БАЗА) if os.path.isdir(os.path.join(БАЗА, d)))
    for п in папки:
        r = собрать(п)
        if r:
            print(п, '->', round(r[1] / 1048576, 1), 'МБ, кадров:', r[2], flush=True)
