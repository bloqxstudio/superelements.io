#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2]
if (!input) {
  console.error('Usage: node validate-elementor-json.mjs <elementor-json>')
  process.exit(2)
}

const absolute = path.resolve(input)
let parsed
try {
  parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'))
} catch (error) {
  console.error(`Cannot read Elementor JSON: ${error.message}`)
  process.exit(2)
}

const roots = Array.isArray(parsed) ? parsed : parsed.content ?? parsed.elements
if (!Array.isArray(roots)) {
  console.error('Expected an array, or an object with content/elements.')
  process.exit(2)
}

const supported = new Set([
  'heading', 'text-editor', 'image', 'button', 'video', 'icon-list', 'image-box',
  'icon', 'social-icons', 'divider', 'spacer', 'price-list', 'testimonial-carousel',
  'form', 'menu-anchor', 'counter', 'progress', 'star-rating', 'google_maps',
])
const counts = { roots: roots.length, containers: 0, widgets: 0, html: 0 }
const widgetTypes = {}
const ids = new Set()
const duplicateIds = []
const unsupported = new Set()
const localUrls = new Set()
const htmlMonoliths = []
const responsive = { mobile: 0, tablet: 0 }

const scanValue = (value) => {
  if (typeof value === 'string') {
    if (/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])|file:|blob:/i.test(value)) localUrls.add(value)
    return
  }
  if (Array.isArray(value)) return value.forEach(scanValue)
  if (value && typeof value === 'object') Object.values(value).forEach(scanValue)
}

const walk = (items, section = 'root') => {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (item.id) {
      if (ids.has(item.id)) duplicateIds.push(item.id)
      ids.add(item.id)
    }
    const settings = item.settings && !Array.isArray(item.settings) ? item.settings : {}
    for (const key of Object.keys(settings)) {
      if (key.endsWith('_mobile')) responsive.mobile += 1
      if (key.endsWith('_tablet')) responsive.tablet += 1
    }
    scanValue(settings)
    if (item.elType === 'container') {
      counts.containers += 1
      const children = Array.isArray(item.elements) ? item.elements : []
      if (children.length === 1 && children[0]?.widgetType === 'html') htmlMonoliths.push(section)
      walk(children, item.id || section)
    } else if (item.elType === 'widget') {
      counts.widgets += 1
      const type = item.widgetType || 'unknown'
      widgetTypes[type] = (widgetTypes[type] || 0) + 1
      if (type === 'html') counts.html += 1
      if (!supported.has(type)) unsupported.add(type)
    }
  }
}
walk(roots)

const failures = []
if (!counts.containers) failures.push('no native containers')
if (htmlMonoliths.length) failures.push(`${htmlMonoliths.length} monolithic HTML section(s)`)
if (duplicateIds.length) failures.push(`${duplicateIds.length} duplicate id(s)`)
if (unsupported.size) failures.push(`unsupported widgets: ${[...unsupported].join(', ')}`)
if (!responsive.mobile) failures.push('no mobile settings')

const report = {
  file: absolute,
  pass: failures.length === 0,
  counts,
  widgetTypes,
  responsiveSettings: responsive,
  duplicateIds: [...new Set(duplicateIds)],
  unsupported: [...unsupported],
  htmlMonoliths,
  portabilityWarnings: [...localUrls],
  failures,
}
console.log(JSON.stringify(report, null, 2))
process.exit(report.pass ? 0 : 1)

