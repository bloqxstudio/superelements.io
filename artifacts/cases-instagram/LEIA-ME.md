# Entrega — ProcessBase, Júnior Automáticos e MSA

- `*-feed.png`: arte de Feed, 1080 × 1350.
- `*-story.png`: arte de Story, 1080 × 1920.
- `*-desktop.mp4`: navegação desktop pelas páginas, Full HD, sem áudio.
- `processbase-video-4x5.mp4`: vídeo de Feed em 1080 × 1350 (4:5), 33 s, 30 fps, sem áudio. Foco na animação: grafo, formação do emblema, giro em 3D e pilares, e depois o site real no desktop e no celular. Capa sugerida em `processbase-video-capa.png`. A fonte para renderizar de novo está em `processbase-video-fonte/`.
- `msa-video-4x5.mp4`: vídeo de Feed da MSA em 1080 × 1350 (4:5), 40 s, 30 fps, sem áudio. A homepage rola do início ao fim entre duas margens: a marca em cima e as cinco partes da página embaixo. O preloader e o movimento são os do site real. Fecha num card com o projeto e o convite para o Direct. Capa sugerida em `msa-video-capa.png`. Fonte em `msa-video-fonte/`, gravada quadro a quadro no relógio virtual. Antes de postar, o Henrique ainda precisa confirmar os direitos das fotos e aprovar as linhas novas da copy (`brands/marketing-sem-agencia/COPY.md`).
- `processbase-tela-4x5.mp4` e `processbase-tela-1x1.mp4`: vídeo no formato dos posts da Awwwards (o site numa tela no centro, sobre um fundo desfocado dele mesmo), 34 s, 30 fps, sem áudio e sem texto. Rola o site publicado de seção em seção com easing, com a história do emblema tocando como animação. Feito em JS, quadro a quadro; a fonte e o jeito de gravar outro case estão em `formato-awwwards/`.
- `LEGENDAS.md`: legendas e duas variações de anúncio por case.

Direção: portfólio de criação de sites, com convite para o Direct. Nenhuma assinatura ou contato foi inventado. Os arquivos estão prontos para revisão e postagem manual; nada foi publicado e nenhuma campanha foi criada.

Os vídeos foram montados no FFmpeg a partir de quadros capturados diretamente das páginas, porque a captura da janela pelo Windows retornou tela preta. São quadros reais, preservando o tempo da captura, exportados em H.264 a 30 fps; a captura original tem cadência menor que 30 fps.

Fontes editáveis no projeto: `public/case-social.html` (artes), `public/case-recording.html` (navegação), `artifacts/cases-desktop/encode.mjs` (montagem no FFmpeg).
