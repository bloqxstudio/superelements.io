import { useEffect } from 'react'

const tokens = [['Canvas','#F2F2F2'],['Ink','#000000'],['Paper','#FFFFFF'],['Hot pink','#FF00E5'],['Acid lime','#C9FF00'],['Signal orange','#FF4B17'],['Sky','#78BFFF'],['Deep blue','#182D86']]

const UglyCashStyleGuide = () => {
  useEffect(() => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/uglycash/model.css'; document.head.appendChild(link)
    return () => link.remove()
  }, [])
  return <main className="ug-guide">
    <section className="ug-guide__hero"><span>UGLYCASH · DESIGN SYSTEM</span><h1>OPPORTUNITY<br/>WITHOUT THE<br/>BANK VOICE.</h1><p>Editorial brutalism, financial clarity and product UI in one system.</p></section>
    <section><h2>Color</h2><div className="ug-guide__colors">{tokens.map(([name,value]) => <article key={name}><i style={{background:value}}/><b>{name}</b><code>{value}</code></article>)}</div></section>
    <section><h2>Type</h2><div className="ug-guide__type"><div className="ug-guide__display">YOUR BANK WON'T DO THIS</div><h3>Helvetica Now Display Condensed Bold</h3><p>Inter carries every explanation, navigation label and UI note with direct, neutral rhythm.</p></div></section>
    <section><h2>Objects & surfaces</h2><div className="ug-guide__objects"><article className="pink">HOT PINK<br/>MEANS ACTION</article><article className="paper">24–32px radius<br/><small>Paper-like functional cards</small></article><article className="black">UGLYCASH<br/><small>Black is a structure, not decoration.</small></article></div></section>
  </main>
}

export default UglyCashStyleGuide
