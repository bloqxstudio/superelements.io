# Formulários: capa, agenda e pixel da Meta

Estado em 2026-11-04. Migração aplicada no banco (SQL Editor, registrada no histórico). Função `form-submit`, commit e app: ainda não.

## O pedido

- Pixel da Meta que roda só dentro do formulário, no app (`/f/<id>`) e no Elementor, com eventos de formulário e de agendamento (modelo da tela do Chronos: ID, evento no envio, padrão ou personalizado, token da API de Conversões, código de teste).
- Tela de início (capa) com botão para começar, no visual Avence: fundo branco, ícones de traço no lugar dos emojis, rodapé em itálico com →, alinhamento à esquerda e quebras de linha cuidadas. A conferência segue o checklist do curso.
- Agenda como destino de quem passa no filtro (primeiro filtro: faturamento), com os próximos 3 dias e os horários configurados por formulário, aviso no grupo do WhatsApp e tela de agradecimento.
- Depois: lançar os ganhos do funil de volta para a Meta.

## O que ficou pronto

| Parte | Onde |
|---|---|
| Contrato: `welcome`, `booking`, `pixel`, fontes Inter Tight e Lato, ícones, cálculo dos horários (fuso −3 h) e filtro | `supabase/functions/_shared/forms.ts` |
| Desenho: capa → perguntas → fim, ou → agenda → agradecimento; pixel com `trackSingle`; eventos no `dataLayer` | `public/forms.js` (versão 9 em `FORMS_SCRIPT_VERSION`) |
| Servidor: devolve os horários e um token a quem passa no filtro; `action: 'book'` reserva; atualiza o card, grava a nota e manda o aviso no WhatsApp | `supabase/functions/form-submit/index.ts` |
| API de Conversões (mesmos `event_id` do navegador) | `supabase/functions/form-submit/capi.ts` |
| Tabelas `crm_form_bookings` e `crm_form_pixel_tokens`; bucket `crm-forms` aceita imagens | `supabase/migrations/20261103180000_crm_form_bookings.sql` |
| Abas Início, Agenda e Pixel da Meta; lista de reuniões | `src/features/crm/FormFlowEditors.tsx`, `src/pages/crm/FormEditor.tsx` |
| Prévia com troca de tela e celular de 390 px | `src/features/crm/FormBuilder.tsx` |
| Modelo "Captação com agendamento"; token, agendamentos e logo | `src/features/crm/forms.ts`, `src/pages/crm/Forms.tsx` |
| `/f/<id>`: o pixel agora vem do formulário (`?px=` continua como legado) | `src/pages/PublicForm.tsx`, `src/features/crm/FormPanels.tsx` |
| Testes (6, todos passando) | `scripts/tests/form-agenda.test.mjs` |
| Registro do projeto | `AGENTS.md`, seção "Formulários: capa, agenda e pixel da Meta" |

### Eventos

| Momento | Pixel (prefixo padrão `Avence`) | dataLayer | Também pelo servidor |
|---|---|---|---|
| Formulário aparece | `AvenceView` | `form_view` | não |
| Começar ou primeira resposta | `AvenceFirstInteraction` | `form_start` | não |
| Avança uma etapa | não | `form_step` | não |
| Envia | `AvenceSubmit` (ou o evento padrão escolhido) | `form_submit` | sim |
| Envia e passou no filtro | `Lead` | `lead_qualificado` | sim |
| Vê a agenda | `AvenceViewScheduled` | `schedule_view` | não |
| Marca a reunião | `AvenceScheduled` + `Schedule` | `schedule_confirmed` | sim |

Todo evento leva `form_id` e `form_name`. Para a conversão personalizada por formulário, use a regra "URL contém `/f/<id>`" ou o parâmetro `form_id`. O `visitas.js` do Site recebe os eventos do `dataLayer` sozinho.

### Regras importantes

- Num formulário comum com filtro por resposta, o filtro decide a qualificação: só quem passa dispara o `Lead`.
- O token da API de Conversões nunca vai para a configuração pública do formulário (CDN). Ele fica em `crm_form_pixel_tokens`, que só o gestor acessa.
- Um horário de um formulário vale para uma pessoa só, e cada resposta reserva uma vez (índices únicos; cancelar libera o horário).
- Com a agenda ligada, o redirecionamento e o botão do WhatsApp só acontecem depois da reserva.

## O que foi verificado

- O fluxo inteiro na prévia, com cliques no Chrome (página de teste do `forms.js`): capa → nome → faturamento alto → agenda → dia e horário → "Reunião agendada". A capa conferiu em 390 px e em 320 px.
- Os trechos em negrito da headline não quebram no meio. Quando a pergunta tem título, o rótulo fica só para leitor de tela.
- `npm test`: 101 de 103. Os 6 novos passam; a falha é um teste da migração do módulo copy, que não foi mexido.
- A verificação de tipos não acusa erro nos arquivos de formulário; os erros que aparecem em outros arquivos já existiam.

## Ainda não testado

- Reserva real, aviso no grupo do WhatsApp e API de Conversões: dependem da migração e da função publicadas.
- O editor dentro do app logado: só a prévia isolada foi vista.

## Para publicar (pedir o ok antes)

1. ~~Aplicar a migração `20261103180000_crm_form_bookings.sql`~~ (feito em 2026-11-04 pelo SQL Editor; conferido: tabelas, bucket e histórico).
2. Publicar a função `form-submit` (`verify_jwt = false`, já está no `config.toml`).
3. Commit e push na `main` (a Hostinger publica o app e o novo `forms.js`).
4. Testar com um formulário real: Eventos de teste da Meta com o código de teste, uma reserva real e o aviso no grupo.

Atenção: os atalhos `npm run db:migrate` e `functions:deploy` leem o token do Keychain do Mac e não rodam neste Windows.

O git também tem mudanças de outra sessão que não fazem parte deste trabalho: `scripts/space/space.mjs`, `src/features/copy/storage.ts` e `src/features/space/bridge/client.ts`. Não misturar no commit.

## Próximos passos

- **Ganho de volta para a Meta**: quando o card do lead for para Fechado, mandar `Purchase` com o valor pela API de Conversões. A origem da oportunidade já guarda `meta` (pixel, `_fbp`, `_fbc`, página) a partir deste trabalho.
- Datas bloqueadas (feriados, folgas) na agenda.
- Lembrete da reunião no WhatsApp do lead (hoje só a equipe é avisada).
- Revisar o editor logado: alinhamentos dos painéis e a prévia no celular.

## Como ver no local

`npx vite --port 5199` → http://localhost:5199 → CRM › Formulários → criar pelo modelo "Captação com agendamento". A prévia ao lado do editor tem as telas Início, Perguntas, Agenda, Agendado e Final.

## Publicar no app e endereço (2026-11-04)

Botão **Publicar** no topo do editor: escolhe o endereço `app.avencestudio.com/f/<slug>` e devolve o link pronto. Publicado: "No ar", link (clique copia), Ver formulário e o menu ⋯ (endereço e link de campanha, despublicar). Migração `20261104190000_crm_form_slug.sql` (coluna `slug` única + função `crm_form_by_slug`).
