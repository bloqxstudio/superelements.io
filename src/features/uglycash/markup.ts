const A = '/uglycash/assets'

export interface UglyCashSection {
  id: string
  title: string
  html: string
}

const arrow = '<span class="ug-arrow" aria-hidden="true">↗</span>'

export const uglyCashSections: UglyCashSection[] = [
  {
    id: 'hero',
    title: 'UGLYCASH · Hero',
    html: `<section class="ug-hero" id="top">
      <header class="ug-nav" aria-label="Main navigation">
        <a class="ug-wordmark" href="#top">UGLYCASH</a>
        <div class="ug-social"><a href="#footer" aria-label="Reddit">●</a><a href="#footer" aria-label="Instagram">◎</a></div>
        <a class="ug-app-pill" href="#download"><img src="${A}/mark.svg" alt=""><span>Get the APP</span></a>
      </header>
      <div class="ug-shell ug-hero__inner">
        <h1>YOUR BANK<br>WON'T DO THIS</h1>
        <div class="ug-phone-stage" aria-label="UGLYCASH app preview">
          <div class="ug-phone-glow"></div>
          <video autoplay muted loop playsinline poster="${A}/0cfceaf6b5553f2b.avif"><source src="${A}/hero-phone.mp4" type="video/mp4"></video>
        </div>
        <p class="ug-hero__caption">The Opportunity App.<br>To manage, move and grow money.</p>
      </div>
    </section>`,
  },
  {
    id: 'opportunity',
    title: 'UGLYCASH · How opportunity works',
    html: `<section class="ug-section ug-opportunity" id="opportunity"><div class="ug-shell">
      <div class="ug-section-head"><h2>How opportunity<br>works on UGLYCASH</h2><p>One app. More ways to earn, access and grow.</p></div>
      <div class="ug-three-grid">
        <article class="ug-feature ug-feature--pink"><div class="ug-feature__copy"><span>01</span><h3>Earn</h3><p>Get paid anywhere.<br>Earn on what you hold.</p></div><img src="${A}/0cfceaf6b5553f2b.avif" alt="UGLYCASH balance screen"></article>
        <article class="ug-feature ug-feature--green"><div class="ug-feature__copy"><span>02</span><h3>Access</h3><p>Spend locally.<br>Grow globally.</p></div><img src="${A}/c38fac9e45aa9225.avif" alt="UGLYCASH card"></article>
        <article class="ug-feature ug-feature--blue"><div class="ug-feature__copy"><span>03</span><h3>Trade like the best</h3><p>Learn from how others invest.<br>Track outcomes.</p></div><img src="${A}/a15652292bb6e330.avif" alt="UGLYCASH leaderboard"></article>
      </div>
    </div></section>`,
  },
  {
    id: 'enables',
    title: 'UGLYCASH · What the app enables',
    html: `<section class="ug-section ug-enables"><div class="ug-shell">
      <div class="ug-section-head ug-section-head--row"><h2>What UGLYCASH<br>enables</h2><span class="ug-sticker">BUILT FOR<br>REAL LIFE</span></div>
      <div class="ug-enable-grid">
        <article class="ug-enable-card ug-enable-card--wide"><div><span class="ug-index">01</span><h3>Multiple ways<br>to get paid</h3><p>From US, EU and MEX bank accounts, crypto, and transfers — all in one place.</p></div><img src="${A}/4e9554b910b8dc68.avif" alt="Ways to add funds"></article>
        <article class="ug-enable-card ug-enable-card--orange"><div><span class="ug-index">02</span><h3>Everyday spending,<br>made simple</h3><p>Cards with up to 6% cashback, and easy bank withdrawals.</p></div><img src="${A}/c38fac9e45aa9225.avif" alt="UGLYCASH Visa card"></article>
        <article class="ug-enable-card ug-enable-card--sky"><div><span class="ug-index">03</span><h3>Follow traders,<br>see positions in real time</h3><p>Trade any asset on-chain. Learn from transparent positions and outcomes.</p></div><img src="${A}/294cb270dece14ed.avif" alt="Trader profile and positions"></article>
        <article class="ug-enable-card ug-enable-card--lime"><div><span class="ug-index">04</span><h3>Money that<br>moves freely</h3><p>Bridge between crypto and banks without rebuilding your financial life.</p></div><img src="${A}/3be4681a1341356c.avif" alt="International transfers device"></article>
      </div>
    </div></section>`,
  },
  {
    id: 'clarity',
    title: 'UGLYCASH · Regulatory clarity',
    html: `<section class="ug-section ug-clarity"><div class="ug-shell ug-clarity__panel">
      <div class="ug-clarity__intro"><h2>Regulatory<br>clarity</h2><p>Money products should be understandable. Here is how the structure works.</p></div>
      <div class="ug-clarity-grid">
        <article><span>LICENCES</span><h3>A regulated path,<br>built across markets.</h3><img src="${A}/94604ffe20677a6d.avif" alt="Made in USA emblem"></article>
        <article><span>WHERE IS MY MONEY?</span><h3>Your funds remain backed and clearly accounted for.</h3><img src="${A}/452148401df0e7d6.avif" alt="US currency"></article>
        <article><span>IS IT SAFE?</span><h3>Security is designed into every movement.</h3><img src="${A}/14463d7bf2cf82f9.avif" alt="Risk sign"></article>
        <article><span>SELF CUSTODY</span><h3>Your assets. Your keys.<br>Your control.</h3><img src="${A}/35736569864fea10.avif" alt="You have the keys"></article>
      </div>
    </div></section>`,
  },
  {
    id: 'proof',
    title: 'UGLYCASH · Usage proof',
    html: `<section class="ug-proof"><div class="ug-shell"><p>USED MONTHLY BY OVER <em>30,000 PEOPLE</em> TO EARN, SPEND, AND GROW MONEY GLOBALLY.</p></div></section>`,
  },
  {
    id: 'field',
    title: 'UGLYCASH · From the field',
    html: `<section class="ug-section ug-field"><div class="ug-shell">
      <div class="ug-section-head ug-section-head--row"><h2>From the field</h2><a class="ug-text-link" href="#discover">More videos ${arrow}</a></div>
      <div class="ug-field-grid">
        <article class="ug-field-card ug-field-card--main"><img src="${A}/10b5d22cc461afbf.avif" alt="The Opportunity App"><button aria-label="Play video">▶</button></article>
        <article class="ug-field-card"><img src="${A}/304dcefcc4551827.avif" alt="Blue abstract visual"><div><small>UGLYCASH STORIES</small><h3>Money should open doors.</h3></div></article>
        <article class="ug-field-card"><img src="${A}/4e4f140546d0ac4f.avif" alt="Color field"><div><small>FROM THE COMMUNITY</small><h3>Opportunity looks different everywhere.</h3></div></article>
      </div>
    </div></section>`,
  },
  {
    id: 'discover',
    title: 'UGLYCASH · Discover more',
    html: `<section class="ug-section ug-discover" id="discover"><div class="ug-shell">
      <div class="ug-section-head"><h2>Discover more</h2></div>
      <div class="ug-discover-grid">
        <a class="ug-discover-card ug-discover-card--paper" href="#footer"><span>Ridiculously Exclusive ${arrow}</span><img src="${A}/65da8c7a8d0dcc51.avif" alt="Ridiculously Exclusive membership"></a>
        <a class="ug-discover-card ug-discover-card--black" href="#footer"><span>UGLYCASH Business ${arrow}</span><img src="${A}/0624bb62694970c8.avif" alt="UGLYCASH Business dashboard"></a>
        <a class="ug-discover-card ug-discover-card--pink" href="#footer"><span>Store ${arrow}</span><img src="${A}/d5705da50cefe7c7.avif" alt="UGLYCASH merchandise"></a>
      </div>
    </div></section>`,
  },
  {
    id: 'worldwide',
    title: 'UGLYCASH · Worldwide and footer',
    html: `<section class="ug-section ug-world"><div class="ug-shell ug-world__panel">
      <div class="ug-world__copy"><p>UGLYCASH was created in San Francisco and is distributed worldwide.</p><div class="ug-regions"><span>North America</span><span>Central America</span><span>South America</span><span>Africa</span><span>Asia</span></div></div>
      <img src="${A}/96f23a1e12555801.avif" alt="UGLYCASH suitcase travelling worldwide">
      <p class="ug-world__tagline">The Opportunity App.<br>To manage, move and grow money.</p>
    </div></section>
    <footer class="ug-footer" id="footer"><div class="ug-shell ug-footer__panel">
      <div class="ug-footer__brand">UGLYCASH</div>
      <div class="ug-footer__meta"><strong>A <span>Reserve</span> Project</strong><div class="ug-store-badges" id="download"><span>Download on the<br><b>App Store</b></span><span>GET IT ON<br><b>Google Play</b></span></div></div>
      <div class="ug-footer__bottom"><div><p>Rewards are funded with UGLYCASH’s own resources. Annual Percentage Yield (APY) is accurate as of 05/01/2025. APY is determined by UGLYCASH and may change at any time. Users funds are not invested and are 100% backed all the time.</p><p>UGLYCASH is a financial services platform, not a bank.</p><p>**Services and features described may vary for users in different countries and/or regions.</p></div><nav><a href="mailto:support@ugly.cash">support@ugly.cash</a><a href="#footer">UGLYCASH Business</a><a href="#footer">Help center</a><a href="#footer">Legal</a></nav></div>
    </div><div class="ug-copyright">Best Friend Finance, Inc. &nbsp; Made with love in California &nbsp; ©2026</div></footer>`,
  },
]
