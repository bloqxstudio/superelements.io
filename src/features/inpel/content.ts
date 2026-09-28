/**
 * Conteúdo da Inpel lido da API pública do site (controle.inpel.com.br/api)
 * em 2026-09-27: itens visíveis, na ordem em que o site mostra. Caminhos de
 * imagem são relativos a public/inpel/assets. Gerado a partir do levantamento
 * registrado em migrations/inpel; ao atualizar, conferir a ordem com o site.
 */

import { INPEL_CONTACT } from './tokens'

export interface InpelLink { name: string; url: string; image: string }

/** Slider da home: visíveis, `ordem` decrescente (como o site). */
export const SLIDES = [
  { name: 'Caixas de Transmissão', image: 'slider/caixas-de-transmissao.png' },
  { name: 'Peças de reposição', image: 'slider/pecas-de-reposicao.png' },
  { name: 'Nossa história', image: 'slider/nossa-historia.png' },
  { name: 'inpel 2025', image: 'slider/inpel-2025.png' },
  { name: 'ROÇADEIRA', image: 'slider/rocadeira.png' },
  { name: 'MIXER', image: 'slider/mixer.png' },
  { name: 'PLATAFORMA DE MILHO', image: 'slider/plataforma-de-milho.png' },
] as const

/** Os três cartões com a faixa vermelha diagonal. */
const CAREERS = INPEL_CONTACT.careers

export const HIGHLIGHTS: InpelLink[] = [
  { name: 'Sobre a Inpel', url: '/sobre', image: 'destaques/sobre-a-inpel.jpg' },
  { name: 'Caixas de Transmissão', url: '/segmentos', image: 'destaques/caixas-de-transmissao.jpg' },
  { name: 'Trabalhe Conosco', url: CAREERS, image: 'destaques/trabalhe-conosco.jpg' },
]

/** Aplicações (segmentos de nível 1), em ordem alfabética como o site. */
export const SEGMENTS: InpelLink[] = [
  { name: 'ACESSÓRIOS', url: '/produtos/43/ACESSÓRIOS', image: 'segmentos/acessorios.png' },
  {
    name: 'ACIONAMENTO PARA BOMBA HIDRAULICA',
    url: '/produtos/41/ACIONAMENTO-PARA-BOMBA-HIDRAULICA',
    image: 'segmentos/acionamento-para-bomba-hidraulica.png',
  },
  { name: 'CAMA DE AVIÁRIO', url: '/produtos/29/CAMA-DE-AVIÁRIO', image: 'segmentos/cama-de-aviario.png' },
  {
    name: 'DISTRIBUIDOR DE CALCÁRIO DUPLO ABERTO',
    url: '/produtos/45/DISTRIBUIDOR-DE-CALCÁRIO-DUPLO-ABERTO',
    image: 'segmentos/distribuidor-de-calcario-duplo-aberto.png',
  },
  {
    name: 'DISTRIBUIDOR DE CALCÁRIO DUPLO FECHADO',
    url: '/produtos/46/DISTRIBUIDOR-DE-CALCÁRIO-DUPLO-FECHADO',
    image: 'segmentos/distribuidor-de-calcario-duplo-fechado.png',
  },
  {
    name: 'DISTRIBUIDOR DE CALCÁRIO MONO DISCO',
    url: '/produtos/30/DISTRIBUIDOR-DE-CALCÁRIO-MONO-DISCO',
    image: 'segmentos/distribuidor-de-calcario-mono-disco.png',
  },
  {
    name: 'ENXADAS ROTATIVAS',
    url: '/produtos/33/ENXADAS-ROTATIVAS',
    image: 'segmentos/enxadas-rotativas.jpg',
  },
  {
    name: 'ESPALHADOR DE PALHA',
    url: '/produtos/39/ESPALHADOR-DE-PALHA',
    image: 'segmentos/espalhador-de-palha.jpg',
  },
  { name: 'GRANELEIROS', url: '/produtos/26/GRANELEIROS', image: 'segmentos/graneleiros.png' },
  { name: 'MOEDOR DE FENO', url: '/produtos/37/MOEDOR-DE-FENO', image: 'segmentos/moedor-de-feno.jpg' },
  {
    name: 'OUTRAS APLICAÇÕES',
    url: '/produtos/44/OUTRAS-APLICAÇÕES',
    image: 'segmentos/outras-aplicacoes.png',
  },
  {
    name: 'PEÇAS DE REPOSIÇÃO',
    url: '/produtos/47/PEÇAS-DE-REPOSIÇÃO',
    image: 'segmentos/pecas-de-reposicao.png',
  },
  {
    name: 'PERFURADOR DE SOLO',
    url: '/produtos/32/PERFURADOR-DE-SOLO',
    image: 'segmentos/perfurador-de-solo.jpg',
  },
  {
    name: 'PLATAFORMA DE MILHO',
    url: '/produtos/40/PLATAFORMA-DE-MILHO',
    image: 'segmentos/plataforma-de-milho.jpg',
  },
  { name: 'REDUTORES', url: '/produtos/31/REDUTORES', image: 'segmentos/redutores.png' },
  { name: 'ROÇADEIRAS', url: '/produtos/24/ROÇADEIRAS', image: 'segmentos/rocadeiras.png' },
  {
    name: 'ROÇADEIRAS DUPLAS',
    url: '/produtos/25/ROÇADEIRAS-DUPLAS',
    image: 'segmentos/rocadeiras-duplas.png',
  },
  { name: 'ROTORES AXIAIS', url: '/produtos/36/ROTORES-AXIAIS', image: 'segmentos/rotores-axiais.jpg' },
  { name: 'TRINCHAS', url: '/produtos/28/TRINCHAS', image: 'segmentos/trinchas.png' },
  {
    name: 'TRITURADORES FLORESTAIS',
    url: '/produtos/34/TRITURADORES-FLORESTAIS',
    image: 'segmentos/trituradores-florestais.png',
  },
  { name: 'VALETADEIRA', url: '/produtos/38/VALETADEIRA', image: 'segmentos/valetadeira.jpg' },
]

