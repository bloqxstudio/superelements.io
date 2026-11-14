# Google Agenda da conta (2026-11-14)

O usuário: "marco reunião com o cliente e queria visualizar essas calls agendadas pela plataforma… integrar de criar
por aqui e enviar direto pro cliente", e na agenda dos formulários "opcional… podendo marcar ou funcionar normal como era antes".
Ele usa o Gmail pessoal.

- **Conexão**: uma agenda Google por conta, conectada pelo gestor em `/crm/agenda` (login do Google, volta em
  `/agenda/retorno`, `GoogleAgendaCallback.tsx`). Escopos `openid email calendar.events`, `access_type=offline` +
  `prompt=consent` (sempre vem o refresh token). Tabelas `crm_google_calendars` (e-mail, último erro; a equipe lê) e
  `crm_google_tokens` (sem acesso do navegador). Migração `20261114120000_crm_google_agenda.sql`, **aplicada** em
  2026-11-14 (só ela: a `20261114130000_crm_ad_result_types.sql` é de outra sessão e ficou pendente).
- **Função `google-calendar`** (verify_jwt, v1 publicada 2026-11-14): `status`, `auth_url`, `connect`, `disconnect`
  (gestor), `events` (até 62 dias; liga convidados a clientes do CRM pelo e-mail do cliente ou do contato), `create`
  (Meet opcional, `sendUpdates=all`: o próprio Google manda o convite saindo do Gmail conectado; com cliente/card,
  entra na linha do tempo e no próximo passo), `cancel` (avisa os convidados; reserva de formulário volta a ficar livre),
  `booking_sync`. Código comum em `_shared/googleCalendar.ts`. Horário de Brasília com −03:00 fixo, como em `forms.ts`.
- **Tela** `src/pages/crm/Agenda.tsx` (menu Vendas › Agenda, módulo `crm`): próximos 7/30 dias ou últimos 7, Meet,
  "Nova reunião" (busca cliente, convidados, dia, hora, duração, Meet, descrição). `?nova=1&cliente=<id>&oportunidade=<id>`
  abre o formulário já preenchido (ainda não há botão no card que use isso).
- **Formulários**: `settings.booking.google` (opcional; `cleanBooking` só guarda quando `true`). Ligado: `form-submit`
  (v17, VERSION 4) tira da lista os horários que encostam num compromisso ocupado do Google (`bookingDays(..., blocked)`;
  dia inteiro ocupado bloqueia o dia) e cria o evento com Meet e convite ao e-mail do lead (`crm_form_bookings.google_event_id`,
  `meet_url`; Meet vai na atividade e no aviso do WhatsApp). Sem conexão, Google fora ou erro: segue como antes.
  Cancelar/reativar na lista de reuniões chama `booking_sync`. Vale no formulário no ar depois de publicar de novo.
- **Falta (do usuário)**: projeto no Google Cloud com a Calendar API, tela de consentimento "Externo" **publicada em
  produção** (em "Teste" o Google derruba o acesso em 7 dias; sem verificação aparece o aviso de app não verificado, até
  100 usuários), cliente OAuth "Aplicativo da Web" com os redirecionamentos `https://app.avencestudio.com/agenda/retorno` e
  `http://localhost:8080/agenda/retorno`, e os segredos `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no Supabase
  (`GOOGLE_REDIRECT_URIS` opcional). Privacidade: quem é da equipe vê os eventos da agenda conectada.
- Testes: `scripts/tests/form-agenda.test.mjs` (ocupados do Google, `google` só quando ligado). **Não testado**: login
  real no Google, criação de evento e convite (dependem dos segredos), a tela no navegador e o app publicado.
- **Quadro** (2026-11-14, o usuário: "uma visualização de quadro na agenda… ver todos os dias da semana / mês, assim como o
  Google Agenda"): `src/features/crm/AgendaBoard.tsx`. Semana (grade de horas, domingo a sábado como o Google pt-BR, abre
  nas 7h, linha de agora, eventos que se cruzam dividem a largura, faixa "dia todo"; no celular rola para o lado com
  cabeçalho e horas presos e abre no dia de hoje), Mês (42 dias, até 3 por dia e "+N mais", clicar no número abre a
  semana) e Lista (a de antes). Clicar num horário vazio abre "Nova reunião" já com dia e hora; clicar num evento abre os
  detalhes (convidados com resposta, cliente do CRM, Meet, Google, cancelar). Roxo: reunião com cliente do CRM ou de
  formulário; azul: o resto. A visão escolhida fica no navegador (`sinfy-agenda-view`). Harness local com eventos
  inventados em `.space/_harness/agenda/` (fora do Git; `?v=mes`, `&w=390`).
