type JsonRecord = Record<string, unknown>;

type ElementorNode = {
  id?: string;
  settings?: JsonRecord;
  elements?: ElementorNode[];
  widgetType?: string;
};

type BusinessImage = {
  file: string;
  alt: string;
};

const BUSINESS_IMAGES: BusinessImage[] = [
  {
    file: 'atelie-ceramica.webp',
    alt: 'Ceramista brasileira modelando um grande vaso de terracota à mão',
  },
  {
    file: 'hotel-vereda.webp',
    alt: 'Lobby de hotel boutique aberto para um jardim tropical',
  },
  {
    file: 'bar-noturno.webp',
    alt: 'Pequeno bar de noodles iluminado durante uma noite de chuva',
  },
  {
    file: 'cosmeticos-still-life.webp',
    alt: 'Composição editorial colorida de cosméticos sem marca e grapefruit',
  },
  {
    file: 'casa-serena-wellness.webp',
    alt: 'Clínica de bem-estar serena com materiais naturais e jardim interno',
  },
  {
    file: 'floricultura-tropical.webp',
    alt: 'Florista criando um arranjo tropical exuberante e colorido',
  },
  {
    file: 'estudio-musica.webp',
    alt: 'Produtora musical trabalhando em uma mesa analógica durante a noite',
  },
  {
    file: 'restaurante-orla.webp',
    alt: 'Restaurante contemporâneo com madeira, pedra e jardim tropical ao pôr do sol',
  },
  {
    file: 'pet-daycare.webp',
    alt: 'Cachorro saltando por um arco de água em uma creche pet colorida',
  },
  {
    file: 'laboratorio-materiais.webp',
    alt: 'Pesquisadora comparando biomateriais translúcidos e compósitos reciclados',
  },
  {
    file: 'forma-boutique.webp',
    alt: 'Boutique de moda autoral com jardim interno e mobiliário escultórico',
  },
  {
    file: 'vinicola-colheita.webp',
    alt: 'Duas pessoas carregando caixas de uvas ao entardecer em um vinhedo',
  },
  {
    file: 'estudio-moda.webp',
    alt: 'Designer de moda ajustando tecido amarelo em um manequim',
  },
  {
    file: 'nexo-estudio-criativo.webp',
    alt: 'Estúdio criativo com mesa coletiva, biblioteca e vegetação interna',
  },
  {
    file: 'barbearia.webp',
    alt: 'Barbeiro realizando um corte preciso diante de espelhos verdes',
  },
  {
    file: 'movimento-rooftop.webp',
    alt: 'Grupo diverso em uma aula de movimento com tecidos coloridos no rooftop',
  },
  {
    file: 'pausa-padaria-cafe.webp',
    alt: 'Padaria artesanal e cafeteria com balcão de pães e jardim',
  },
  {
    file: 'oficina-bicicletas.webp',
    alt: 'Mecânico alinhando uma roda vermelha em uma oficina de bicicletas',
  },
];

