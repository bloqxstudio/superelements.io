# Entrega — ProcessBase e Júnior Automáticos

- `*-feed.png`: arte de Feed, 1080 × 1350.
- `*-story.png`: arte de Story, 1080 × 1920.
- `*-desktop.mp4`: navegação desktop pelas páginas, Full HD, sem áudio.
- `processbase-video-4x5.mp4`: vídeo de Feed em 1080 × 1350 (4:5), 33 s, 30 fps, sem áudio. Foco na animação: grafo, formação do emblema, giro em 3D e pilares, e depois o site real no desktop e no celular. Capa sugerida em `processbase-video-capa.png`. A fonte para renderizar de novo está em `processbase-video-fonte/`.
- `LEGENDAS.md`: legendas e duas variações de anúncio por case.

Direção: portfólio de criação de sites, com convite para o Direct. Nenhuma assinatura ou contato foi inventado. Os arquivos estão prontos para revisão e postagem manual; nada foi publicado e nenhuma campanha foi criada.

Os vídeos foram montados no FFmpeg a partir de quadros capturados diretamente das páginas, porque a captura da janela pelo Windows retornou tela preta. São quadros reais, preservando o tempo da captura, exportados em H.264 a 30 fps; a captura original tem cadência menor que 30 fps.

Fontes editáveis no projeto: `public/case-social.html` (artes), `public/case-recording.html` (navegação), `artifacts/cases-desktop/encode.mjs` (montagem no FFmpeg).