/** Posts visíveis, do mais novo para o mais antigo. */
export const POSTS = [
  {
    title: 'RECORDE DE COLHEITA',
    date: '2026-08-11',
    url: '/blogDetalhe/363/RECORDE-DE-COLHEITA',
    image: 'blog/recorde-de-colheita.png',
    html: '<p>🚜🌽 Recordes exigem componentes à altura dos desafios do campo.</p><p><br></p><p>A recente marca alcançada pela colheitadeira Fendt com plataforma de milho GTS, demonstra o que acontece quando tecnologia, eficiência e confiabilidade trabalham juntas.</p><p><br></p><p>Por trás dessa performance está a Caixa de Transmissão INPEL, projetada para suportar altas cargas, longas jornadas de trabalho e as exigências das operações agrícolas de alta produtividade.</p><p><br></p><p>Temos orgulho de contribuir para que máquinas de ponta entreguem resultados extraordinários.</p><p><br></p><p>INPEL: porque desempenho se conquista com transmissão de confiança. </p><p><br></p><p>https://www.instagram.com/reel/Db3wFcHtlPO/?utm_source=ig_web_copy_link&amp;igsh=MzRlODBiNWFlZA==</p><p><br></p><p><a href="https://www.instagram.com/fendt.brasil/" rel="noopener noreferrer" target="_blank">@fendt.brasil</a> <a href="https://www.instagram.com/gtsdobrasil/" rel="noopener noreferrer" target="_blank">@gtsdobrasil</a> <a href="https://www.instagram.com/rankbrasil/" rel="noopener noreferrer" target="_blank">@rankbrasil</a> 🤝💪</p><p><br></p><p><a href="https://www.instagram.com/explore/tags/colheita/" rel="noopener noreferrer" target="_blank">#colheita</a> <a href="https://www.instagram.com/explore/tags/milho/" rel="noopener noreferrer" target="_blank">#milho</a> <a href="https://www.instagram.com/explore/tags/rankbrasil/" rel="noopener noreferrer" target="_blank">#rankbrasil</a> <a href="https://www.instagram.com/explore/tags/inpel/" rel="noopener noreferrer" target="_blank">#inpel</a> <a href="https://www.instagram.com/explore/tags/agricultura/" rel="noopener noreferrer" target="_blank">#agricultura</a></p>',
  },
  {
    title: 'Fábrica sem Papel',
    date: '2026-04-16',
    url: '/blogDetalhe/361/Fábrica-sem-Papel',
    image: 'blog/fabrica-sem-papel.png',
    html: '<p>Informações descentralizadas podem gerar distorções e impactar diretamente a conformidade dos processos. Na INPEL, esse cenário foi superado com a centralização das informações de engenharia em um sistema PDM (Product Data Management).</p><p>Com isso, eliminamos o uso de desenhos em papel e passamos a operar com uma base única de dados, garantindo controle de versão, rastreabilidade e integridade das informações ao longo de todo o ciclo do produto.</p><p>O fluxo é integrado entre engenharia, qualidade e produção, assegurando que todas as áreas trabalhem com dados atualizados e validados.</p><p>Na prática, isso reduz retrabalho, elimina divergências e aumenta a confiabilidade entre o que é projetado e o que é produzido.</p><p>Mais do que digitalização, trata-se de controle de engenharia aplicado ao processo produtivo.</p>',
  },
  {
    title: 'Agritechnica - Alemanha',
    date: '2025-11-10',
    url: '/blogDetalhe/359/Agritechnica---Alemanha',
    image: 'blog/agritechnica-alemanha.png',
    html: '<p><span class="ql-size-large">A equipe técnica da Inpel está participando da Feira Agritechnica, reconhecida como o principal evento mundial voltado à inovação e à tecnologia para o setor agrícola.</span></p><p><span class="ql-size-large">Durante a visita, estamos buscando novas oportunidades de negócio, acompanhando tendências e avanços tecnológicos relacionados ao nosso segmento de transmissões mecânicas, além de prestar suporte aos nossos clientes e prestigiar os fabricantes brasileiros que estão expondo seus produtos.</span></p><p><span class="ql-size-large">Essa participação reforça o compromisso da Inpel em trazer soluções modernas, eficientes e de alto desempenho ao mercado brasileiro, contribuindo para o desenvolvimento do agronegócio e para a competitividade dos clientes e parceiros.</span></p>',
  },
  {
    title: '39º Concurso Brasileiro de Projetos Participativos - AGQ',
    date: '2025-10-24',
    url: '/blogDetalhe/358/39º-Concurso-Brasileiro-de-Projetos-Participativos---AGQ',
    image: 'blog/39-concurso-brasileiro-de-projetos-participativos-agq.png',
    html: '<p>Com orgulho, compartilhamos que a INPEL participou pela primeira vez do Concurso Brasileiro de Projetos Participativos da AGQ e foi reconhecida com a premiação Bronze na categoria Mostra de Ideias.</p><p><br></p><p>O projeto premiado, “Dentamento de Engrenagens com Corte a Seco”, representa o comprometimento da nossa equipe com a inovação, a eficiência e a sustentabilidade nos processos produtivos.</p><p><br></p><p>Parabenizamos todos os funcionários envolvidos por essa importante conquista!</p>',
  },
  {
    title: 'Treinamento de Engrenagens Cilindricas',
    date: '2025-08-07',
    url: '/blogDetalhe/345/Treinamento-de-Engrenagens-Cilindricas',
    image: 'blog/treinamento-de-engrenagens-cilindricas.png',
    html: '<p>Treinamento com Norberto Mazzo – Fundamentos em Engrenagens Cilíndricas ⚙️</p><p><br></p><p>Tivemos a honra de receber na INPEL o especialista Norberto Mazzo para um treinamento técnico com nosso time, com o tema “Fundamentos em Engrenagens Cilíndricas”. Norberto é referência nacional no assunto, com décadas de experiência na área e autor de um dos principais livros sobre engrenagens já publicados no Brasil.</p><p><br></p><p>Durante o encontro, ele compartilhou não só os fundamentos teóricos, mas também valiosas práticas de projeto e fabricação, trazendo muitos insights que só quem vive no chão de fábrica conhece.</p><p>Foi um momento de muito aprendizado e troca, que certamente vai contribuir para elevar ainda mais o nível técnico da nossa equipe.</p><p><br></p><p>Agradecemos ao Norberto por sua generosidade em dividir tanto conhecimento!</p>',
  },
]

