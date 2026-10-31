import type { SectionElement } from '../landingPage'
import { createWidget } from '../editor/tree'
import { FORMS_ENDPOINT, formsScriptUrl, type CrmForm } from '@/features/crm/forms'

/**
 * O formulário nativo da plataforma como elemento da página: um widget HTML do Elementor com o
 * código de embed (a `div` que o `forms.js` preenche, mais o script). Publica no WordPress como
 * qualquer widget, sem plugin. No canvas o script não roda, então a `div` leva um marcador com o
 * nome; no site o `forms.js` desenha o formulário dentro dela (Shadow DOM) e o marcador some.
 */

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const formHtml = (form: Pick<CrmForm, 'id' | 'name' | 'kind'>) =>
  `<div data-avence-form="${form.id}" data-endpoint="${FORMS_ENDPOINT}">` +
  `<div style="display:flex;min-height:140px;align-items:center;justify-content:center;border:1.5px dashed #c4c4cc;border-radius:12px;background:#f4f4f5;color:#52525b;font:500 14px/1.4 system-ui,sans-serif;text-align:center;padding:16px">` +
  `${form.kind === 'quiz' ? 'Quiz' : 'Formulário'} · ${esc(form.name)}</div></div>\n` +
  `<script defer src="${formsScriptUrl()}"></script>`

export const formElement = (form: Pick<CrmForm, 'id' | 'name' | 'kind'>): SectionElement => createWidget('html', { html: formHtml(form), _title: form.name })
