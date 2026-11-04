import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOOKING_DEFAULT,
  bookingDays,
  bookingEligible,
  cleanDefinition,
  cleanSettings,
  localDay,
  localTime,
  pixelActive,
  slotInstant,
  timesOfDay,
} from '../../supabase/functions/_shared/forms.ts'
import { submitEvents, scheduleEvents, fbcFrom } from '../../supabase/functions/form-submit/capi.ts'

const def = {
  kind: 'form',
  results: [],
  steps: [{ id: 's1', fields: [{ id: 'fat', type: 'choice', label: 'Faturamento', required: true, options: [{ id: 'baixo', label: 'Até 30 mil' }, { id: 'alto', label: 'Acima de 30 mil' }] }] }],
}

test('horários de Brasília viram UTC (−3 h) e voltam', () => {
  const at = slotInstant('2026-11-04', '14:00')
  assert.equal(at.toISOString(), '2026-11-04T17:00:00.000Z')
  assert.deepEqual(localDay(at), { date: '2026-11-04', weekday: 3 })
  assert.equal(localTime(at), '14:00')
  // 22h em Brasília já é o dia seguinte em UTC, mas continua o mesmo dia local
  assert.equal(localDay(slotInstant('2026-11-04', '22:30')).date, '2026-11-04')
})

test('intervalos cortados na duração da reunião', () => {
  const b = { ...BOOKING_DEFAULT, durationMin: 60, week: { ...BOOKING_DEFAULT.week, 3: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '15:30' }] } }
  assert.deepEqual(timesOfDay(b, 3), ['09:00', '10:00', '11:00', '14:00'])
})

test('próximos dias pulam dia sem atendimento, antecedência e reservados', () => {
  // Sexta, 06/11/2026, 10:00 em Brasília
  const now = slotInstant('2026-11-06', '10:00')
  const b = { ...BOOKING_DEFAULT, mode: 'range', days: 3, noticeHours: 2 }
  const taken = [slotInstant('2026-11-09', '09:00').toISOString()]
  const days = bookingDays(b, now, taken)
  assert.deepEqual(days.map((d) => d.date), ['2026-11-06', '2026-11-09', '2026-11-10'])
  // Sexta: só a partir de 12:00 (2 h de antecedência), e o intervalo da manhã acaba às 12
  assert.deepEqual(days[0].times, ['14:00', '15:00', '16:00', '17:00'])
  // Segunda: o das 9h foi reservado
  assert.equal(days[1].times[0], '10:00')
})

test('filtro por resposta abre a agenda só para quem marcou as opções', () => {
  const b = { ...BOOKING_DEFAULT, gate: { mode: 'answer', field: 'fat', values: ['alto'] } }
  assert.equal(bookingEligible(def, b, { fat: 'alto' }, null), true)
  assert.equal(bookingEligible(def, b, { fat: 'baixo' }, null), false)
  assert.equal(bookingEligible(def, { ...b, enabled: false }, { fat: 'alto' }, null), false)
  assert.equal(bookingEligible({ ...def, kind: 'quiz' }, { ...b, gate: { mode: 'qualified' } }, {}, false), false)
  assert.equal(bookingEligible({ ...def, kind: 'quiz' }, { ...b, gate: { mode: 'qualified' } }, {}, true), true)
})