const PHOTO_SETTING_PATTERN = /(?:image|gallery|carousel|slides)/i;
const RASTER_URL_PATTERN = /\.(?:avif|jpe?g|png|webp)(?:[?#].*)?$/i;
const PROTECTED_IMAGE_PATTERN = /(?:avatar|author|badge|brand|client|flag|icon|logo|mark|portrait|profile|rating|seal|signature|star)/i;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numericSize = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isSmallOrCircularImage = (settings: JsonRecord) => {
  const dimension = isRecord(settings.image_custom_dimension) ? settings.image_custom_dimension : null;
  const width = numericSize(dimension?.width);
  const height = numericSize(dimension?.height);
  if (width && height && Math.max(width, height) <= 180) return true;

  const radius = isRecord(settings.image_border_radius) ? settings.image_border_radius : null;
  const radiusUnit = radius?.unit;
  const radiusTop = numericSize(radius?.top);
  return radiusUnit === '%' && radiusTop !== null && radiusTop >= 50;
};

const sectionImageOffset = (sectionId: string) => {
  let hash = 0;
  for (let index = 0; index < sectionId.length; index += 1) {
    hash = (hash * 31 + sectionId.charCodeAt(index)) >>> 0;
  }
  return hash % BUSINESS_IMAGES.length;
};

const shouldReplacePhoto = (
  candidate: JsonRecord,
  settingKey: string,
  node: ElementorNode,
  settings: JsonRecord,
) => {
  const url = typeof candidate.url === 'string' ? candidate.url : '';
  if (!url || !RASTER_URL_PATTERN.test(url) || url.includes('/sections/c25/')) return false;

  const semantics = [settingKey, url, candidate.alt, candidate.title, candidate.caption]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  if (PROTECTED_IMAGE_PATTERN.test(semantics)) return false;

  return !(node.widgetType === 'image' && settingKey === 'image' && isSmallOrCircularImage(settings));
};

const applyBusinessImages = (sectionId: string, document: JsonRecord) => {
  const nodes = (document.content ?? document.elements ?? document) as ElementorNode[];
  const assetRoot = `${window.location.origin}/sections/c25/businesses`;
  let imageIndex = sectionImageOffset(sectionId);

  const nextImage = () => {
    const image = BUSINESS_IMAGES[imageIndex % BUSINESS_IMAGES.length];
    imageIndex += 1;
    return image;
  };

  const rewriteSetting = (
    value: unknown,
    settingKey: string,
    node: ElementorNode,
    settings: JsonRecord,
  ): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => rewriteSetting(item, settingKey, node, settings));
    }
    if (!isRecord(value)) return value;

    if (shouldReplacePhoto(value, settingKey, node, settings)) {
      const image = nextImage();
      return {
        ...value,
        id: 0,
        url: `${assetRoot}/${image.file}`,
        alt: image.alt,
        source: 'url',
        size: '',
      };
    }

    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        PHOTO_SETTING_PATTERN.test(nestedKey)
          ? rewriteSetting(nestedValue, nestedKey, node, settings)
          : nestedValue,
      ]),
    );
  };

  const walk = (items: ElementorNode[]) => {
    items.forEach((node) => {
      const settings = node.settings;
      if (settings) {
        node.settings = Object.fromEntries(
          Object.entries(settings).map(([key, value]) => [
            key,
            PHOTO_SETTING_PATTERN.test(key) ? rewriteSetting(value, key, node, settings) : value,
          ]),
        );
      }
      walk(node.elements ?? []);
    });
  };

  walk(nodes);
  return document;
};

const C25_CARD_CSS = `
selector .c25-project-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 24px;
  background: #171915;
  box-shadow: 0 1px 0 rgba(17, 24, 16, 0.08), 0 18px 50px rgba(17, 24, 16, 0.08);
  transition-property: transform, box-shadow;
  transition-duration: 500ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
selector .c25-project-card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(9, 15, 11, 0.02) 28%, rgba(9, 15, 11, 0.82) 100%);
  opacity: 0.86;
  transition-property: opacity;
  transition-duration: 500ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
selector .c25-project-card .elementor-widget-image,
selector .c25-project-card .elementor-widget-image .elementor-widget-container,
selector .c25-project-card .elementor-widget-image img {
  width: 100%;
  height: 100%;
}
selector .c25-project-card .elementor-widget-image img {
  display: block;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border-radius: 24px;
  outline: 1px solid oklch(0 0 0 / 0.1);
  outline-offset: -1px;
  transition-property: transform, filter;
  transition-duration: 700ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
selector .c25-project-card .elementor-widget-icon-box {
  transition-property: transform;
  transition-duration: 500ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
selector .c25-project-card .elementor-widget-icon-box-title {
  opacity: 0.76;
  transition-property: opacity;
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
selector .c25-project-card .elementor-widget-heading {
  box-shadow: 0 8px 24px rgba(9, 15, 11, 0.14);
  transition-property: transform;
  transition-duration: 400ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
selector .c25-project-card .elementor-widget-heading > .elementor-widget-container {
  transition-property: background-color;
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
@media (hover: hover) and (pointer: fine) {
  selector .c25-project-card:hover {
    transform: translateY(-10px);
    box-shadow: 0 1px 0 rgba(17, 24, 16, 0.06), 0 28px 70px rgba(17, 24, 16, 0.18);
  }
  selector .c25-project-card:hover::after {
    opacity: 1;
  }
  selector .c25-project-card:hover .elementor-widget-image img {
    transform: scale(1.06);
    filter: saturate(1.05) contrast(1.02);
  }
  selector .c25-project-card:hover .elementor-widget-icon-box {
    transform: translateY(-8px);
  }
  selector .c25-project-card:hover .elementor-widget-icon-box-title {
    opacity: 1;
  }
  selector .c25-project-card:hover .elementor-widget-heading {
    transform: rotate(-8deg) scale(1.04);
  }
  selector .c25-project-card:hover .elementor-widget-heading > .elementor-widget-container {
    background-color: #d9ff43;
  }
}
@media (prefers-reduced-motion: reduce) {
  selector .c25-project-card,
  selector .c25-project-card .elementor-widget-image img,
  selector .c25-project-card .elementor-widget-icon-box,
  selector .c25-project-card .elementor-widget-heading {
    transition-duration: 0.01ms;
  }
}
`;

