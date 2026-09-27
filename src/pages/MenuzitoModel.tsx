import { useEffect } from 'react'
import { menuzitoSections } from '@/features/menuzito/markup'

const stylesheetId = 'menuzito-model-styles'

const MenuzitoModel = () => {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Menuzito | Plataforma completa para restaurantes venderem mais'
    let link = document.getElementById(stylesheetId) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = stylesheetId
      link.rel = 'stylesheet'
      link.href = '/menuzito/model.css'
      document.head.appendChild(link)
    }
    return () => { document.title = previousTitle }
  }, [])

  return (
    <div className="mz-page">
      {menuzitoSections.map(section => (
        <div key={section.id} dangerouslySetInnerHTML={{ __html: section.html }} />
      ))}
      <a className="mz-whatsapp" href="#faq" aria-label="Tire as suas dúvidas"><span>◉</span> Tire as suas dúvidas</a>
    </div>
  )
}

export default MenuzitoModel
