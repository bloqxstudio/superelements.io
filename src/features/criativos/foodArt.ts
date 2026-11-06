/**
 * Ilustrações provisórias do modelo de delivery (pratos, moto, carrinho), em SVG
 * como endereço `data:`. Servem para o vídeo sair inteiro na hora; o certo é
 * trocar pela foto recortada do cardápio do cliente (o botão Imagem do editor).
 */

const svg = (w: number, h: number, body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`

const pepperoni = [
  [300, 210], [430, 300], [250, 380], [380, 430], [520, 200], [560, 360], [190, 270], [450, 540], [300, 540], [600, 470], [180, 460],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="44" fill="#b3261e"/><circle cx="${x - 10}" cy="${y - 12}" r="14" fill="#d94a3a" opacity=".7"/>`)
  .join('')

export const PIZZA = svg(
  760,
  760,
  `<defs><radialGradient id="c" cx=".45" cy=".4"><stop offset="0" stop-color="#ffd27a"/><stop offset=".8" stop-color="#f3a83b"/><stop offset="1" stop-color="#e08a2a"/></radialGradient></defs>
  <ellipse cx="380" cy="400" rx="370" ry="352" fill="#000" opacity=".18"/>
  <circle cx="380" cy="380" r="360" fill="#c9732a"/><circle cx="380" cy="380" r="330" fill="#e8a046"/>
  <circle cx="380" cy="380" r="300" fill="#c8402c"/><circle cx="380" cy="380" r="292" fill="url(#c)"/>
  ${pepperoni}
  <g fill="#2f6b2a">${[[340, 330], [500, 420], [230, 520], [420, 180]].map(([x, y]) => `<path d="M${x} ${y}c18-22 44-22 52 0c-14 18-36 20-52 0z"/>`).join('')}</g>`
)

