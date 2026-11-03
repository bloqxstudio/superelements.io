import React, { useEffect, useState } from 'react';
import { Filter, Globe2, Instagram, Megaphone, MessageCircle, ShoppingBag } from 'lucide-react';
import { SinfyMark } from './SinfyBrand';
import './AggregatorNetwork.css';

/**
 * Faixa lima da /lp: os canais soltos, como pontos de uma rede, mandando dados
 * para a Sinfy. Os pontos que correm pelas linhas são SVG (animateMotion) e só
 * existem sem movimento reduzido. Abaixo de 900px vira uma grade com a Sinfy embaixo.
 * Os números são de exemplo (Casa Lume, empresa fictícia).
 */

const W = 1200;
const H = 500;
const HUB = { x: 600, y: 430 };

const NODES = [
  { label: 'Instagram', icon: Instagram, text: 'Seguidores, alcance e mensagens', event: '+23 seguidores', x: 130, y: 80, tilt: -2 },
  { label: 'Meta Ads', icon: Megaphone, text: 'Valor usado e resultados', event: '9 resultados hoje', x: 300, y: 270, tilt: 1.5 },
  { label: 'Site', icon: Globe2, text: 'Quem está no site e de onde veio', event: '12 no site agora', x: 480, y: 70, tilt: 1 },
  { label: 'Shopify', icon: ShoppingBag, text: 'Pedidos e faturamento', event: 'Pedido de R$ 189', x: 730, y: 90, tilt: -1.5 },
  { label: 'WhatsApp', icon: MessageCircle, text: 'Conversas e aviso de lead', event: '5 mensagens novas', x: 900, y: 270, tilt: 2 },
  { label: 'CRM', icon: Filter, text: 'Leads, responsáveis e vendas', event: 'Novo lead agora', x: 1070, y: 85, tilt: -1 },
] as const;

const path = (x: number, y: number) => {
  const sy = y + 48;
  const ey = HUB.y - 34;
  return `M ${x} ${sy} C ${x} ${sy + (ey - sy) * 0.55}, ${HUB.x} ${ey - (ey - sy) * 0.45}, ${HUB.x} ${ey}`;
};

export function AggregatorNetwork() {
  const [motion, setMotion] = useState(false);
  useEffect(() => { setMotion(!window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);

  return <div className="an" aria-label="Instagram, Meta Ads, site, Shopify, WhatsApp e CRM mandando dados para a Sinfy">
    <svg className="an-lines" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {NODES.map((n, i) => <g key={n.label}>
        <path id={`an-p${i}`} d={path(n.x, n.y)} />
        {motion && [0, 1].map((k) => <circle key={k} r="4">
          <animateMotion dur={`${3.2 + (i % 3) * 0.6}s`} begin={`${i * 0.45 + k * 1.7}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".4 0 .6 1">
            <mpath href={`#an-p${i}`} />
          </animateMotion>
        </circle>)}
      </g>)}
    </svg>

    <ul className="an-nodes">{NODES.map((n, i) =>
      <li key={n.label} style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%`, '--tilt': `${n.tilt}deg`, '--delay': `${i * -0.9}s` } as React.CSSProperties}>
        <div className="an-card">
          <span className="an-ico"><n.icon aria-hidden="true" /></span>
          <div><b>{n.label}</b><span>{n.text}</span></div>
          <em>{n.event}</em>
        </div>
      </li>)}
    </ul>

    <div className="an-hub" style={{ left: `${(HUB.x / W) * 100}%`, top: `${(HUB.y / H) * 100}%` }}>
      {motion && <i className="an-hub__ring" aria-hidden="true" />}
      <SinfyMark />
      <div><b>Sinfy</b><span>Junta, lê com IA e avisa quem vende</span></div>
    </div>
  </div>;
}
