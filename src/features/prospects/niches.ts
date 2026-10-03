/**
 * Nichos prontos da prospecção. `query` é o que se pesquisa no Google Maps;
 * `osm` são as marcações do OpenStreetMap (chave=valor) que trazem o mesmo
 * tipo de negócio no mapa aberto. Um nicho escrito à mão vai como texto ao
 * Google e, no mapa aberto, procura o texto no nome dos estabelecimentos.
 */
export interface Niche {
  id: string
  label: string
  query: string
  osm: string[]
}

export const NICHES: Niche[] = [
  { id: 'advogados', label: 'Advogados', query: 'escritório de advocacia', osm: ['office=lawyer'] },
  { id: 'medicos', label: 'Médicos', query: 'consultório médico', osm: ['amenity=doctors', 'healthcare=doctor', 'amenity=clinic', 'healthcare=clinic'] },
  { id: 'psicologos', label: 'Psicólogos', query: 'psicólogo', osm: ['healthcare=psychotherapist', 'healthcare=counselling'] },
  { id: 'dentistas', label: 'Dentistas', query: 'dentista', osm: ['amenity=dentist', 'healthcare=dentist'] },
  { id: 'engenheiros', label: 'Engenheiros', query: 'empresa de engenharia', osm: ['office=engineer'] },
  { id: 'arquitetos', label: 'Arquitetos', query: 'escritório de arquitetura', osm: ['office=architect'] },
  { id: 'contadores', label: 'Contadores', query: 'escritório de contabilidade', osm: ['office=accountant', 'office=tax_advisor'] },
  { id: 'imobiliarias', label: 'Imobiliárias', query: 'imobiliária', osm: ['office=estate_agent'] },
  { id: 'nutricionistas', label: 'Nutricionistas', query: 'nutricionista', osm: ['healthcare=nutrition_counselling'] },
  { id: 'fisioterapeutas', label: 'Fisioterapeutas', query: 'clínica de fisioterapia', osm: ['healthcare=physiotherapist'] },
  { id: 'veterinarios', label: 'Veterinários', query: 'clínica veterinária', osm: ['amenity=veterinary'] },
  { id: 'estetica', label: 'Estética', query: 'clínica de estética', osm: ['shop=beauty'] },
  { id: 'academias', label: 'Academias', query: 'academia', osm: ['leisure=fitness_centre'] },
  { id: 'escolas', label: 'Escolas de idiomas', query: 'escola de idiomas', osm: ['amenity=language_school'] },
]

/** O nicho pronto com esse id, ou um nicho escrito à mão. */
export const nicheFor = (idOrText: string): Niche => {
  const known = NICHES.find((n) => n.id === idOrText)
  if (known) return known
  const text = idOrText.trim()
  return { id: text, label: text.charAt(0).toUpperCase() + text.slice(1), query: text, osm: [] }
}
