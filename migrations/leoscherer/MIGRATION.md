# Leo Scherer — migração para Elementor nativo

Fonte: https://leoscherer.com.br/

## Estado

- `survey`: concluído em 2026-09-28
- `design-system`: concluído
- `templates Elementor`: concluídos e validados no renderer local
- `verificação visual`: concluída em 1440px e 390px

## Resultado da validação

- Home: 12 seções, 49 containers, 89 widgets nativos, 23 imagens locais e um vídeo YouTube; zero HTML, incompatibilidades, avisos, IDs duplicados ou seções sem container.
- Categoria: 3 seções, 13 containers, 27 widgets nativos e 8 imagens locais; zero HTML, incompatibilidades, avisos, IDs duplicados ou seções sem container.
- Produto: 3 seções, 10 containers, 24 widgets nativos e 7 imagens locais; zero HTML, incompatibilidades, avisos, IDs duplicados ou seções sem container.
- 1440px e 390px: sem overflow horizontal, imagens quebradas ou títulos cortados no mobile.
- `npm.cmd run build`: passou. ESLint direcionado: passou.

## Inventário e famílias de template

O site público é WordPress + WooCommerce, com a home montada em Elementor. O sitemap expõe 2.094 URLs de produto (incluindo produtos históricos e duplicações), nove categorias e páginas de infraestrutura do WooCommerce. Elas se agrupam em três templates visuais públicos:

1. **Home editorial** — `/`; cabeçalho desktop e mobile, hero do lançamento, destaques novos/seminovos, Watch, carrosséis de produtos, AirPods, história, categorias, vídeo, simulação, serviços, newsletter e rodapé.
2. **Categoria/listagem** — nove URLs em `/categoria-produto/*`; título, grade de produtos e paginação/filtros do WooCommerce.
3. **Produto** — `/produto/*`; galeria, nome, preço/estado, variações e ação de compra/negociação.

Páginas `/loja`, `/carrinho`, `/finalizar-compra`, `/minha-conta`, `/juros`, `/novos`, `/helpie_faq_page`, `/redirect` e `/evercompare` pertencem à infraestrutura ou a páginas antigas. Elas não formam novas famílias de apresentação para esta importação.

## Navegação e regiões compartilhadas

- Cabeçalho desktop: marca LS, busca, ícone da Tua Case e menu iPhone, Seminovos, Watch, Mac, AirPods, iPad, JBL, Acessórios e “Simule sua compra”.
- Cabeçalho mobile: marca, busca e navegação condensada.
- Rodapé: aviso de reajuste de preço pelo dólar e crédito da agência.
- Fundo predominantemente preto, alternando uma faixa branca de AirPods e superfícies `#101010`.

## Sistema visual medido

- Breakpoints próprios relevantes: `1024px` (tablet) e `767px` (mobile); há regras legadas adicionais do Storefront/WooCommerce.
- Conteúdo desktop: aproximadamente 1120px, centralizado.
- Home medida: 7.075px de altura em 1440×900; 9.659px em 390×900.
- Fontes calculadas: Helvetica para títulos e peças editoriais; Source Sans Pro para texto do tema; Inter aparece no crédito do rodapé.
- Hero desktop: 52/52px, peso 600; subtítulo 31/31px. Destaque Watch: 40/40px, peso 500. Título imersivo: 75/75px, peso 600.
- Cores recorrentes: preto `#000000`, elevado `#101010`, branco `#FFFFFF`, texto do tema `#6D6D6D`, roxo WooCommerce `#7F54B3`, azul de ação `#6EC1E4`, vermelho de destaque `#FF0000`/`#F60606`.
- Gradientes medidos: hero e história usam radial de `#151C25` para `#010101`; a área de simulação usa radial de `#0B1B33` para `#00040A` e preto.
- Cantos e sombras são raros; cartões de produto são essencialmente imagens quadradas e tipografia pequena. Movimento vem de entradas do Elementor e carrosséis, com regras de `prefers-reduced-motion` já presentes na origem.

## Ativos

- Os ativos públicos necessários serão copiados para `public/leoscherer/assets/`; não haverá hotlink em tempo de execução.
- A origem carrega Helvetica como fonte de sistema. A importação declara a pilha `Helvetica, Arial, sans-serif`; não há arquivo de Helvetica para transportar.
- Source Sans Pro pode ser instalada no Elementor ou cair na pilha de sistema descrita no handoff.

## Conteúdo dinâmico e integrações

- Catálogo, preços, disponibilidade, busca, variações, carrinho, checkout e conta dependem do WooCommerce da origem.
- A newsletter depende do Mailchimp/HT Newsletter.
- O simulador abre uma experiência própria da origem.
- O vídeo imersivo usa YouTube e um MP4 público do site.
- Links de WhatsApp/Instagram/Tua Case são externos.

## Não atravessa automaticamente

- Banco de produtos, estoque, preços e histórico de 2.094 URLs.
- Sessão de usuário, carrinho, checkout, meios de pagamento e pedidos.
- Backend da newsletter e do simulador.
- Analytics, pixels, popups de marketing e scripts de terceiros.

O projeto Elementor reproduz os três templates como conteúdo editável e deixa os links de compra/negociação apontando para a origem. Para transformar o resultado em uma loja operacional, é necessário conectar um WooCommerce no WordPress de destino e mapear os widgets/consultas dinâmicas.