export const ABOUT = {
  title: 'Apresentação',
  html: '<p>A Inpel é especialista na fabricação de<strong> Caixas de Transmissão e Engrenagens Cônicas.</strong></p><p><br></p><p>Fornece seus produtos há quase 70 anos para <strong>montadoras de máquinas e implementos agrícolas.</strong> As<strong> caixas de transmissão Inpel</strong>, possuem certificação ISO 9001 : 2015 desde 1997, garantia de qualidade de nossos produtos.</p><p>Trabalhamos com <strong>caixas de transmissões agrícolas</strong> desenvolvidas especialmente para: <strong>espalhadores</strong> que garantem uma distribuição uniforme,<strong> graneleiros</strong> que facilitam o armazenamento de colheitas,<strong> roçadeiras</strong> que mantêm o terreno sob controle, <strong>trinchas</strong> para o manejo eficaz da vegetação, <strong>rotores axiais de colheitadeiras</strong> que impulsionam a produtividade, <strong>perfuradores de solo</strong> que facilitam o trabalho do dia a dia e <strong>plataformas de colheita de milho</strong> que tornam a colheita mais eficiente. Fornecemos também todas as peças de reposição para nossa linha de produtos.</p><p class="ql-align-justify">Desenvolvemos soluções específicas e <strong>personalizadas</strong>. Oferecemos <strong>dedicação, garantia e assistência técnica em todas as etapas.</strong></p><p class="ql-align-justify"><br></p><p class="ql-align-justify"><strong>Inpel, a melhor solução em Transmissões Mecânicas!!</strong></p><p class="ql-align-justify"><br></p>',
  videoTitle: 'Vídeo Institucional',
  video: 'https://www.youtube.com/watch?v=qjBPZ9_Y4LU',
  image: 'sobre/fachada-inpel.jpg',
}

/** Downloads da página Sobre: arte clicável que abre o PDF no SharePoint da Inpel. */
export const DOWNLOADS = [
  {
    name: 'Certificado de qualidade',
    url: 'https://inpelcombr-my.sharepoint.com/:b:/g/personal/elis_inpel_com_br/EapVCtlN50tFhW8nM5L-zeEByg4VLZkkP5a6DN3_2z7ybQ?e=dU0lp4',
    image: 'sobre/certificado-da-qualidade.png',
  },
  {
    name: 'Política da qualidade',
    url: 'https://inpelcombr-my.sharepoint.com/:b:/g/personal/elis_inpel_com_br/EZ4D98plqxdKi786UFOPiFcBD0ZL6s5ISFAZyGpbsiXg3w?e=iEXTla',
    image: 'sobre/politica-da-qualidade.png',
  },
]

export const PARTNERS = [
  { name: 'AGCO', image: 'parceiros/agco.png' },
  { name: 'John Deere', image: 'parceiros/john-deere.png' },
  { name: 'Stara', image: 'parceiros/stara.png' },
  { name: 'GTS', image: 'parceiros/gts.jpg' },
  { name: 'Indutar', image: 'parceiros/indutar.png' },
  { name: 'TRITON', image: 'parceiros/triton.png' },
  { name: 'schumacher', image: 'parceiros/schumacher.png' },
  { name: 'JACTO', image: 'parceiros/jacto.png' },
]

