import type { SectionElement } from '../landingPage'
import { createWidget } from '../editor/tree'
import { FORMS_ENDPOINT, configUrl, formsScriptUrl, type CrmForm } from '@/features/crm/forms'

/**
 * O formulário nativo da plataforma como elemento da página: um widget HTML do Elementor com o
 * código de embed (a `div` que o `forms.js` preenche, mais o script). Publica no WordPress como
 * qualquer widget, sem plugin. No canvas o script não roda, então a `div` leva um marcador com o
 * nome; no site o `forms.js` desenha o formulário dentro dela (Shadow DOM) e o marcador some.
 */

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** JSON seguro dentro de um `<script>`: `<` e separadores de linha não fecham a tag nem quebram o texto. */
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

type FormLike = Pick<CrmForm, 'id' | 'teamId' | 'name' | 'kind' | 'definition' | 'theme' | 'settings'>

/**
 * O marcador só aparece depois de 1,5 s: no site o formulário entra antes e ninguém vê a "tela de
 * carregamento"; no canvas (onde o script não roda) ele surge e fica. A cópia da configuração vai
 * junto para o formulário abrir direto, sem esperar a rede; o script confere com o servidor por trás.
 */
export const formHtml = (form: FormLike) =>
  `<link rel="preconnect" href="${FORMS_ENDPOINT.replace(/\/functions\/v1\/.*$/, '')}" crossorigin>\n` +
  `<div data-avence-form="${form.id}" data-config="${configUrl(form.teamId, form.id)}" data-endpoint="${FORMS_ENDPOINT}">` +
  `<script type="application/json">${safeJson({ id: form.id, name: form.name, definition: form.definition, theme: form.theme, settings: form.settings })}</script>` +
  `<style>@keyframes avph{to{opacity:1}}</style>` +
  `<div style="display:flex;min-height:140px;align-items:center;justify-content:center;border:1.5px dashed #c4c4cc;border-radius:12px;background:#f4f4f5;color:#52525b;font:500 14px/1.4 system-ui,sans-serif;text-align:center;padding:16px;opacity:0;animation:avph 0s 1.5s forwards">` +
  `${form.kind === 'quiz' ? 'Quiz' : 'Formulário'} · ${esc(form.name)}</div></div>\n` +
  `<script defer src="${formsScriptUrl()}"></script>`

export const formElement = (form: FormLike): SectionElement => createWidget('html', { html: formHtml(form), _title: form.name })
