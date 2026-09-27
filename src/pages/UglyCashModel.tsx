import { useEffect } from 'react'
import { uglyCashSections } from '@/features/uglycash/markup'

const UglyCashModel = () => {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'UGLYCASH — The Opportunity App'
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/uglycash/model.css'
    link.dataset.uglycash = 'true'
    document.head.appendChild(link)
    return () => { document.title = previousTitle; link.remove() }
  }, [])
  return <main className="ug-page">{uglyCashSections.map(section => <div key={section.id} dangerouslySetInnerHTML={{ __html: section.html }} />)}</main>
}

export default UglyCashModel