export const LEGAL = [
  {
    id: 194,
    title: 'Termos de Uso',
    url: '/InformacoesLgpd/194/Termos-de-Uso',
    html: '<h3 class="ql-align-justify">Esta política de Termos de Uso é válida a partir de Jan 2023.</h3><p class="ql-align-justify">Inpel, pessoa jurídica de direito privado descreve, através deste documento, as regras de uso do site www.inpel.com.br e qualquer outro site, loja ou aplicativo operado pelo proprietário.</p><p class="ql-align-justify">Ao navegar neste website, consideramos que você está de acordo com os Termos de Uso abaixo.</p><p class="ql-align-justify">Caso você não esteja de acordo com as condições deste contrato, pedimos que não faça mais uso deste website, muito menos cadastre-se ou envie os seus dados pessoais.</p><p class="ql-align-justify">Se modificarmos nossos Termos de Uso, publicaremos o novo texto neste website, com a data de revisão atualizada. Podemos alterar este documento a qualquer momento. Caso haja alteração significativa nos termos deste contrato, podemos informá-lo por meio das informações de contato que tivermos em nosso banco de dados ou por meio de notificações.</p><p class="ql-align-justify">A utilização deste website após as alterações significa que você aceitou os Termos de Uso revisados. Caso, após a leitura da versão revisada, você não esteja de acordo com seus termos, favor encerrar o seu acesso.</p><h4 class="ql-align-justify">Seção 1 - Usuário</h4><ul><li class="ql-align-justify">A utilização deste website atribui de forma automática a condição de Usuário e implica a plena aceitação de todas as diretrizes e condições incluídas nestes Termos.</li></ul><h4 class="ql-align-justify">Seção 2 - Adesão em conjunto com a Política de Privacidade</h4><ul><li class="ql-align-justify">A utilização deste website acarreta a adesão aos presentes Termos de Uso e a versão mais atualizada da Política de Privacidade de Inpel.</li></ul><h4 class="ql-align-justify">Seção 3 - Condições de acesso</h4><ul><li class="ql-align-justify">Em geral, o acesso ao website da Inpel possui caráter gratuito e não exige prévia inscrição ou registro.</li><li class="ql-align-justify">Contudo, para usufruir de algumas funcionalidades, o usuário poderá precisar efetuar um cadastro, criando uma conta de usuário com login e senha próprios para acesso.</li><li class="ql-align-justify">É de total responsabilidade do usuário fornecer apenas informações corretas, autênticas, válidas, completas e atualizadas, bem como não divulgar o seu login e senha para terceiros.</li><li class="ql-align-justify">Partes deste website oferecem ao usuário a opção de publicar comentários em determinadas áreas. Inpel não consente com a publicação de conteúdos que tenham natureza discriminatória, ofensiva ou ilícita, ou ainda infrinjam direitos de autor ou quaisquer outros direitos de terceiros.</li><li class="ql-align-justify">A publicação de quaisquer conteúdos pelo usuário deste website, incluindo mensagens e comentários, implica em licença não-exclusiva, irrevogável e irretratável, para sua utilização, reprodução e publicação pela Inpel no seu website, plataformas e aplicações de internet, ou ainda em outras plataformas, sem qualquer restrição ou limitação.</li></ul><h4 class="ql-align-justify">Seção 4 - Cookies</h4><ul><li class="ql-align-justify">Informações sobre o seu uso neste website podem ser coletadas a partir de cookies. Cookies são informações armazenadas diretamente no computador que você está utilizando. Os cookies permitem a coleta de informações tais como o tipo de navegador, o tempo despendido no website, as páginas visitadas, as preferências de idioma, e outros dados de tráfego anônimos. Nós e nossos prestadores de serviços utilizamos informações para proteção de segurança, para facilitar a navegação, exibir informações de modo mais eficiente, e personalizar sua experiência ao utilizar este website, assim como para rastreamento online. Também coletamos informações estatísticas sobre o uso do website para aprimoramento contínuo do nosso design e funcionalidade, para entender como o website é utilizado e para auxiliá-lo a solucionar questões relevantes.</li><li class="ql-align-justify">Caso não deseje que suas informações sejam coletadas por meio de cookies, há um procedimento simples na maior parte dos navegadores que permite que os cookies sejam automaticamente rejeitados, ou oferece a opção de aceitar ou rejeitar a transferência de um cookie (ou cookies) específico(s) de um site determinado para o seu computador. Entretanto, isso pode gerar inconvenientes no uso do website.</li><li class="ql-align-justify">As definições que escolher podem afetar a sua experiência de navegação e o funcionamento que exige a utilização de cookies. Neste sentido, rejeitamos qualquer responsabilidade pelas consequências resultantes do funcionamento limitado deste website provocado pela desativação de cookies no seu dispositivo (incapacidade de definir ou ler um cookie).</li></ul><h4 class="ql-align-justify">Seção 5 - Propriedade Intelectual</h4><ul><li class="ql-align-justify">Todos os elementos de Inpel são de propriedade intelectual da mesma ou de seus licenciados. Estes Termos ou a utilização do website não concede a você qualquer licença ou direito de uso dos direitos de propriedade intelectual da Inpel ou de terceiros.</li></ul><h4 class="ql-align-justify">Seção 6 - Links para sites de terceiros</h4><ul><li class="ql-align-justify">Este website poderá, de tempos a tempos, conter links de hipertexto que redirecionará você para sites das redes dos nossos parceiros, anunciantes, fornecedores etc. Se você clicar em um desses links para qualquer um desses sites, lembre-se que cada site possui as suas próprias práticas de privacidade e que não somos responsáveis por essas políticas. Consulte as referidas políticas antes de enviar quaisquer Dados Pessoais para esses sites.</li><li class="ql-align-justify">Não nos responsabilizamos pelas políticas e práticas de coleta, uso e divulgação (incluindo práticas de proteção de dados) de outras organizações, tais como Facebook, Apple, Google, Microsoft, ou de qualquer outro desenvolvedor de software ou provedor de aplicativo, loja de mídia social, sistema operacional, prestador de serviços de internet sem fio ou fabricante de dispositivos, incluindo todos os Dados Pessoais que divulgar para outras organizações por meio dos aplicativos, relacionadas a tais aplicativos, ou publicadas em nossas páginas em mídias sociais. Nós recomendamos que você se informe sobre a política de privacidade e termos de uso de cada site visitado ou de cada prestador de serviço utilizado.</li></ul><h4 class="ql-align-justify">Seção 7 - Prazos e alterações</h4><ul><li class="ql-align-justify">O funcionamento deste website se dá por prazo indeterminado.</li><li class="ql-align-justify">O website no todo ou em cada uma das suas seções, pode ser encerrado, suspenso ou interrompido unilateralmente por Inpel, a qualquer momento e sem necessidade de prévio aviso.</li></ul><h4 class="ql-align-justify">Seção 8 - Dados pessoais</h4><ul><li class="ql-align-justify">Durante a utilização deste website, certos dados pessoais serão coletados e tratados por Inpel e/ou pelos Parceiros. As regras relacionadas ao tratamento de dados pessoais de Inpel estão estipuladas na Política de Privacidade.</li></ul>',
  },
  {
    id: 195,
    title: 'Política de Privacidade',
    url: '/InformacoesLgpd/195/Política-de-Privacidade',
    html: '<p class="ql-align-justify">Inpel, pessoa jurídica de direito privado leva a sua privacidade a sério e zela pela segurança e proteção de dados de todos os seus clientes, parceiros, fornecedores e usuários do site domínio www.inpel.com.br e qualquer outro site, loja ou aplicativo operado pelo lojista.</p><p class="ql-align-justify">Esta Política de Privacidade destina-se a informá-lo sobre o modo como nós utilizamos e divulgamos informações coletadas em suas visitas à nossa loja e em mensagens que trocamos com você.</p><p class="ql-align-justify">Esta Política de Privacidade aplica-se somente a informações coletadas por meio da loja.</p><p class="ql-align-justify">AO ACESSAR A LOJA, ENVIAR COMUNICAÇÕES OU FORNECER QUALQUER TIPO DE DADO PESSOAL, VOCÊ DECLARA ESTAR CIENTE COM RELAÇÃO AOS TERMOS AQUI PREVISTOS E DE ACORDO COM A POLÍTICA DE PRIVACIDADE, A QUAL DESCREVE AS FINALIDADES E FORMAS DE TRATAMENTO DE SEUS DADOS PESSOAIS QUE VOCÊ DISPONIBILIZAR NA LOJA.</p><p class="ql-align-justify">Esta Política de Privacidade fornece uma visão geral de nossas práticas de privacidade e das escolhas que você pode fazer, bem como direitos que você pode exercer em relação aos Dados Pessoais tratados por nós. Se você tiver alguma dúvida sobre o uso de Dados Pessoais, entre em contato com <u style="color: rgb(230, 0, 0);">EMAIL AQUI</u></p><p class="ql-align-justify">Além disso, a Política de Privacidade não se aplica a quaisquer aplicativos, produtos, serviços, site ou recursos de mídia social de terceiros que possam ser oferecidos ou acessados por meio da loja. O acesso a esses links fará com que você deixe o nosso site e poderá resultar na coleta ou compartilhamento de informações sobre você por terceiros. Nós não controlamos, endossamos ou fazemos quaisquer representações sobre sites de terceiros ou suas práticas de privacidade, que podem ser diferentes das nossas. Recomendamos que você revise a política de privacidade de qualquer site com o qual você interaja antes de permitir a coleta e o uso de seus Dados Pessoais.</p><p class="ql-align-justify">Caso você nos envie Dados Pessoais referentes a outras pessoas físicas, você declara ter a competência para fazê-lo e declara ter obtido o consentimento necessário para autorizar o uso de tais informações nos termos desta Política de Privacidade.</p><h3 class="ql-align-justify">Seção 1 - Definições</h3><p class="ql-align-justify">Para os fins desta Política de Privacidade:</p><ol><li class="ql-align-justify">"Dados Pessoais": significa qualquer informação que, direta ou indiretamente, identifique ou possa identificar uma pessoa natural, como por exemplo, nome, CPF, data de nascimento, endereço IP, dentre outros;</li><li class="ql-align-justify">"Dados Pessoais Sensíveis": significa qualquer informação que revele, em relação a uma pessoa natural, origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato ou a organização de caráter religioso, filosófico ou político, dado referente à saúde ou à vida sexual, dado genético ou biométrico;</li><li class="ql-align-justify">"Tratamento de Dados Pessoais": significa qualquer operação efetuada no âmbito dos Dados Pessoais, por meio de meios automáticos ou não, tal como a recolha, gravação, organização, estruturação, armazenamento, adaptação ou alteração, recuperação, consulta, utilização, divulgação por transmissão, disseminação ou, alternativamente, disponibilização, harmonização ou associação, restrição, eliminação ou destruição. Também é considerado Tratamento de Dados Pessoais qualquer outra operação prevista nos termos da legislação aplicável;</li><li class="ql-align-justify">"Leis de Proteção de Dados": significa todas as disposições legais que regulam o Tratamento de Dados Pessoais, incluindo, porém sem se limitar, a Lei nº 13.709/18, Lei Geral de Proteção de Dados Pessoais ("LGPD").</li></ol><h3 class="ql-align-justify">Seção 2 - Uso de Dados Pessoais</h3><p class="ql-align-justify">Coletamos e usamos Dados Pessoais para gerenciar seu relacionamento conosco e melhor atendê-lo quando você estiver adquirindo produtos e/ou serviços na loja, personalizando e melhorando sua experiência. Exemplos de como usamos os dados incluem:</p><ol><li class="ql-align-justify">Viabilizar que você adquira produtos e/ou serviços na loja;</li><li class="ql-align-justify">Para confirmar ou corrigir as informações que temos sobre você;</li><li class="ql-align-justify">Para enviar informações que acreditamos ser do seu interesse;</li><li class="ql-align-justify">Para personalizar sua experiência de uso da loja;</li><li class="ql-align-justify">Para entrarmos em contato por um número de telefone e/ou endereço de e-mail fornecido. Podemos entrar em contato com você pessoalmente, por mensagem de voz, através de equipamentos de discagem automática, por mensagens de texto (SMS), por e-mail, ou por qualquer outro meio de comunicação que seu dispositivo seja capaz de receber, nos termos da lei e para fins comerciais razoáveis.</li></ol><p class="ql-align-justify">Além disso, os Dados Pessoais fornecidos também podem ser utilizados na forma que julgarmos necessária ou adequada: (a) nos termos das Leis de Proteção de Dados; (b) para atender exigências de processo judicial; (c) para cumprir decisão judicial, decisão regulatória ou decisão de autoridades competentes, incluindo autoridades fora do país de residência; (d) para aplicar nossos Termos e Condições de Uso; (e) para proteger nossas operações; (f) para proteger direitos, privacidade, segurança nossos, seus ou de terceiros; (g) para detectar e prevenir fraude; (h) permitir-nos usar as ações disponíveis ou limitar danos que venhamos a sofrer; e (i) de outros modos permitidos por lei.</p><h3 class="ql-align-justify">Seção 3 - Não fornecimento de Dados Pessoais</h3><p class="ql-align-justify">Não há obrigatoriedade em compartilhar os Dados Pessoais que solicitamos. No entanto, se você optar por não os compartilhar, em alguns casos, não poderemos fornecer a você acesso completo à loja, alguns recursos especializados ou ser capaz de prestar a assistência necessária ou, ainda, viabilizar a entrega do produto ou prestar o serviço contratado por você.</p><h3 class="ql-align-justify">Seção 4 - Dados coletados</h3><p class="ql-align-justify">O público em geral poderá navegar na loja sem necessidade de qualquer cadastro e envio de Dados Pessoais. No entanto, algumas das funcionalidades da loja poderão depender de cadastro e envio de Dados Pessoais como concluir a compra/contratação do serviço e/ou a viabilizar a entrega do produto/prestação do serviço por nós.</p><p class="ql-align-justify">No contato a loja, nós podemos coletar:</p><ol><li class="ql-align-justify">Dados de contato: nome, sobrenome, número de telefone, endereço, cidade, estado e endereço de e-mail;</li><li class="ql-align-justify">Informações enviadas: informações que você envia via formulário (dúvidas, reclamações, sugestões, críticas, elogios etc.).</li></ol><p class="ql-align-justify">Na navegação geral na loja, nós poderemos coletar:</p><ol><li class="ql-align-justify">Dados de localização: dados de geolocalização quando você acessa a loja;</li><li class="ql-align-justify">Preferências: informações sobre suas preferências e interesses em relação aos produtos/serviços (quando você nos diz o que eles são ou quando os deduzimos do que sabemos sobre você);</li><li class="ql-align-justify">Dados de navegação na loja: informações sobre suas visitas e atividades, incluindo o conteúdo (e quaisquer anúncios) com os quais você visualiza e interage, informações sobre o navegador e o dispositivo que você está usando, seu endereço IP, sua localização, o endereço do site a partir do qual você chegou. Algumas dessas informações são coletadas usando nossas Ferramentas de Coleta Automática de Dados, que incluem cookies, web beacons e links da web incorporados. Para saber mais, leia como nós usamos Ferramentas de Coleta Automática de Dados na seção 7 abaixo;</li><li class="ql-align-justify">Dados anônimos ou agregados: respostas anônimas para pesquisas ou informações anônimas e agregadas sobre como a loja é usufruída. Durante nossas operações, em certos casos, aplicamos um processo de desidentificação ou pseudonimização aos seus dados para que seja razoavelmente improvável que você identifique você através do uso desses dados com a tecnologia disponível;</li><li class="ql-align-justify">Outras informações que podemos coletar: informações que não revelem especificamente a sua identidade ou que não são diretamente relacionadas a um indivíduo, tais como informações sobre navegador e dispositivo; dados de uso da Loja; e informações coletadas por meio de cookies, pixel tags e outras tecnologias.</li></ol><p class="ql-align-justify">Nós não coletamos Dados Pessoais Sensíveis.</p><h3 class="ql-align-justify">Seção 5 - Compartilhamento de Dados Pessoais com terceiros</h3><p class="ql-align-justify">Nós poderemos compartilhar seus Dados Pessoais:</p><ol><li class="ql-align-justify">Com a(s) empresa(s) parceira(s) que você selecionar ou optar em enviar os seus dados, dúvidas, perguntas etc., bem como com provedores de serviços ou parceiros para gerenciar ou suportar certos aspectos de nossas operações comerciais em nosso nome. Esses provedores de serviços ou parceiros podem estar localizados nos Estados Unidos, na Argentina, no Brasil ou em outros locais globais, incluindo servidores para homologação e produção, e prestadores de serviços de hospedagem e armazenamento de dados, gerenciamento de fraudes, suporte ao cliente, vendas em nosso nome, atendimento de pedidos, personalização de conteúdo, atividades de publicidade e marketing (incluindo publicidade digital e personalizada) e serviços de TI, por exemplo;</li><li class="ql-align-justify">Com terceiros, com o objetivo de nos ajudar a gerenciar a loja;</li><li class="ql-align-justify">Com terceiros, caso ocorra qualquer reorganização, fusão, venda, joint venture, cessão, transmissão ou transferência de toda ou parte da nossa empresa, ativo ou capital (incluindo os relativos à falência ou processos semelhantes).</li></ol><h3 class="ql-align-justify">Seção 6 - Transferências internacionais de dados</h3><p class="ql-align-justify">Dados Pessoais e informações de outras naturezas coletadas por nós podem ser transferidos ou acessados por entidades pertencentes ao grupo corporativo das empresas parceiras em todo o mundo de acordo com esta Política de Privacidade.</p><h3 class="ql-align-justify">Seção 7 - Coleta automática de Dados Pessoais</h3><p class="ql-align-justify">Quando você visita a loja, ela pode armazenar ou recuperar informações em seu navegador, principalmente na forma de cookies, que são arquivos de texto contendo pequenas quantidades de informação. Essas informações podem ser sobre você, suas preferências ou seu dispositivo e são usadas principalmente para que a loja funcione como você espera. As informações geralmente não o identificam diretamente, mas podem oferecer uma experiência na internet mais personalizada.</p><p class="ql-align-justify">De acordo com esta Política de Privacidade, nós e nossos prestadores de serviços terceirizados, mediante seu consentimento, podemos coletar seus Dados Pessoais de diversas formas, incluindo, entre outros:</p><ol><li class="ql-align-justify">Por meio do navegador ou do dispositivo: algumas informações são coletadas pela maior parte dos navegadores ou automaticamente por meio de dispositivos de acesso à internet, como o tipo de computador, resolução da tela, nome e versão do sistema operacional, modelo e fabricante do dispositivo, idioma, tipo e versão do navegador de Internet que está utilizando. Podemos utilizar essas informações para assegurar que a loja funcione adequadamente.</li><li class="ql-align-justify">Uso de cookies: informações sobre o seu uso da loja podem ser coletadas por terceiros a partir de cookies. Cookies são informações armazenadas diretamente no computador que você está utilizando. Os cookies permitem a coleta de informações tais como o tipo de navegador, o tempo despendido na loja, as páginas visitadas, as preferências de idioma, e outros dados de tráfego anônimos. Nós e nossos prestadores de serviços utilizamos informações para proteção de segurança, para facilitar a navegação, exibir informações de modo mais eficiente, e personalizar sua experiência ao utilizar a loja, assim como para rastreamento online. Também coletamos informações estatísticas sobre o uso da loja para aprimoramento contínuo do nosso design e funcionalidade, para entender como a loja é utilizada e para auxiliá-lo a solucionar questões relativas à loja.</li><li class="ql-align-justify">Caso não deseje que suas informações sejam coletadas por meio de cookies, há um procedimento simples na maior parte dos navegadores que permite que os cookies sejam automaticamente rejeitados, ou oferece a opção de aceitar ou rejeitar a transferência de um cookie (ou cookies) específico(s) de um site determinado para o seu computador. Entretanto, isso pode gerar inconvenientes no uso da loja.</li><li class="ql-align-justify">As definições que escolher podem afetar a sua experiência de navegação e o funcionamento que exige a utilização de cookies. Neste sentido, rejeitamos qualquer responsabilidade pelas consequências resultantes do funcionamento limitado da loja provocado pela desativação de cookies no seu dispositivo (incapacidade de definir ou ler um cookie).</li><li class="ql-align-justify">Uso de pixel tags e outras tecnologias similares: pixel tags (também conhecidos como Web beacons e GIFs invisíveis) podem ser utilizados para rastrear ações de usuários da loja (incluindo destinatários de e-mails), medir o sucesso das nossas campanhas de marketing e coletar dados estatísticos sobre o uso da loja e taxas de resposta, e ainda para outros fins não especificados. Podemos contratar empresas de publicidade comportamental, para obter relatórios sobre os anúncios da loja em toda a internet. Para isso, essas empresas utilizam cookies, pixel tags e outras tecnologias para coletar informações sobre a sua utilização, ou sobre a utilização de outros usuários, da nossa loja e de site de terceiros. Nós não somos responsáveis por pixel tags, cookies e outras tecnologias similares utilizadas por terceiros.</li></ol><h3 class="ql-align-justify">Seção 8 - Direitos do Usuário</h3><p class="ql-align-justify">Você pode, a qualquer momento, requerer: (i) confirmação de que seus Dados Pessoais estão sendo tratados; (ii) acesso aos seus Dados Pessoais; (iii) correções a dados incompletos, inexatos ou desatualizados; (iv) anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com o disposto em lei; (v) portabilidade de Dados Pessoais a outro prestador de serviços, contanto que isso não afete nossos segredos industriais e comerciais; (vi) eliminação de Dados Pessoais tratados com seu consentimento, na medida do permitido em lei; (vii) informações sobre as entidades às quais seus Dados Pessoais tenham sido compartilhados; (viii) informações sobre a possibilidade de não fornecer o consentimento e sobre as consequências da negativa; e (ix) revogação do consentimento. Os seus pedidos serão tratados com especial cuidado de forma a que possamos assegurar a eficácia dos seus direitos. Poderá lhe ser pedido que faça prova da sua identidade de modo a assegurar que a partilha dos Dados Pessoais é apenas feita com o seu titular.</p><p class="ql-align-justify">Você deverá ter em mente que, em certos casos (por exemplo, devido a requisitos legais), o seu pedido poderá não ser imediatamente satisfeito, além de que nós poderemos não conseguir atendê-lo por conta de cumprimento de obrigações legais.</p><h3 class="ql-align-justify">Seção 10 - Segurança dos Dados Pessoais</h3><p class="ql-align-justify">Buscamos adotar as medidas técnicas e organizacionais previstas pelas Leis de Proteção de Dados adequadas para proteção dos Dados Pessoais na nossa organização. Infelizmente, nenhuma transmissão ou sistema de armazenamento de dados tem a garantia de serem 100% seguros. Caso tenha motivos para acreditar que sua interação conosco tenha deixado de ser segura (por exemplo, caso acredite que a segurança de qualquer uma de suas contas foi comprometida), favor nos notificar imediatamente.</p><h3 class="ql-align-justify">Seção 11 - Links de hipertexto para outros sites e redes sociais</h3><p class="ql-align-justify">A Loja poderá, de tempos a tempos, conter links de hipertexto que redirecionará você para sites das redes dos nossos parceiros, anunciantes, fornecedores etc. Se você clicar em um desses links para qualquer um desses sites, lembre-se que cada site possui as suas próprias práticas de privacidade e que não somos responsáveis por essas políticas. Consulte as referidas políticas antes de enviar quaisquer Dados Pessoais para esses sites.</p><p class="ql-align-justify">Não nos responsabilizamos pelas políticas e práticas de coleta, uso e divulgação (incluindo práticas de proteção de dados) de outras organizações, tais como Facebook, Apple, Google, Microsoft, ou de qualquer outro desenvolvedor de software ou provedor de aplicativo, loja de mídia social, sistema operacional, prestador de serviços de internet sem fio ou fabricante de dispositivos, incluindo todos os Dados Pessoais que divulgar para outras organizações por meio dos aplicativos, relacionadas a tais aplicativos, ou publicadas em nossas páginas em mídias sociais. Nós recomendamos que você se informe sobre a política de privacidade de cada site visitado ou de cada prestador de serviço utilizado.</p><h3 class="ql-align-justify">Seção 12 - Atualizações desta Política de Privacidade</h3><p class="ql-align-justify">Se modificarmos nossa Política de Privacidade, publicaremos o novo texto na loja, com a data de revisão atualizada. Podemos alterar esta Política de Privacidade a qualquer momento. Caso haja alteração significativa nos termos desta Política de Privacidade, podemos informá-lo por meio das informações de contato que tivermos em nosso banco de dados ou por meio de notificação em nossa loja.</p><p class="ql-align-justify">Recordamos que nós temos como compromisso não tratar os seus Dados Pessoais de forma incompatível com os objetivos descritos acima, exceto se de outra forma requerido por lei ou ordem judicial.</p><p class="ql-align-justify">Sua utilização da loja após as alterações significa que aceitou as Políticas de Privacidade revisadas. Caso, após a leitura da versão revisada, você não esteja de acordo com seus termos, favor encerrar o acesso à loja.</p><h3 class="ql-align-justify">Seção 13 - Encarregado do tratamento dos Dados Pessoais</h3><p class="ql-align-justify">Caso pretenda exercer qualquer um dos direitos previstos, inclusive retirar o seu consentimento, nesta Política de Privacidade e/ou nas Leis de Proteção de Dados, ou resolver quaisquer dúvidas relacionadas ao Tratamento de seus Dados Pessoais, favor contatar-nos em vendas@inpel.com.br</p>',
  },
  {
    id: 196,
    title: 'Política Cookies',
    url: '/InformacoesLgpd/196/Política-Cookies',
    html: '<p class="ql-align-justify">Os cookies utilizados na nossa loja estão de acordo com os requisitos legais e são enquadrados nas seguintes categorias:</p><ol><li class="ql-align-justify">Estritamente necessários: estes cookies permitem que você navegue pelo site e desfrute de recursos essenciais com segurança. Um exemplo são os cookies de segurança, que autenticam os usuários, protegem os seus dados e evitam a criação de logins fraudulentos.</li><li class="ql-align-justify">Desempenho: os cookies desta categoria coletam informações de forma codificada e anônima relacionadas à nossa loja virtual, como, por exemplo, o número de visitantes de uma página específica, origem das visitas ao site e quais as páginas acessadas pelo usuário. Todos os dados coletados são utilizados apenas para eventuais melhorias no site e para medir a eficácia da nossa comunicação.</li><li class="ql-align-justify">Funcionalidade: estes cookies são utilizados para lembrar definições de preferências do usuário com o objetivo de melhorar a sua visita no nosso site, como, por exemplo, configurações aplicadas no layout do site ou suas respostas para pop-ups de promoções e cadastros -; dessa forma, não será necessário perguntar inúmeras vezes.</li><li class="ql-align-justify">Publicidade: utilizamos cookies com o objetivo de criar campanhas segmentadas e entregar anúncios de acordo com o seu perfil de consumo na nossa loja virtual.</li></ol>',
  },
  {
    id: 197,
    title: 'Código de Ética',
    url: '/InformacoesLgpd/197/Código-de-Ética',
    html: '<p>Este Código de Ética define não só os princípios que devem orientar o trabalho e as relações na empresa, como também a conduta ética que cada profissional deve adotar. Também define a postura social desta empresa face aos diferentes públicos com os quais interage.</p><p><br></p><p>Confira o <a href="https://inpelstr.quickconnect.to/d/s/19XWSTT2g4C74aOfp1jqm3Y0EGeugEHe/ZDo63nKMxJuEuAuWefi4y3qgYJGi4U89-4LOgAuYScQ0" rel="noopener noreferrer" target="_blank"><strong>Código de Ética</strong></a> completo.</p>',
  },
]

