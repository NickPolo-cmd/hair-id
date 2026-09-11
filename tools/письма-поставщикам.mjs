import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const данные = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'поставщик/позиции.json'), 'utf8'));
const п = данные.позиции;

const счёт = {};
for (const x of п) счёт[x.категория] = (счёт[x.категория] || 0) + 1;
const свод = Object.entries(счёт).map(([к, n]) => `${к.toLowerCase()} — ${n}`).join(', ');

const строкиРус = п.map((x, i) => `${i + 1}. ${x.название} — ${x.объём}`).join('\n');

const EN_KAT = { 'Шампунь': 'shampoo', 'Кондиционер': 'conditioner', 'Маска': 'hair mask', 'Масло': 'hair oil', 'Сыворотка': 'serum / spray', 'Стайлинг': 'styling', 'Несмываемый уход': 'leave-in' };
const строкиАнгл = п.map((x, i) => `${i + 1}. ${EN_KAT[x.категория] || x.категория} — ${x.объём}`).join('\n');

const м = `# Письма поставщикам — готовые к отправке

Два письма: по-русски для Беларуси, по-английски для Китая. Перед отправкой
подставьте свои данные в квадратных скобках — это единственное, что нужно дописать.
К письму прикладывается таблица из \`НОМЕНКЛАТУРА.md\`.

**Позиций в запросе: ${п.length}** (${свод}).

---

## Письмо 1. Беларусь (по-русски)

**Тема письма:** Запрос коммерческого предложения — профессиональный уход за волосами, ${п.length} позиций

\`\`\`
Здравствуйте!

Меня зовут Ирина Давыдова, я парикмахер-стилист, работаю в Ленинградской области
(Всеволожский район). Продаю профессиональный уход своим клиентам и открываю
розничную продажу через собственный сайт.

Прошу направить коммерческое предложение на закупку продукции для волос.
Интересует прямая работа с производителем, без посредников.

ЧТО НУЖНО — ${п.length} позиций:

${строкиРус}

ЧТО ПРОШУ УКАЗАТЬ В ПРЕДЛОЖЕНИИ:

1. Цену за единицу при закупке пробной партии и при основной закупке.
2. Минимальную партию (MOQ) — по каждой позиции и по заказу в целом.
3. Минимальную сумму заказа.
4. Срок изготовления и отгрузки.
5. Наличие декларации соответствия ТР ТС 009/2011 «О безопасности
   парфюмерно-косметической продукции» — либо готовность её оформить.
6. Срок годности продукции и остаточный срок на момент отгрузки.
7. Возможность контрактного производства под нашей маркой (private label)
   и минимальную партию для него.
8. Наличие этикетки на русском языке и штрихкода EAN-13.
9. Условия доставки в Санкт-Петербург и её стоимость.
10. Возможность получить образцы до основного заказа и их стоимость.

Готова начать с пробной партии и при хорошем результате перейти
к регулярным заказам.

С уважением,
Ирина Давыдова
Hair ID, д. Нижние Осельки, Всеволожский район, Ленинградская область
Телефон / WhatsApp: [ваш телефон]
Почта: [ваша почта]
Сайт: [адрес сайта]
\`\`\`

---

## Письмо 2. Китай (по-английски)

**Subject:** RFQ — professional hair care products, ${п.length} SKUs, private label possible

\`\`\`
Dear Sir or Madam,

My name is Irina Davydova. I am a professional hairdresser based in the
Leningrad Region, Russia. I sell professional hair care to my clients and
I am launching retail sales through my own website.

I would like to request a quotation for the products listed below.
I am looking to work directly with the manufacturer.

REQUIRED — ${п.length} SKUs:

${строкиАнгл}

The full specification (product names, key active ingredients, volumes,
packaging type and HS codes) is attached as a separate table.

PLEASE INCLUDE IN YOUR QUOTATION:

1. Unit price for a trial order and for a regular order.
2. MOQ per SKU and for the whole order.
3. Minimum order value.
4. Production and shipping lead time.
5. Full INCI list for every product, in English.
6. Certification: are you able to provide documents for EAC / TR CU 009/2011
   (Technical Regulation of the Customs Union on the safety of perfumery
   and cosmetic products)? This is mandatory for sale in Russia.
7. Shelf life and remaining shelf life at the time of shipment
   (we require at least 80% remaining).
8. Private label / OEM: is it available, and what is the MOQ for it?
9. Russian-language labelling and EAN-13 barcode — can you provide them?
10. Delivery terms to Saint Petersburg, Russia (FOB / CIF / DDP) and cost.
11. Samples before the main order: availability and cost.
12. Payment terms.

I intend to start with a trial order and move to regular purchasing
if the quality meets expectations.

Best regards,
Irina Davydova
Hair ID, Nizhnie Oselki, Leningrad Region, Russia
Phone / WhatsApp: [your phone]
Email: [your email]
Website: [your website]
\`\`\`

---

## О чём спросить обязательно, даже если предложение выглядит хорошим

**Документы.** Без декларации ТР ТС 009/2011 продавать косметику в России нельзя —
ни на сайте, ни на Авито, ни с рук. Держателем декларации может быть импортёр,
то есть вы. Оформление на 36 позиций стоит денег и времени, поэтому сразу
спрашивайте, есть ли готовая декларация у поставщика и можно ли работать под ней.

**Маркировка «Честный знак».** Правила по косметике менялись несколько раз, и
списки товаров, попадающих под обязательную маркировку, расширяются постепенно.
Перед закупкой проверьте по коду ТН ВЭД на сайте «Честного знака», нужна ли
маркировка вашим позициям, и спросите поставщика, наносит ли коды он или это
придётся делать вам.

**Почему Беларусь проще.** Внутри ЕАЭС нет таможенного оформления и ввозной пошлины,
декларация ТР ТС действует единая, доставка идёт 2–3 дня. Из Китая дешевле по цене
единицы, но добавляются пошлина, НДС на ввозе, доставка 30–45 дней и оформление
документов на русском языке.

**Проверка поставщика.** Прежде чем платить: запросить копию свидетельства
о регистрации компании, проверить, сколько лет профилю на площадке, оплатить
пробную партию через защищённую сделку площадки, а не переводом на карту.
`;

fs.writeFileSync(path.join(КОРЕНЬ, 'поставщик/ЗАПРОС-RFQ.md'), м);
console.log('ЗАПРОС-RFQ.md:', м.length, 'знаков');