const findNode = (nodes: ElementorNode[], id: string): ElementorNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.elements ?? [], id);
    if (nested) return nested;
  }
  return undefined;
};

const setSettings = (nodes: ElementorNode[], id: string, settings: JsonRecord) => {
  const node = findNode(nodes, id);
  if (node) node.settings = { ...(node.settings ?? {}), ...settings };
};

const customizeC25 = (document: JsonRecord) => {
  const nodes = (document.content ?? document.elements ?? document) as ElementorNode[];
  const assetRoot = `${window.location.origin}/sections/c25`;
  const businessAssetRoot = `${assetRoot}/businesses`;

  setSettings(nodes, '343b2e87', { background_color: '#F3F0E9', custom_css: C25_CARD_CSS });
  setSettings(nodes, '35277f12', { title: 'Negócios selecionados · 2026', title_color: '#5E685D' });
  setSettings(nodes, '211f246', { title: 'Marcas que fazem sentir antes de explicar.', title_color: '#152017' });
  setSettings(nodes, '16da2771', {
    title: 'Uma coleção editorial que alterna pessoas, cor, movimento e atmosfera para dar personalidade própria a cada negócio.',
    title_color: '#5E685D',
  });

  const cards = [
    {
      container: '44b6e3f7', image: '36a78d7b', label: '6db7f86c',
      src: `${businessAssetRoot}/atelie-ceramica.webp`,
      alt: 'Ceramista brasileira modelando um grande vaso de terracota à mão',
      eyebrow: 'FEITO À MÃO · CUNHA', title: 'Ateliê Terra Viva',
    },
    {
      container: '6f449f80', image: '9edb674', label: '7145a0fe',
      src: `${businessAssetRoot}/bar-noturno.webp`,
      alt: 'Pequeno bar de noodles iluminado durante uma noite de chuva',
      eyebrow: 'GASTRONOMIA · CENTRO', title: 'Bar da Chuva',
    },
    {
      container: '189c3af', image: '36ff4486', label: '31528a4',
      src: `${businessAssetRoot}/floricultura-tropical.webp`,
      alt: 'Florista criando um arranjo tropical exuberante e colorido',
      eyebrow: 'BOTÂNICA · RECIFE', title: 'Flora Tropical',
    },
  ];

  cards.forEach((card, index) => {
    setSettings(nodes, card.container, {
      css_classes: `c25-project-card c25-project-card--${index + 1}`,
      animation_delay: 650 + index * 120,
    });
    setSettings(nodes, card.image, {
      image: { id: 0, url: card.src, alt: card.alt, source: 'url', size: '' },
      image_custom_dimension: { width: '960', height: '1200' },
      image_border_radius: { unit: 'px', top: '24', right: '24', bottom: '24', left: '24', isLinked: true },
    });
    setSettings(nodes, card.label, {
      title_text: card.eyebrow,
      description_text: card.title,
      title_color: '#F1F4EC',
      description_color: '#FFFFFF',
    });
  });

  return document;
};

export const applyLocalSectionCustomization = (sectionId: string, raw: string): string => {
  const document = applyBusinessImages(sectionId, JSON.parse(raw) as JsonRecord);
  return JSON.stringify(sectionId === 'c25' ? customizeC25(document) : document);
};