export const FEEDBACK = {
  title: 'QUEREMOS SABER A SUA OPINIÃO!',
  html: '<p>Deixe aqui sua avaliação sobre nosso atendimento, produtos e demais serviços da Inpel.</p>',
}

/** Roçadeiras: os cinco modelos, na ordem da página /produtos/24/ROÇADEIRAS. */
export const PRODUCTS = [
  { name: 'CT-135', url: '/produtoDetalhe/864/CT-135', tag: 'LANÇAMENTO', image: 'produtos/ct-135.jpg' },
  {
    name: 'CAIXA DE TRANSMISSÃO INPEL CT-145',
    url: '/produtoDetalhe/801/CAIXA-DE-TRANSMISSÃO-INPEL-CT-145',
    tag: '3 ANOS DE GARANTIA',
    image: 'produtos/caixa-de-transmissao-inpel-ct-145.jpg',
  },
  {
    name: 'CAIXA DE TRANSMISSÃO INPEL CT-150',
    url: '/produtoDetalhe/802/CAIXA-DE-TRANSMISSÃO-INPEL-CT-150',
    tag: '3 ANOS DE GARANTIA',
    image: 'produtos/caixa-de-transmissao-inpel-ct-150.jpg',
  },
  {
    name: 'CAIXA DE TRANSMISSÃO INPEL CT-125',
    url: '/produtoDetalhe/800/CAIXA-DE-TRANSMISSÃO-INPEL-CT-125',
    tag: '3 ANOS DE GARANTIA',
    image: 'produtos/caixa-de-transmissao-inpel-ct-125.jpg',
  },
  { name: 'CT-146', url: '/produtoDetalhe/847/CT-146', tag: null, image: 'produtos/ct-146.jpg' },
]

