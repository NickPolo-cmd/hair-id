// Номенклатура и письма поставщикам из поставщик/позиции.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const данные = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'поставщик/позиции.json'), 'utf8'));

const EN = {
  t001: 'Hair oil blend: jojoba & macadamia',
  t002: 'Deep cleansing scalp gel shampoo',
  t003: 'Root-lift styling oil',
  t004: 'Keratin hair mask with amino acids & camellia (Golden Series)',
  t005: 'Cream shampoo with hydrolyzed keratin & jojoba oil, sensitive scalp',
  t006: 'Concentrated cream shampoo with ginger extract',
  t007: 'Cream shampoo with tea tree oil for oily roots',
  t008: 'Shampoo with shea butter & hydrolyzed keratin for dry, coloured hair',
  t009: 'Shampoo with menthol extract for normal hair',
  t010: 'Nourishing conditioner with hydrolyzed collagen & rice germ extract',
  t011: 'Leave-in moisturising mask with collagen & macadamia oil',
  t012: 'Silk curl-defining cream, leave-in',
  t013: 'Reconstructing shampoo with argan oil',
  t015: 'Reconstructing conditioner with argan oil',
  t016: 'Conditioner-mask with avocado extract for severely damaged hair',
  t017: 'Repairing protein mask with panthenol',
  t018: 'Silk SPA mask with jojoba seed oil',
  t019: 'Straightening repair serum spray',
  t020: 'Macadamia hair oil',
  t021: 'Concentrated smoothing serum spray',
  t023: 'Volume Boost shampoo with biotin & collagen',
  t024: 'Volume Boost conditioner with biotin & collagen',
  t025: 'Volume Boost hair mask with biotin & collagen',
  t026: 'Organic argan oil 10-in-1',
  t028: 'Professional shampoo with shea butter for damaged hair',
  t029: 'Professional shampoo with panthenol & jojoba for sensitive scalp',
  t030: 'Professional shampoo with vitamin E & tea tree oil for oily hair',
  t031: 'Professional anti-dandruff shampoo with menthol',
  t032: 'Professional conditioner with collagen',
  t033: 'Professional deep repair mask with argan & jojoba oil',
  t034: 'Professional Hydro-SPA moisturising mask with hydrolyzed silk',
  t035: 'Leave-in intensive moisture mask with hyaluronic acid',
  t036: 'Silk leave-in curl cream with heat protection',
  t037: 'Moisturising styling serum spray with argan & carrot seed oil, heat protection',
  t038: 'Extra-moisture repair lotion for damaged hair',
  t039: 'Macadamia hair oil OLORCHEE',
};

const УПАКОВКА = {
  'Шампунь': 'Флакон ПЭТ/HDPE с помпой-дозатором',
  'Кондиционер': 'Флакон ПЭТ/HDPE с помпой-дозатором',
  'Маска': 'Банка ПП с винтовой крышкой (от 250 мл) / флакон с помпой',
  'Масло': 'Флакон стекло или ПЭТ с пипеткой либо помпой',
  'Сыворотка': 'Флакон с распылителем (спрей)',
  'Стайлинг': 'Флакон с распылителем',
  'Несмываемый уход': 'Флакон с помпой либо туба',
};

const ТНВЭД = к => (к === 'Шампунь' ? '3305 10 000 0' : '3305 90 000 9');
const ТНВЭД_ОПИС = к => (к === 'Шампунь' ? 'Шампуни' : 'Средства для волос прочие');

const п = данные.позиции;

// ── НОМЕНКЛАТУРА ────────────────────────────────────────────────────────────
let м = `# Номенклатура для запроса коммерческих предложений

Собрано из карточек товаров, присланных владельцем. Позиций: **${п.length}**.
Бренды: ${Object.keys(данные.бренды).join(', ')}.

**Как этим пользоваться.** Таблица ниже — то, что отправляется поставщику вместе
с письмом из \`ЗАПРОС-RFQ.md\`. Колонку «Розница» и «Целевая закупочная» заполняет
владелец: у меня нет ваших розничных цен, кроме одной, а придумывать их нельзя —
от них считается вся экономика закупки.

Ориентир для расчёта: закупочная цена, при которой розница держится, — это
**30–40 % от розничной**. Ниже 30 % поставщик обычно не идёт, выше 45 % торговать
уже невыгодно после логистики и сертификации.

`;

for (const бренд of Object.keys(данные.бренды)) {
  const свои = п.filter(x => x.бренд === бренд);
  const б = данные.бренды[бренд];
  м += `## ${бренд} — ${свои.length} позиций\n\n${б.легенда}. Заявленная страна: ${б.страна}.\n\n`;
  м += `| № | Наименование (рус) | Name (EN) | Категория | Объём | Упаковка | ТН ВЭД | Розница, ₽ | Закупочная, ₽ |\n`;
  м += `|---|---|---|---|---|---|---|---|---|\n`;
  свои.forEach((x, i) => {
    м += `| ${i + 1} | ${x.название} | ${EN[x.id] || '—'} | ${x.категория} | ${x.объём} | ${УПАКОВКА[x.категория] || '—'} | ${ТНВЭД(x.категория)} | ${x.розница || '—'} | — |\n`;
  });
  м += `\n`;
}

м += `## Коды ТН ВЭД — что писать в декларации\n
| Код | Что относится | Позиций |\n|---|---|---|\n`;
const поКоду = {};
for (const x of п) { const к = ТНВЭД(x.категория); поКоду[к] = (поКоду[к] || 0) + 1; }
for (const [к, n] of Object.entries(поКоду)) м += `| ${к} | ${ТНВЭД_ОПИС(к === '3305 10 000 0' ? 'Шампунь' : 'Маска')} | ${n} |\n`;

м += `
## Технические требования к каждой позиции

Это то, что поставщик обязан подтвердить письменно до оплаты:

1. **Полный состав (INCI)** на английском — сверяем с тем, что заявлено в карточке товара.
2. **Декларация соответствия ТР ТС 009/2011** «О безопасности парфюмерно-косметической продукции»
   либо готовность оформить её на нашу компанию. Без неё продажа в России незаконна.
3. **Срок годности** от даты производства и остаточный срок на момент отгрузки — требуем не менее 80 %.
4. **Этикетка на русском языке**: состав, объём, срок годности, изготовитель, импортёр, условия хранения.
5. **Штрихкод EAN-13** на каждой единице — иначе позиция не встанет ни в один учёт.
6. **Транспортная упаковка**: количество в коробе, вес брутто/нетто, габариты короба.
7. **Образцы** до основного заказа — по одной единице каждой позиции.

## Состав по каждой позиции (для сверки с поставщиком)

`;

for (const x of п) {
  м += `### ${x.название} (${x.бренд}, ${x.объём})\n\n`;
  if (x.польза.length) м += x.польза.map(s => '- ' + s).join('\n') + '\n\n';
  if (x.состав) м += `**Состав:** ${x.состав}\n\n`;
  else м += `**Состав:** в присланной карточке не указан — запросить у поставщика.\n\n`;
}

fs.writeFileSync(path.join(КОРЕНЬ, 'поставщик/НОМЕНКЛАТУРА.md'), м);
console.log('НОМЕНКЛАТУРА.md:', м.length, 'знаков,', п.length, 'позиций');
