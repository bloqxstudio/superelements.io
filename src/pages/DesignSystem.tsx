import React, { useState } from 'react';
import { Bell, Check, CloudUpload, Layers3, Plus, Search, Settings, Sparkles, Trash2 } from 'lucide-react';
import { SinfyLogo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import '@/styles/product.css';
import { useSinfyTheme } from '@/lib/sinfyTheme';

// A paleta da Sinfy (brands/sinfy/DESIGN.md): grafite esverdeado, papel, lima na ação e o verde-tinta no claro
const colors = [
  ['Lima (marca e ação)', '#D2F525'], ['Grafite', '#171B19'], ['Papel', '#F1F2ED'], ['Painel', '#E4E8DC'],
  ['Texto', '#1C241F'], ['Apoio', '#61695F'], ['Verde-tinta (foco)', '#526B28'], ['Erro', '#FF453A'],
];
const type = [
  ['Título grande', 'text-[34px] font-[550] tracking-[-0.055em]', '34 / 550 / −0,055em'],
  ['Título', 'text-[22px] font-[550] tracking-[-0.035em]', '22 / 550 / −0,035em'],
  ['Corpo', 'text-[15px]', '15 / 400'],
  ['Apoio', 'text-[13px] text-gray-500', '13 / 400'],
];

const Section = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{title}</h2>
    <p className="mb-4 mt-1 text-[13px] text-gray-500">{hint}</p>
    {children}
  </section>
);

/** Design system do produto: vitrine viva dos componentes reais, sem dados de conta. */
const DesignSystem: React.FC = () => {
  useSinfyTheme();
  const [on, setOn] = useState(true);
  return (
    <TooltipProvider>
      <div className="se-product se-ds min-h-screen">
        <header className="se-glass sticky top-3 z-20 mx-auto mt-3 flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <SinfyLogo /><span className="text-gray-300" aria-hidden>/</span><strong className="text-[15px] tracking-[-0.02em]">Design System</strong>
          <Badge variant="secondary" className="ml-1">Sinfy</Badge>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-10">
          <h1 className="text-[44px] font-[550] leading-[1.04] tracking-[-0.055em] md:text-[56px]">
            Sóbrio, operacional<br />e <span className="rounded-xl bg-[#D2F525] px-2">direto.</span>
          </h1>
          <p className="mb-12 mt-4 max-w-xl text-[17px] leading-relaxed text-gray-600">
            Grafite esverdeado, papel claro e uma lima só onde a pessoa age. Conteúdo sempre sólido e legível; nada de gradiente, neon ou vidro no conteúdo.
          </p>

          <Section title="Cores" hint="Neutros esverdeados. Lima nunca é texto sobre o claro: no claro ela vira fundo, com texto grafite.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {colors.map(([n, c]) => (
                <div key={c} className="se-glass p-3"><div className="se-ds-swatch" style={{ background: c }} /><div className="mt-2 text-[13px] font-medium">{n}</div><code className="text-[12px] text-gray-500">{c}</code></div>
              ))}
            </div>
          </Section>

          <Section title="Tipografia" hint="Uma família só: Inter. Títulos em 550, apertados; o logo em 650.">
            <div className="se-glass divide-y divide-black/5">
              {type.map(([n, cls, spec]) => (
                <div key={n} className="flex items-baseline justify-between gap-4 px-5 py-4"><span className={cls}>{n}</span><code className="shrink-0 text-[12px] text-gray-500">{spec}</code></div>
              ))}
            </div>
          </Section>

          <Section title="Botões" hint="Primário em grafite, secundário em vidro claro. Altura 40 no celular, cantos 10px, pressão em 97,5%.">
            <div className="se-glass flex flex-wrap items-center gap-3 p-5">
              <Button><CloudUpload className="mr-2 h-4 w-4" />Publicar no site</Button>
              <Button variant="outline">Cancelar</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
              <Button size="icon" variant="outline" aria-label="Configurações"><Settings className="h-4 w-4" /></Button>
              <Button disabled>Desativado</Button>
            </div>
          </Section>

          <Section title="Campos e controles" hint="Entradas com sombra interna leve; foco em verde-tinta. Interruptor com mola.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="se-glass space-y-3 p-5">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Buscar projetos, páginas…" /></div>
                <Input placeholder="Nome do projeto" />
                <Textarea placeholder="Conte o que precisa mudar…" rows={3} />
              </div>
              <div className="se-glass space-y-4 p-5">
                <label className="flex items-center justify-between text-[14px]">Receber avisos no WhatsApp<Switch checked={on} onCheckedChange={setOn} /></label>
                <div className="flex flex-wrap gap-2"><Badge>Publicado</Badge><Badge variant="secondary">Rascunho</Badge><Badge variant="outline">Cliente</Badge></div>
                <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
              </div>
            </div>
          </Section>

          <Section title="Camadas flutuantes" hint="Diálogo, menu e dica: vidro com blur, sombra ambiente e cantos de 14 a 22px.">
            <div className="se-glass flex flex-wrap items-center gap-3 p-5">
              <Dialog>
                <DialogTrigger asChild><Button variant="outline"><Layers3 className="mr-2 h-4 w-4" />Abrir diálogo</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Publicar a Home?</DialogTitle><DialogDescription>A versão atual do site fica guardada. Você pode restaurar quando quiser.</DialogDescription></DialogHeader>
                  <div className="flex justify-end gap-2 pt-2"><Button variant="outline">Agora não</Button><Button><Check className="mr-2 h-4 w-4" />Publicar</Button></div>
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Novo</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Projeto</DropdownMenuItem><DropdownMenuItem>Página</DropdownMenuItem>
                  <DropdownMenuSeparator /><DropdownMenuItem>Importar do WordPress</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" aria-label="Avisos"><Bell className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Avisos</TooltipContent></Tooltip>
            </div>
            <Alert className="mt-4"><Sparkles className="h-4 w-4" /><AlertTitle>Dica</AlertTitle><AlertDescription>Use ⌘K para ir direto a qualquer área.</AlertDescription></Alert>
          </Section>

          <Section title="Princípios" hint="Regras que mantêm o produto coerente.">
            <ul className="se-glass grid gap-3 p-5 text-[14px] text-gray-700 md:grid-cols-2">
              {['Vidro só em navegação e camadas flutuantes.', 'Uma ação principal por tela; a lima marca a ação.', 'Cantos: 10 controles, 18 cards, 22 superfícies.', 'Ícones Lucide com traço de 1,6.', 'Transições de 160 ms em cor e sombra, sem mover layout.', 'Transparência reduzida troca o vidro por superfície sólida.'].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t}</li>
              ))}
            </ul>
          </Section>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default DesignSystem;