export const BURGER = svg(
  760,
  700,
  `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b453"/><stop offset="1" stop-color="#c9701f"/></linearGradient></defs>
  <ellipse cx="380" cy="660" rx="330" ry="34" fill="#000" opacity=".2"/>
  <path d="M90 560h580c0 60-40 90-100 90H190c-60 0-100-30-100-90z" fill="#d98a35"/>
  <path d="M70 480c40-30 580-30 620 0c10 50-30 80-80 80H150c-50 0-90-30-80-80z" fill="#5a2f17"/>
  <path d="M80 470c60 10 90 70 120 20c30 50 70-10 110 20c40 30 70-30 110 0c40 30 80-20 110 10c30 30 70-20 110 0l20-40H80z" fill="#ffc21a"/>
  <path d="M60 420c40-40 600-40 640 0c0 40-30 60-80 60H140c-50 0-80-20-80-60z" fill="#4b2512"/>
  <path d="M50 400c30-30 60 20 90-10s60 20 90-10 60 20 90-10 60 20 90-10 60 20 90-10 60 20 90-10 60 20 90-10l10 30H40z" fill="#4caf3b"/>
  <ellipse cx="250" cy="385" rx="110" ry="22" fill="#d6372b"/><ellipse cx="510" cy="385" rx="110" ry="22" fill="#d6372b"/>
  <path d="M80 360C80 140 680 140 680 360z" fill="url(#b)"/>
  <path d="M170 230c60-60 200-70 260-50" stroke="#fff" stroke-opacity=".35" stroke-width="22" fill="none" stroke-linecap="round"/>
  ${[[220, 260], [300, 220], [390, 210], [470, 230], [540, 270], [350, 290], [450, 300], [260, 320], [560, 330]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="12" ry="7" fill="#fff4d6" transform="rotate(${(x % 50) - 25} ${x} ${y})"/>`).join('')}`
)

const roll = (x: number, y: number, fish: string) =>
  `<g transform="translate(${x} ${y})"><circle r="78" fill="#1d2a1f"/><circle r="64" fill="#f7f3ea"/><circle r="34" fill="${fish}"/><circle cx="-10" cy="-10" r="10" fill="#fff" opacity=".4"/></g>`

export const SUSHI = svg(
  800,
  560,
  `<rect x="30" y="140" width="740" height="360" rx="30" fill="#000" opacity=".2" transform="translate(10 20)"/>
  <rect x="30" y="140" width="740" height="360" rx="30" fill="#b9864f"/><rect x="30" y="140" width="740" height="40" rx="20" fill="#d6a46a"/>
  ${[150, 310, 470, 630].map((x, i) => roll(x, 250, i % 2 ? '#f08a5d' : '#e8543f')).join('')}
  ${[230, 390, 550].map((x) => `<g transform="translate(${x} 400)"><ellipse rx="70" ry="38" fill="#f7f3ea"/><path d="M-80 -6c40-40 120-40 160 0c-40 20-120 20-160 0z" fill="#f47a4a"/><path d="M-60 -10h120" stroke="#ffd2b8" stroke-width="6"/></g>`).join('')}`
)

export const SALAD = svg(
  760,
  560,
  `<ellipse cx="380" cy="500" rx="330" ry="40" fill="#000" opacity=".2"/>
  <path d="M60 260h640c0 170-140 270-320 270S60 430 60 260z" fill="#f4f1ea"/><path d="M60 260h640c-10 30-30 40-60 40H120c-30 0-50-10-60-40z" fill="#dcd6c8"/>
  ${[[150, 240, '#57b947'], [250, 200, '#3e9a35'], [360, 190, '#6cc757'], [470, 205, '#3e9a35'], [580, 235, '#57b947'], [300, 250, '#2f7d2a'], [520, 255, '#6cc757']].map(([x, y, c]) => `<path d="M${x} ${y}c-60-70 40-120 80-60c50-50 110 30 50 70c-40 30-100 30-130-10z" fill="${c}"/>`).join('')}
  ${[[230, 230], [430, 225], [560, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="#e2412f"/><circle cx="${x - 8}" cy="${y - 8}" r="10" fill="#fff" opacity=".35"/>`).join('')}
  ${[[330, 225], [480, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="22" fill="#f4d35e"/>`).join('')}`
)

/** Entregador de moto, de perfil, indo para a direita. */
export const MOTO = (color: string) =>
  svg(
    900,
    620,
    `<ellipse cx="450" cy="590" rx="380" ry="22" fill="#000" opacity=".15"/>
  <circle cx="200" cy="480" r="110" fill="#1f1f24"/><circle cx="200" cy="480" r="58" fill="#e9e9ee"/><circle cx="200" cy="480" r="22" fill="#1f1f24"/>
  <circle cx="700" cy="480" r="110" fill="#1f1f24"/><circle cx="700" cy="480" r="58" fill="#e9e9ee"/><circle cx="700" cy="480" r="22" fill="#1f1f24"/>
  <path d="M200 480L330 360h260l110 120" stroke="#6b6b75" stroke-width="26" fill="none" stroke-linejoin="round"/>
  <path d="M300 300c40-60 260-70 330-10l60 90c-90 30-300 30-400 0z" fill="${color}"/>
  <path d="M620 250l90-80" stroke="#2b2b30" stroke-width="22" stroke-linecap="round"/>
  <rect x="150" y="120" width="190" height="170" rx="18" fill="${color}"/><rect x="150" y="120" width="190" height="34" rx="12" fill="#000" opacity=".15"/>
  <path d="M420 290l40-150c10-40 60-50 80-10l30 80-60 20z" fill="#f2f2f5"/>
  <circle cx="505" cy="95" r="62" fill="${color}"/><path d="M470 80h80v40h-80z" fill="#1f1f24" opacity=".85"/>
  <path d="M470 300l-40 120h50l40-100z" fill="#2b2b30"/>`
  )

/** Carrinho de compras (o botão da etiqueta de preço). */
export const CART = (color: string) =>
  svg(
    120,
    120,
    `<circle cx="60" cy="60" r="60" fill="${color}"/>
  <path d="M28 36h12l10 38h36l8-28H44" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="54" cy="88" r="6" fill="#fff"/><circle cx="82" cy="88" r="6" fill="#fff"/>`
  )

/** Pino de mapa. */
export const PIN = (color: string) =>
  svg(160, 220, `<path d="M80 210C30 140 8 110 8 76a72 72 0 0 1 144 0c0 34-22 64-72 134z" fill="${color}"/><circle cx="80" cy="76" r="28" fill="#fff"/>`)

/** Celular com a lista de pedidos na tela. */
export const PHONE = (color: string) =>
  svg(
    520,
    1000,
    `<rect x="10" y="10" width="500" height="980" rx="70" fill="#16161a"/><rect x="34" y="34" width="452" height="932" rx="50" fill="#fafafa"/>
  <rect x="190" y="52" width="140" height="34" rx="17" fill="#16161a"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<g transform="translate(64 ${130 + i * 138})"><rect width="96" height="96" rx="22" fill="${i % 2 ? '#2b2b30' : color}"/><rect x="120" y="14" width="${180 - (i % 3) * 30}" height="20" rx="10" fill="#2b2b30"/><rect x="120" y="50" width="150" height="14" rx="7" fill="#c7c7cf"/><rect x="120" y="74" width="90" height="14" rx="7" fill="#b9a7f5"/></g>`).join('')}`
  )

/** Mão segurando (atrás do celular). */
export const HAND = (color: string) =>
  svg(
    620,
    760,
    `<path d="M120 760c-40-160-30-320 60-400l60-50c30-26 70-10 70 30v60l120-150c26-32 70-14 66 26l-10 90 40-40c28-28 70-6 62 32l-40 190c-30 140-120 210-200 212z" fill="${color}"/>`
  )
