# /lp — Sinfy · revisão 01/11/2026

## Propósito
Conectar a aquisição feita pela agência ao atendimento e às vendas registradas pelo cliente, mostrando cada etapa da operação.

## Pessoa principal
Dono de agência avaliando a plataforma no computador ou celular para entregar serviço + produto aos negócios que atende.

## Princípios, em ordem
1. A operação é a demonstração: priorizar funil, eventos e telas reais em vez de promessas genéricas.
2. Tempo real precisa de contexto: CRM e site mostram eventos; anúncios seguem a sincronização da fonte.
3. Cada seção muda a leitura: abertura grafite, demo clara, pausa editorial, produto em fundo escuro, oferta clara.
4. Uma identidade, contrastes diferentes: Inter e lima existentes; CTAs em cápsula, controles de ícone circulares; sem neon ou vidro.
5. Evidência sem exposição: recortes reais sem contatos pessoais; simulações identificadas; nenhuma prova social inventada.

## Sucesso observável
Ao percorrer o hero e o funil, a pessoa consegue explicar onde uma oportunidade está, quem age e como acompanhar os avanços. Consegue explorar etapas e chegar ao plano Agência.

## Fora do escopo
- Shell autenticado e a identidade global do produto.
- Preços, permissões, dados, integrações e publicação.
- Prometer atribuição completa ou atualização instantânea de anúncios.

## Tokens da superfície
CSS existente (React/Vite, CSS vanilla escopado a .lp). Inter permanece por pedido anterior.
Primitivos: grafite #171b19; superfície escura #242a26; papel #f1f2ed; branco #fff; borda clara #d9ddd4; texto #1c241f; secundário #61695f; lima #d2f525.
Semânticos: canvas=papel, text=texto, muted=secundário, accent=lima, inverse=branco, dark=grafite.
Escala de espaço 4/8/12/16/24/32/48/64/96/128; botões 999px, cards12/20px; display Inter600 com -0.055em, body16/18px; transições150/250ms; z-sticky30,z-loading50.

## Revisão
| Antes | Depois | Por quê |
| --- | --- | --- |
| Fundos claros quase iguais em todas as seções | Abertura grafite, painel claro, faixa lima, demonstração escura | Criar hierarquia e mudanças de ritmo |
| Promessa diluída em módulos | Operação do clique à venda como protagonista | Explicar o benefício antes do catálogo |
| Botões retangulares de 10px | Cápsulas completas e controle circular | Atender à direção explícita do usuário |
| Apenas ilustrações de telas | Recortes reais + simulação claramente identificada | Demonstrar o produto existente |
