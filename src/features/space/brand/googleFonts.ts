/**
 * Famílias mais usadas do Google Fonts. Não é o catálogo inteiro: serve para
 * escolher, entre as substitutas que um guia de marca sugere, a que o
 * Elementor e o preview conseguem carregar, e para avisar quando uma fonte
 * provavelmente não é de lá.
 */
const FAMILIES = `
ABeeZee|Abril Fatface|Afacad|Albert Sans|Alegreya|Alegreya Sans|Alex Brush|Alfa Slab One|Allura|Almarai|Amatic SC|Anton|Antonio|Anybody|Archivo|Archivo Black|Archivo Narrow|Architects Daughter|Arimo|Arvo|Asap|Assistant|Audiowide|
Bagel Fat One|Baloo 2|Bangers|Barlow|Barlow Condensed|Barlow Semi Condensed|Be Vietnam Pro|Bebas Neue|Besley|Big Shoulders Display|Big Shoulders Text|Bitter|Black Ops One|Bodoni Moda|Bricolage Grotesque|Brygada 1918|Bungee|
Cabin|Cairo|Cardo|Castoro|Caveat|Chakra Petch|Changa One|Chewy|Chivo|Chivo Mono|Cinzel|Cinzel Decorative|Comfortaa|Cookie|Cormorant|Cormorant Garamond|Courgette|Cousine|Crimson Pro|Crimson Text|
Dancing Script|Darker Grotesque|DM Mono|DM Sans|DM Serif Display|DM Serif Text|Domine|Dosis|EB Garamond|Encode Sans|Epilogue|Exo 2|
Familjen Grotesk|Faustina|Figtree|Fira Code|Fira Sans|Fjalla One|Fraunces|Fredoka|Funnel Display|Funnel Sans|
Gabarito|Gelasio|Geist|Geist Mono|Geologica|Gloock|Gochi Hand|Golos Text|Great Vibes|Grenze Gotisch|Gruppo|
Handlee|Hanken Grotesk|Hedvig Letters Serif|Heebo|Hind|Hind Siliguri|Homemade Apple|Host Grotesk|
IBM Plex Mono|IBM Plex Sans|IBM Plex Serif|IM Fell English|IM Fell English SC|Imbue|Inclusive Sans|Inconsolata|Indie Flower|Instrument Sans|Instrument Serif|Inter|Inter Tight|Italiana|
JetBrains Mono|Josefin Sans|Josefin Slab|Jost|Kalam|Kanit|Karla|Kaushan Script|Kumbh Sans|
Lato|League Gothic|League Spartan|Lexend|Libre Baskerville|Libre Bodoni|Libre Caslon Display|Libre Caslon Text|Libre Franklin|Literata|Lobster|Lora|Luckiest Guy|
M PLUS Rounded 1c|Manrope|Marcellus|Marck Script|Merienda|Merriweather|Merriweather Sans|Michroma|Monoton|Montserrat|Montserrat Alternates|Mukta|Mulish|
Newsreader|Noticia Text|Noto Sans|Noto Sans JP|Noto Serif|Noto Serif Display|Nunito|Nunito Sans|Old Standard TT|Onest|Open Sans|Orbitron|Oswald|Outfit|Overpass|Oxanium|
Pacifico|Parisienne|Parkinsans|Passion One|Pathway Gothic One|Patrick Hand|Permanent Marker|Petrona|Philosopher|Piazzolla|Pinyon Script|Pirata One|Playfair|Playfair Display|Playfair Display SC|Plus Jakarta Sans|Poiret One|Poltawski Nowy|Poppins|Prata|Prompt|PT Mono|PT Sans|PT Serif|Public Sans|
Quicksand|Radio Canada|Radley|Rajdhani|Raleway|Readex Pro|Red Hat Display|Red Hat Mono|Red Hat Text|Reddit Sans|Reenie Beanie|Rethink Sans|Righteous|Roboto|Roboto Condensed|Roboto Flex|Roboto Mono|Roboto Serif|Roboto Slab|Rock Salt|Rozha One|Rubik|Rubik Mono One|Rufina|
Sacramento|Saira|Sarabun|Satisfy|Schibsted Grotesk|Sedan|Shadows Into Light|Signika|Sora|Sorts Mill Goudy|Source Code Pro|Source Sans 3|Source Sans Pro|Source Serif 4|Space Grotesk|Space Mono|Spectral|Spline Sans|Sriracha|Staatliches|SUSE|Syncopate|Syne|
Tajawal|Tangerine|Teko|Tenor Sans|Tinos|Titan One|Titillium Web|Tomorrow|Ubuntu|Unbounded|UnifrakturCook|UnifrakturMaguntia|Urbanist|
Varela Round|Vollkorn|Wix Madefor Display|Wix Madefor Text|Work Sans|Yellowtail|Yeseva One|Young Serif|Zen Kaku Gothic New|Zilla Slab
`

const KNOWN = new Map(
  FAMILIES.split(/[|\n]/)
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => [f.toLowerCase(), f] as const)
)

/** Nome oficial da família se ela estiver na lista, com a grafia do Google. */
export const googleFont = (family: string): string | undefined => KNOWN.get(family.trim().toLowerCase())