test('limpeza da capa, da agenda e do pixel', () => {
  const d = cleanDefinition({ ...def, welcome: { enabled: true, icon: 'rocket', title: 'Oi **mundo**', bullets: [{ id: 'b', icon: 'nada', text: 'x' }], footnote: '→ Só para empresas', buttonLabel: '' } })
  assert.equal(d.welcome.icon, 'rocket')
  assert.equal(d.welcome.bullets[0].icon, undefined)
  assert.equal(d.welcome.footnote, 'Só para empresas')
  assert.equal(d.welcome.buttonLabel, 'Quero começar')
  const s = cleanSettings({ booking: { enabled: true, durationMin: 5, week: { 1: [{ start: '18:00', end: '09:00' }, { start: '09:00', end: '10:00' }] }, gate: { mode: 'answer', field: 'fat', values: ['alto', 3] } }, pixel: { enabled: true, id: '2849-2197-8206-5000', prefix: 'Av ence!' } })
  assert.equal(s.booking.durationMin, 15)
  assert.deepEqual(s.booking.week['1'], [{ start: '09:00', end: '10:00' }])
  assert.deepEqual(s.booking.gate, { mode: 'answer', field: 'fat', values: ['alto', '3'] })
  assert.equal(s.pixel.id, '2849219782065000')
  assert.equal(s.pixel.prefix, 'Avence')
  assert.equal(pixelActive(s.pixel), true)
  assert.equal(pixelActive({ ...s.pixel, id: '123' }), false)
  // O token nunca entra na configuração pública
  assert.equal('accessToken' in cleanSettings({ pixel: { enabled: true, id: '2849219782065000', accessToken: 'EAA' } }).pixel, false)
})

test('eventos do servidor usam os mesmos ids do navegador', () => {
  const pixel = cleanSettings({ pixel: { enabled: true, id: '2849219782065000' } }).pixel
  assert.deepEqual(submitEvents(pixel, 'sub1', true, {}).map((e) => [e.name, e.id]), [['AvenceSubmit', 'sub1:submit'], ['Lead', 'sub1:lead']])
  assert.deepEqual(submitEvents(pixel, 'sub1', false, {}).map((e) => e.name), ['AvenceSubmit'])
  assert.deepEqual(submitEvents({ ...pixel, submitEvent: 'Lead' }, 'sub1', true, {}).map((e) => e.name), ['Lead'])
  assert.deepEqual(scheduleEvents(pixel, 'bk1', {}).map((e) => [e.name, e.id]), [['AvenceScheduled', 'bk1:scheduled'], ['Schedule', 'bk1:schedule']])
  assert.equal(fbcFrom('abc', 1700000000000), 'fb.1.1700000000000.abc')
})

test('por prioridade: 2 por turno, manhã do mais tarde, tarde do mais cedo', async () => {
  const { BOOKING_DEFAULT: B } = await import('../../supabase/functions/_shared/forms.ts')
  // Terça, 03/11/2026, 07:00 em Brasília (antes de qualquer horário)
  const now = slotInstant('2026-11-03', '07:00')
  const [first] = bookingDays({ ...B, noticeHours: 0 }, now)
  assert.equal(first.date, '2026-11-03')
  assert.deepEqual(first.times, ['09:30', '10:30', '13:30', '14:30'])
  // Reservaram 10:30 e 13:30: entram 08:30 e 15:30
  const taken = [slotInstant('2026-11-03', '10:30'), slotInstant('2026-11-03', '13:30')].map((d) => d.toISOString())
  assert.deepEqual(bookingDays({ ...B, noticeHours: 0 }, now, taken)[0].times, ['08:30', '09:30', '14:30', '15:30'])
})

test('dia lotado sai e entra o próximo dia útil (sexta lotada → segunda)', async () => {
  const { BOOKING_DEFAULT: B } = await import('../../supabase/functions/_shared/forms.ts')
  const now = slotInstant('2026-11-04', '07:00') // quarta
  const all = ['08:30', '09:30', '10:30', '13:30', '14:30', '15:30', '16:30', '17:30']
  const fridayFull = all.map((t) => slotInstant('2026-11-06', t).toISOString())
  const days = bookingDays({ ...B, noticeHours: 0, days: 3 }, now, fridayFull)
  assert.deepEqual(days.map((d) => d.date), ['2026-11-04', '2026-11-05', '2026-11-09'])
  // Formulário salvo antes de existir o modo: cai na regra por prioridade
  const old = cleanSettings({ booking: { enabled: true, week: { 1: [{ start: '09:00', end: '18:00' }] } } }).booking
  assert.equal(old.mode, 'priority')
  assert.deepEqual(old.workdays, [1, 2, 3, 4, 5])
})