/** Detalhe do CT-145 (produtoDetalhe/801), com as opções do "Monte a sua caixa". */
export const PRODUCT = {
  name: 'CAIXA DE TRANSMISSÃO INPEL CT-145',
  segment: 'Roçadeiras',
  tag: '3 ANOS DE GARANTIA',
  summary: '<p><strong>Caixa de transmissão desenvolvida especialmente para uso em roçadeiras com área de corte de até 1,8 m.</strong></p>',
  html: '<p><strong>Caixa de transmissão agrícola redutora e multiplicadora,</strong> com engrenagens cônicas helicoidais, e totalmente lubrificada. Um produto 100% desenvolvido e fabricado no brasil, obedecendo as principais normas internacionais de fabricação, com tecnologia avançada e excelência em engenharia. <strong>Caixa</strong> projetada para transferir <strong>potência e rotação,</strong> oferecendo desempenho superior nos mais diversos<strong> implementos agrícolas.</strong> As <strong>engrenagens helicoidais</strong> de alta qualidade garantem operação suave, silenciosa e de alta eficiência, ideal para<strong> aplicações agrícolas</strong> que exigem robustez e confiabilidade, como <strong>roçadeiras (com área de corte de até 1,8 m).</strong></p><p><br></p><p><strong>Principais fabricantes de máquinas que utilizam esse produto:</strong> INDUSTRIAL BUSSE / IPB / ANDERMAQ / LAVRALE / MAQTRON / BUDNY / DALMOLIM / CADIOLI.</p>',
  config: '<p class="ql-align-center"><strong class="in-alerta"><u>É necessário seguir a ordem para que as demais opções sejam liberadas.</u></strong></p><p class="ql-align-justify">° Para utilizar o <strong>“MONTE SUA CAIXA”</strong> você inicia no campo <strong>“TIPO E RELAÇÃO DE TRANSMISSÃO”</strong>,</p><p class="ql-align-justify">campo este que vai decidir onde será o eixo de entrada (E) e o eixo de saída (S) e se ela será redutora ou multiplicadora;</p><p class="ql-align-justify">° Na opção sentido de giro você decidira para quais lados os eixos irão girar,</p><p class="ql-align-justify">de acordo com as opções no campo <strong>“SENTIDO DE GIRO”</strong>, e análise qual o melhor para você;</p><p class="ql-align-justify">° Nas opções de eixo X e Y você vai decidir qual o eixo se adequa mais a sua necessidade,</p><p class="ql-align-justify">avalie as opções conforme o quadro <strong>“EIXOS”</strong> e escolha a letra correspondente do campo;</p><p class="ql-align-justify">° Na opção posição de trabalho defina de que maneira a caixa será aplicada em seu implemento.</p><p class="ql-align-justify">Analise o campo <strong>“POSIÇÃO DE TRABALHO”</strong> e veja qual a melhor se encaixa de acordo com sua necessidade.</p>',
  note: 'IMPORTANTE: Fornecemos todas as peças de reposição para nossos produtos, solicite contato com comercial.',
  gallery: ['produtos/ct-145/ct-145-1.jpg', 'produtos/ct-145/ct-145-2.png', 'produtos/ct-145/ct-145-3.png'],
  table: 'produtos/ct-145/ct-145-construcao.png',
  files: [
    { name: 'Dimensões da caixa', url: 'https://controle.inpel.com.br/imagens/ProdutoPremio/DimensoesCT145.pdf' },
    {
      name: 'Características da caixa',
      url: 'https://controle.inpel.com.br/imagens/ProdutoPremio/CaracteristicasTecnicasCT145.pdf',
    },
  ],
  options: {
    'Tipo e Relação de Transmissão': ['A · Multiplicadora 1:1,92', 'B · Redutora 1,92:1', 'C · 1:1', 'D · 1:1'],
    'Sentido Giro': ['IK', 'IW', 'RK', 'RW'],
    'Eixo X': ['R'],
    'Eixo Y': ['S'],
    'Posição Trabalho': ['1', '2', '3', '4', '5'],
  },
}
