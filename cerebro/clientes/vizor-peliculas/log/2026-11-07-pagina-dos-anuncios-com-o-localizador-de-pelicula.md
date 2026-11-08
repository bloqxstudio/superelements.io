# Página dos anúncios com o localizador de película

**Data:** 2026-11-07 · **Iniciativa:** vizor-peliculas · **Quem:** agente, a pedido do Igor

## O que aconteceu

O usuário pediu uma página dentro do site da Vizor com o formulário "Encontrar minha película" embutido, para ser o destino dos anúncios.

## O que entregamos

- `https://vizorpeliculas.com.br/encontrar-pelicula/` no ar (repositório `bloqxstudio/Vizorpeliculas`, commits `ca0c772` e `4168ea6`, Hostinger a partir da `main`).
- O formulário embutido (capa, cartões das marcas, modelo e ano, card do produto e WhatsApp automático), três cartões de confiança (100% nacional, brilho ou fosco, mais de 200 modelos de 17 marcas) e o logo no rodapé.
- Sem o preloader e sem o botão flutuante do WhatsApp (props `preloader` e `whatsapp` no `Layout.astro`), para a pessoa passar pela busca.
- No app: marca destaca o modelo sem abrir a lista no iPhone; fotos do produto em WebP leve e pré-carregadas.

## O que aprendemos

- O servidor redireciona o endereço sem a barra final: usar `/encontrar-pelicula/` nos anúncios.

## Próximo passo

- Republicar o formulário no editor (fotos leves) e decidir se as fotos ficam no app ou passam para a conta da Vizor.
- Ligar a conta de anúncios e conferir o pixel do formulário.
