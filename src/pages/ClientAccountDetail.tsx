import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { supabase } from '@/integrations/supabase/client';
import {
  OUSEN_CLIENT_PAGES,
  OUSEN_PAGE_PERFORMANCE,
  OUSEN_CONNECTIONS,
} from '@/mocks/ousenWorkspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Globe,
  FileText,
  Plus,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import OptimizedDynamicIframe from '@/features/components/OptimizedDynamicIframe';
import '@/components/ui/component-grid.css';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ClientPage {
  id: string;
  connection_id: string;
  wordpress_page_id: number;
  title: string;
  slug: string;
  url: string;
  status: string;
  modified_date: string;
  imported_at: string;
  last_synced: string | null;
}

interface PageScoreCache {
  [pageId: string]: {
    performance_score: number | null;
    fetched_at: string;
  };
}

interface PageSpeedData {
  performance_score: number | null;
  accessibility_score?: number | null;
  best_practices_score?: number | null;
  seo_score?: number | null;
  lcp_ms: number | null;
  inp_ms: number | null;
  tbt_ms: number | null;
  cls: number | null;
  strategy: 'mobile' | 'desktop';
  fetched_at: string;
  report_url?: string | null;
}

interface AnalysisAction {
  title: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  category: 'performance' | 'accessibility' | 'best_practices' | 'seo' | 'general';
  expected_result: string;
  why: string;
  evidence_audit_ids: string[];
  implementation_steps: string[];
}

interface RecommendationData {
  id: string;
  strategy: 'mobile' | 'desktop';
  summary: string;
  priority_actions: AnalysisAction[];
  quick_wins: string[];
  wordpress_focus: string[];
  risk_notes: string[];
  generated_at: string;
  model?: string | null;
}

interface PageCardProps {
  page: ClientPage;
  score: PageScoreCache[string] | undefined;
  isScanningBackground: boolean;
  isMock?: boolean;
  onPageSpeed: (page: ClientPage) => void;
  onSync: (pageId: string) => void;
  onDelete: (pageId: string) => void;
}

// ─── Mock Page Preview ────────────────────────────────────────────────────────
// Renders a static visual preview for mock law firm pages (no real iframe).

const MOCK_PREVIEW_THEMES: Record<string, { accent: string; bg: string; navBg: string }> = {
  'conn-joao-adv':             { accent: '#1e3a5f', bg: '#f0f4f8', navBg: '#1e3a5f' },
  'conn-silva-escritorio':     { accent: '#2d4a22', bg: '#f4f7f0', navBg: '#2d4a22' },
  'conn-torres-advocacia':     { accent: '#3b1f1f', bg: '#faf4f4', navBg: '#3b1f1f' },
  'conn-camila-mendes':        { accent: '#4a2c6e', bg: '#f7f3fb', navBg: '#4a2c6e' },
  'conn-ramos-previdenciario': { accent: '#1a3d52', bg: '#f0f6fa', navBg: '#1a3d52' },
  'conn-lima-tributario':      { accent: '#3d3000', bg: '#faf8f0', navBg: '#3d3000' },
  'conn-ferreira-familia':     { accent: '#1f3f5a', bg: '#f0f5fa', navBg: '#1f3f5a' },
  'conn-barbosa-trabalhista':  { accent: '#3d1a00', bg: '#faf5f0', navBg: '#3d1a00' },
};

const PAGE_CONTENT_MAP: Record<string, { hero: string; body: string[]; section: string }> = {
  home:                    { hero: 'Advocacia especializada com excelência e ética',        body: ['Atendimento personalizado', 'Mais de 15 anos de experiência', 'Resultados comprovados'],                                                              section: 'Nossas Áreas de Atuação' },
  'areas-de-atuacao':      { hero: 'Áreas de Atuação',                                      body: ['Direito Civil', 'Direito Trabalhista', 'Direito de Família', 'Planejamento Patrimonial'],                                                             section: 'Como Podemos Ajudar' },
  sobre:                   { hero: 'Sobre o Escritório',                                     body: ['Fundado em 2009', 'Equipe multidisciplinar', 'Atuação em todo território nacional'],                                                                  section: 'Nossa Equipe' },
  blog:                    { hero: 'Blog Jurídico',                                          body: ['Como funciona a aposentadoria por invalidez', 'Direitos do trabalhador em 2024', 'Planejamento sucessório: o que você precisa saber'],                section: 'Artigos Recentes' },
  contato:                 { hero: 'Entre em Contato',                                       body: ['Atendimento de segunda a sexta', '(11) 3000-0000', 'contato@escritorio.adv.br'],                                                                    section: 'Localização' },
  'direito-criminal':      { hero: 'Direito Criminal',                                       body: ['Defesa em inquéritos policiais', 'Habeas corpus e liberdade provisória', 'Recursos em instâncias superiores'],                                       section: 'Casos Atendidos' },
  'habeas-corpus':         { hero: 'Habeas Corpus',                                          body: ['Análise do caso em 24h', 'Experiência em instâncias superiores', 'Atendimento emergencial'],                                                         section: 'Como Funciona' },
  divorcio:                { hero: 'Divórcio Consensual e Litigioso',                        body: ['Divórcio extrajudicial em cartório', 'Partilha de bens', 'Guarda e alimentos'],                                                                     section: 'Etapas do Processo' },
  'guarda-de-filhos':      { hero: 'Guarda de Filhos',                                       body: ['Guarda compartilhada', 'Regulamentação de visitas', 'Revisão de acordos'],                                                                          section: 'Tipos de Guarda' },
  'aposentadoria-invalidez': { hero: 'Aposentadoria por Invalidez',                          body: ['Análise do histórico previdenciário', 'Recurso contra indeferimento', 'Cálculo de benefícios'],                                                     section: 'Documentos Necessários' },
};

const MockPagePreview: React.FC<{ page: ClientPage }> = ({ page }) => {
  const theme = MOCK_PREVIEW_THEMES[page.connection_id] ?? { accent: '#1e3a5f', bg: '#f0f4f8', navBg: '#1e3a5f' };
  const content = PAGE_CONTENT_MAP[page.slug] ?? {
    hero: page.title,
    body: ['Informações sobre ' + page.title, 'Consulte nossos especialistas', 'Atendimento personalizado'],
    section: 'Saiba Mais',
  };

  return (
    <div className="w-full h-full flex flex-col text-[8px] leading-tight overflow-hidden select-none" style={{ background: theme.bg }}>
      {/* Nav */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0" style={{ background: theme.navBg }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full bg-white/30" />
          <div className="w-10 h-1.5 rounded bg-white/60" />
        </div>
        <div className="flex gap-2">
          {['Início', 'Áreas', 'Sobre', 'Contato'].map((label) => (
            <div key={label} className="text-[6px] text-white/70 font-medium">{label}</div>
          ))}
        </div>
        <div className="rounded px-1.5 py-0.5 text-[6px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.2)' }}>
          Consulta grátis
        </div>
      </div>

      {/* Hero */}
      <div className="px-3 py-2 flex-shrink-0 flex flex-col items-start gap-1" style={{ background: theme.accent }}>
        <div className="text-[8px] font-bold text-white leading-tight max-w-[80%]">{content.hero}</div>
        <div className="w-14 h-1 rounded-full mt-0.5" style={{ background: 'rgba(255,255,255,0.35)' }} />
        <div className="rounded px-1.5 py-0.5 text-[6px] font-bold text-white mt-1" style={{ background: 'rgba(255,255,255,0.25)' }}>
          Fale conosco →
        </div>
      </div>

      {/* Body bullets */}
      <div className="px-3 py-1.5 flex flex-col gap-1 flex-shrink-0">
        <div className="text-[7px] font-semibold mb-0.5" style={{ color: theme.accent }}>{content.section}</div>
        {content.body.map((item, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="w-1 h-1 rounded-full mt-0.5 flex-shrink-0" style={{ background: theme.accent }} />
            <div className="text-[7px] text-gray-600 leading-snug">{item}</div>
          </div>
        ))}
      </div>

      {/* Cards row */}
      <div className="px-3 pb-1.5 flex gap-1.5 flex-shrink-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 rounded-lg border border-gray-200 bg-white p-1.5 flex flex-col gap-0.5">
            <div className="w-4 h-4 rounded-md" style={{ background: theme.accent + '20' }} />
            <div className="w-8 h-1 rounded bg-gray-200 mt-0.5" />
            <div className="w-10 h-0.5 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Footer strip */}
      <div className="mt-auto px-3 py-1 flex items-center justify-between flex-shrink-0" style={{ background: theme.navBg + 'cc' }}>
        <div className="text-[5.5px] text-white/50">© 2024 — Escritório de Advocacia</div>
        <div className="text-[5.5px] text-white/50">{page.url.replace('https://', '').replace(/\/$/, '')}</div>
      </div>
    </div>
  );
};

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const cardContainerVariants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const sectionClass = 'rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

const getScoreTone = (score: number | null) => {
  if (score === null) return 'text-muted-foreground';
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBg = (score: number | null) => {
  if (score === null) return 'bg-white/90';
  if (score >= 90) return 'bg-green-50/95';
  if (score >= 50) return 'bg-yellow-50/95';
  return 'bg-red-50/95';
};

const formatMs = (value: number | null) => {
  if (value === null) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value} ms`;
};

const getPageStatusLabel = (status: string) => {
  switch (status) {
    case 'publish': return 'Publicada';
    case 'draft': return 'Rascunho';
    case 'private': return 'Privada';
    case 'pending': return 'Pendente';
    default: return status;
  }
};

const getPageStatusBadge = (status: string): 'default' | 'secondary' | 'outline' => {
  switch (status) {
    case 'publish': return 'default';
    case 'draft': return 'secondary';
    default: return 'outline';
  }
};

const getImpactBadge = (impact: AnalysisAction['impact']): 'default' | 'secondary' | 'outline' => {
  switch (impact) {
    case 'high': return 'default';
    case 'medium': return 'secondary';
    default: return 'outline';
  }
};

// ─── PageCard component ───────────────────────────────────────────────────────

const PageCard = React.memo(({
  page,
  score,
  isScanningBackground,
  isMock = false,
  onPageSpeed,
  onSync,
  onDelete,
}: PageCardProps) => {
  const hasPreview = page.status === 'publish' && !!page.url;

  return (
    <div className="group rounded-2xl border border-gray-200/70 bg-white shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
      {/* Preview area */}
      <div className="aspect-[16/9] relative overflow-hidden bg-gray-50 flex-shrink-0">
        {isMock && hasPreview ? (
          <MockPagePreview page={page} />
        ) : hasPreview ? (
          <OptimizedDynamicIframe url={page.url} title={page.title} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <FileText className="h-8 w-8 text-gray-300" />
            <p className="text-xs text-muted-foreground capitalize">{getPageStatusLabel(page.status)}</p>
          </div>
        )}

        {/* Status badge — top left */}
        <div className="absolute top-2 left-2 z-10">
          <Badge variant={getPageStatusBadge(page.status)} className="text-[10px] px-1.5 py-0.5">
            {getPageStatusLabel(page.status)}
          </Badge>
        </div>

        {/* Score badge — top right */}
        <div className="absolute top-2 right-2 z-10">
          {score ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm ${getScoreBg(score.performance_score)} ${getScoreTone(score.performance_score)}`}
            >
              <Gauge className="h-3 w-3" />
              {score.performance_score ?? '-'}
            </span>
          ) : isScanningBackground && page.status === 'publish' ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-white/90 shadow-sm text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
            </span>
          ) : null}
        </div>

        {/* Hover actions — bottom right */}
        <div className="absolute bottom-2 right-2 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onPageSpeed(page); }}
            className="h-7 w-7 rounded-lg bg-white/95 shadow-sm border border-gray-200/80 flex items-center justify-center hover:bg-white transition-colors"
            title="Ver performance"
          >
            <Gauge className="h-3.5 w-3.5 text-gray-700" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSync(page.id); }}
            className="h-7 w-7 rounded-lg bg-white/95 shadow-sm border border-gray-200/80 flex items-center justify-center hover:bg-white transition-colors"
            title="Sincronizar"
          >
            <RefreshCw className="h-3.5 w-3.5 text-gray-700" />
          </button>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-7 rounded-lg bg-white/95 shadow-sm border border-gray-200/80 flex items-center justify-center hover:bg-white transition-colors"
            title="Abrir página"
          >
            <ExternalLink className="h-3.5 w-3.5 text-gray-700" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
            className="h-7 w-7 rounded-lg bg-white/95 shadow-sm border border-gray-200/80 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
            title="Remover"
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
          </button>
        </div>
      </div>

      {/* Info footer */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{page.title}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-muted-foreground truncate">/{page.slug || '—'}</p>
          <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {getRelativeTime(page.modified_date)}
          </p>
        </div>
      </div>
    </div>
  );
});

PageCard.displayName = 'PageCard';

// ─── Main component ───────────────────────────────────────────────────────────

const ClientAccountDetail = () => {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { getConnectionById } = useConnectionsStore();

  const [pages, setPages] = useState<ClientPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPageSpeedOpen, setIsPageSpeedOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<ClientPage | null>(null);
  const [pageSpeedStrategy, setPageSpeedStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [isPageSpeedLoading, setIsPageSpeedLoading] = useState(false);
  const [pageSpeedData, setPageSpeedData] = useState<PageSpeedData | null>(null);
  const [isPageSpeedCached, setIsPageSpeedCached] = useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<RecommendationData | null>(null);
  const [isAnalysisCached, setIsAnalysisCached] = useState(false);
  const [pageScores, setPageScores] = useState<PageScoreCache>({});
  const [isScanningInBackground, setIsScanningInBackground] = useState(false);

  // Detect mock connection by checking if it belongs to OUSEN_CONNECTIONS
  const isMockConnection = connectionId
    ? OUSEN_CONNECTIONS.some((c) => c.id === connectionId)
    : false;

  // For mock connections, resolve from the mock list directly (store may not be populated yet)
  const connection = connectionId
    ? (isMockConnection
        ? OUSEN_CONNECTIONS.find((c) => c.id === connectionId) ?? null
        : getConnectionById(connectionId))
    : null;

  useEffect(() => {
    if (connectionId) {
      fetchPages();
    }
  }, [connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Don't auto-import for mock connections
    if (isMockConnection) return;
    if (connectionId && !isLoading && pages.length === 0 && connection && !isImporting) {
      importPages();
    }
  }, [connectionId, isLoading, pages.length, connection]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPages = async () => {
    if (!connectionId) return;

    // Mock: serve pages directly from the mock file
    if (isMockConnection) {
      const mockPages = OUSEN_CLIENT_PAGES.filter((p) => p.connection_id === connectionId);
      setPages(mockPages as ClientPage[]);
      // Load mock scores
      const scores: PageScoreCache = {};
      for (const perf of OUSEN_PAGE_PERFORMANCE) {
        if (mockPages.some((p) => p.id === perf.client_page_id)) {
          scores[perf.client_page_id] = {
            performance_score: perf.performance_score,
            fetched_at: perf.analyzed_at,
          };
        }
      }
      setPageScores(scores);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_pages')
        .select('*')
        .eq('connection_id', connectionId)
        .order('imported_at', { ascending: false });
      if (error) throw error;
      const loaded = data || [];
      setPages(loaded);
      if (loaded.length > 0) {
        fetchCachedScores(loaded.map(p => p.id));
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to load pages');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCachedScores = async (pageIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('client_page_performance')
        .select('client_page_id, performance_score, fetched_at')
        .in('client_page_id', pageIds)
        .eq('strategy', 'mobile')
        .order('fetched_at', { ascending: false });
      if (error || !data) return;
      const scores: PageScoreCache = {};
      for (const row of data) {
        if (!scores[row.client_page_id]) {
          scores[row.client_page_id] = {
            performance_score: row.performance_score,
            fetched_at: row.fetched_at,
          };
        }
      }
      setPageScores(scores);
    } catch {
      // silencioso
    }
  };

  const runBackgroundScan = async (allPages: ClientPage[]) => {
    const toScan = allPages.filter(p => p.status === 'publish' && !pageScores[p.id]);
    if (toScan.length === 0) return;
    setIsScanningInBackground(true);
    try {
      const batchSize = 3;
      for (let i = 0; i < toScan.length; i += batchSize) {
        const batch = toScan.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(page =>
            supabase.functions.invoke('get-pagespeed', {
              body: { pageId: page.id, strategy: 'mobile', forceRefresh: false }
            })
          )
        );
        await fetchCachedScores(allPages.map(p => p.id));
      }
    } finally {
      setIsScanningInBackground(false);
    }
  };

  const importPages = async () => {
    if (!connection) {
      toast.error('Connection not found');
      return;
    }
    setIsImporting(true);
    try {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-wordpress-pages', {
          body: { connectionId: connection.id }
        });
        if (!error && data?.success) {
          toast.success(`Successfully imported ${data.imported} page(s)`);
          await fetchPages();
          const { data: freshPages } = await supabase
            .from('client_pages')
            .select('*')
            .eq('connection_id', connection.id);
          if (freshPages?.length) runBackgroundScan(freshPages as ClientPage[]);
          return;
        }
        console.warn('Edge Function not available or failed, trying direct fetch...', error);
      } catch (edgeFunctionError) {
        console.warn('Edge Function error:', edgeFunctionError);
      }

      if (!connection.credentials) {
        toast.error('Connection credentials not found');
        return;
      }

      const baseUrl = connection.base_url.replace(/\/$/, '');
      const apiUrl = `${baseUrl}/wp-json/wp/v2/pages`;
      const auth = btoa(`${connection.credentials.username}:${connection.credentials.application_password}`);
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      };

      const buildParams = (page: number, includeContext: boolean) => {
        const params = new URLSearchParams({
          per_page: '100',
          page: String(page),
          _fields: 'id,title,slug,link,status,modified',
        });
        if (includeContext) params.set('context', 'edit');
        return params;
      };

      const fetchPage = async (page: number, includeContext: boolean) => {
        const params = buildParams(page, includeContext);
        const url = `${apiUrl}?${params.toString()}`;
        return fetch(url, { method: 'GET', headers });
      };

      let includeContext = true;
      let firstResponse = await fetchPage(1, includeContext);

      if (!firstResponse.ok && [400, 401, 403].includes(firstResponse.status)) {
        const body = await firstResponse.text();
        console.warn(`WordPress returned ${firstResponse.status} with context=edit, retrying without context:`, body);
        includeContext = false;
        firstResponse = await fetchPage(1, includeContext);
      }

      if (!firstResponse.ok) {
        throw new Error(`WordPress API returned ${firstResponse.status}: ${firstResponse.statusText}`);
      }

      const firstBatch = await firstResponse.json();
      const totalPages = Number(firstResponse.headers.get('X-WP-TotalPages') || '1');
      let wpPages = Array.isArray(firstBatch) ? firstBatch : [];

      for (let page = 2; page <= totalPages; page++) {
        const response = await fetchPage(page, includeContext);
        if (!response.ok) {
          throw new Error(`WordPress API returned ${response.status}: ${response.statusText}`);
        }
        const batch = await response.json();
        if (Array.isArray(batch)) wpPages = wpPages.concat(batch);
      }

      if (!Array.isArray(wpPages) || wpPages.length === 0) {
        toast.info('No pages found in WordPress site');
        return;
      }

      const pagesToInsert = wpPages.map((page: any) => ({
        connection_id: connectionId,
        wordpress_page_id: page.id,
        title: page.title?.rendered || page.title || 'Untitled',
        slug: page.slug || '',
        url: page.link || '',
        status: page.status || 'draft',
        modified_date: page.modified || new Date().toISOString(),
      }));

      const { error: dbError } = await supabase
        .from('client_pages')
        .upsert(pagesToInsert, { onConflict: 'connection_id,wordpress_page_id' });

      if (dbError) throw dbError;

      toast.success(`Successfully imported ${wpPages.length} page(s)`);
      await fetchPages();
      const { data: freshPages } = await supabase
        .from('client_pages')
        .select('*')
        .eq('connection_id', connectionId);
      if (freshPages?.length) runBackgroundScan(freshPages as ClientPage[]);
    } catch (error: any) {
      console.error('Error importing pages:', error);
      let errorMessage = 'Failed to import pages';
      if (error.message?.includes('CORS') || error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'CORS error: Please deploy the Supabase Edge Function or enable CORS on the WordPress site';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  const syncPage = async (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page || !connection?.credentials) return;
    try {
      const auth = btoa(`${connection.credentials.username}:${connection.credentials.application_password}`);
      const response = await fetch(
        `${connection.base_url}/wp-json/wp/v2/pages/${page.wordpress_page_id}`,
        { headers: { 'Authorization': `Basic ${auth}` } }
      );
      if (!response.ok) throw new Error('Failed to sync page');
      const wpPage = await response.json();
      const { error } = await supabase
        .from('client_pages')
        .update({
          title: wpPage.title.rendered,
          status: wpPage.status,
          modified_date: wpPage.modified,
          last_synced: new Date().toISOString()
        })
        .eq('id', pageId);
      if (error) throw error;
      toast.success('Page synced successfully');
      fetchPages();
    } catch (error) {
      console.error('Error syncing page:', error);
      toast.error('Failed to sync page');
    }
  };

  const deletePage = async (pageId: string) => {
    if (!window.confirm('Are you sure you want to remove this page from tracking?')) return;
    try {
      const { error } = await supabase
        .from('client_pages')
        .delete()
        .eq('id', pageId);
      if (error) throw error;
      toast.success('Page removed from tracking');
      fetchPages();
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error('Failed to remove page');
    }
  };

  const fetchPageSpeed = async (page: ClientPage, strategy: 'mobile' | 'desktop', forceRefresh = false) => {
    setIsPageSpeedLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-pagespeed', {
        body: { pageId: page.id, strategy, forceRefresh }
      });
      if (error || !data?.success || !data?.data) {
        let detailedError = error?.message || data?.error || 'Falha ao buscar PageSpeed';
        const context = (error as any)?.context;
        if (context instanceof Response) {
          try {
            const contextPayload = await context.json();
            if (contextPayload?.error) detailedError = contextPayload.error;
          } catch { /* keep fallback */ }
        }
        throw new Error(detailedError);
      }
      setIsPageSpeedCached(Boolean(data.cached));
      setPageSpeedData(data.data as PageSpeedData);
    } catch (error) {
      console.error('Error fetching PageSpeed:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao buscar PageSpeed');
    } finally {
      setIsPageSpeedLoading(false);
    }
  };

  const openPageSpeedModal = async (page: ClientPage) => {
    setSelectedPage(page);
    setAnalysisData(null);
    setIsAnalysisCached(false);
    setPageSpeedStrategy('mobile');

    // Mock: serve performance data directly from mock file
    if (isMockConnection) {
      const mockPerf = OUSEN_PAGE_PERFORMANCE.find(
        (p) => p.client_page_id === page.id && p.strategy === 'desktop'
      ) ?? OUSEN_PAGE_PERFORMANCE.find((p) => p.client_page_id === page.id);
      if (mockPerf) {
        setPageSpeedData({
          performance_score: mockPerf.performance_score,
          lcp_ms: mockPerf.lcp_ms,
          inp_ms: mockPerf.inp_ms,
          tbt_ms: mockPerf.tbt_ms,
          cls: mockPerf.cls,
          strategy: mockPerf.strategy,
          fetched_at: mockPerf.analyzed_at,
        });
      } else {
        setPageSpeedData(null);
      }
      setIsPageSpeedOpen(true);
      return;
    }

    const localScore = pageScores[page.id];
    if (localScore) {
      setPageSpeedData({
        performance_score: localScore.performance_score,
        lcp_ms: null, inp_ms: null, tbt_ms: null, cls: null,
        strategy: 'mobile',
        fetched_at: localScore.fetched_at,
      });
    } else {
      setPageSpeedData(null);
    }
    setIsPageSpeedOpen(true);
    await fetchPageSpeed(page, 'mobile');
  };

  const fetchAiAnalysis = async (forceRefresh = false) => {
    if (!selectedPage) {
      toast.error('Selecione uma página para gerar análise');
      return;
    }
    setIsAnalysisLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-pagespeed-report', {
        body: { pageId: selectedPage.id, strategy: pageSpeedStrategy, forceRefresh }
      });
      if (error || !data?.success || !data?.data) {
        let detailedError = error?.message || data?.error || 'Falha ao gerar análise IA';
        const context = (error as any)?.context;
        if (context instanceof Response) {
          try {
            const contextPayload = await context.json();
            if (contextPayload?.error) detailedError = contextPayload.error;
          } catch { /* keep fallback */ }
        }
        throw new Error(detailedError);
      }
      const normalized: RecommendationData = {
        ...data.data,
        priority_actions: Array.isArray(data.data.priority_actions) ? data.data.priority_actions : [],
        quick_wins: Array.isArray(data.data.quick_wins) ? data.data.quick_wins : [],
        wordpress_focus: Array.isArray(data.data.wordpress_focus) ? data.data.wordpress_focus : [],
        risk_notes: Array.isArray(data.data.risk_notes) ? data.data.risk_notes : [],
      };
      setAnalysisData(normalized);
      setIsAnalysisCached(Boolean(data.cached));
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar análise IA');
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const filteredPages = pages
    .filter(page =>
      (page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.slug.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' || page.status === statusFilter)
    )
    .sort((a, b) => new Date(b.modified_date).getTime() - new Date(a.modified_date).getTime());

  const statusCounts = pages.reduce<Record<string, number>>((acc, page) => {
    acc[page.status] = (acc[page.status] || 0) + 1;
    return acc;
  }, {});

  const statusFilters = [
    { key: 'all', label: 'Todas', count: pages.length },
    { key: 'publish', label: 'Publicadas', count: statusCounts.publish || 0 },
    { key: 'draft', label: 'Rascunhos', count: statusCounts.draft || 0 },
    { key: 'private', label: 'Privadas', count: statusCounts.private || 0 },
  ];

  if (!connection) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Cliente não encontrado</p>
          <Button onClick={() => navigate('/client-accounts')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-7xl space-y-6"
        variants={containerVariants}
        initial={false}
        animate="show"
      >
        {/* ── Header ── */}
        <motion.section variants={itemVariants} className={sectionClass}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/client-accounts')}
                className="-ml-2 mt-0.5"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{connection.name}</h1>
                  <Badge variant={connection.status === 'connected' ? 'default' : 'destructive'} className="capitalize">
                    {connection.status === 'connected' ? 'Conectado' : connection.status}
                  </Badge>
                </div>
                <a
                  href={connection.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {connection.base_url}
                  <ExternalLink className="h-3 w-3" />
                </a>

                {/* Compact stats */}
                {!isLoading && pages.length > 0 && (
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-gray-900">{pages.length}</span> páginas
                    </span>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-green-600">{statusCounts.publish || 0}</span> publicadas
                    </span>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-gray-600">{statusCounts.draft || 0}</span> rascunhos
                    </span>
                    {isScanningInBackground && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                        </span>
                        Analisando performance...
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!isMockConnection && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={importPages}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Importar páginas
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Search + Filters ── */}
        <motion.section variants={itemVariants} className={sectionClass}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === filter.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    statusFilter === filter.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Page Grid ── */}
        <motion.section variants={itemVariants}>
          {isLoading ? (
            <div className="component-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-gray-200/70 bg-white">
                  <Skeleton className="aspect-[16/9] w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPages.length === 0 ? (
            <div className={`${sectionClass} text-center py-16`}>
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {pages.length === 0 ? 'Nenhuma página importada' : 'Nenhuma página encontrada'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                {pages.length === 0
                  ? 'Importe as páginas do WordPress para começar a gerenciar e monitorar.'
                  : 'Tente ajustar a busca ou o filtro de status.'}
              </p>
              {pages.length === 0 && (
                <Button onClick={importPages} disabled={isImporting}>
                  <Plus className="mr-2 h-4 w-4" />
                  Importar páginas agora
                </Button>
              )}
            </div>
          ) : (
            <motion.div
              className="component-grid"
              variants={cardContainerVariants}
              initial="hidden"
              animate="show"
            >
              {filteredPages.map((page) => (
                <motion.div key={page.id} variants={cardItemVariants}>
                  <PageCard
                    page={page}
                    score={pageScores[page.id]}
                    isScanningBackground={isScanningInBackground}
                    isMock={isMockConnection}
                    onPageSpeed={openPageSpeedModal}
                    onSync={syncPage}
                    onDelete={deletePage}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.section>
      </motion.div>

      {/* ── PageSpeed Modal ── */}
      <Dialog open={isPageSpeedOpen} onOpenChange={setIsPageSpeedOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              PageSpeed — {selectedPage?.title || 'Página'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Strategy + actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={pageSpeedStrategy === 'mobile' ? 'default' : 'outline'}
                onClick={() => {
                  if (!selectedPage) return;
                  setPageSpeedStrategy('mobile');
                  setAnalysisData(null);
                  setIsAnalysisCached(false);
                  fetchPageSpeed(selectedPage, 'mobile');
                }}
                disabled={isPageSpeedLoading}
              >
                Mobile
              </Button>
              <Button
                size="sm"
                variant={pageSpeedStrategy === 'desktop' ? 'default' : 'outline'}
                onClick={() => {
                  if (!selectedPage) return;
                  setPageSpeedStrategy('desktop');
                  setAnalysisData(null);
                  setIsAnalysisCached(false);
                  fetchPageSpeed(selectedPage, 'desktop');
                }}
                disabled={isPageSpeedLoading}
              >
                Desktop
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!selectedPage) return;
                  fetchPageSpeed(selectedPage, pageSpeedStrategy, true);
                  setAnalysisData(null);
                  setIsAnalysisCached(false);
                }}
                disabled={isPageSpeedLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isPageSpeedLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchAiAnalysis(false)}
                disabled={isAnalysisLoading || isPageSpeedLoading || !pageSpeedData}
              >
                <Sparkles className={`h-3 w-3 mr-1 ${isAnalysisLoading ? 'animate-spin' : ''}`} />
                Análise IA
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchAiAnalysis(true)}
                disabled={isAnalysisLoading || isPageSpeedLoading || !pageSpeedData}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isAnalysisLoading ? 'animate-spin' : ''}`} />
                Regerar IA
              </Button>
              {isPageSpeedCached && <Badge variant="outline">Cache (1h)</Badge>}
              {isAnalysisCached && <Badge variant="outline">IA em cache</Badge>}
            </div>

            {isPageSpeedLoading ? (
              <div className="py-10 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Executando análise PageSpeed...</p>
              </div>
            ) : pageSpeedData ? (
              <div className="space-y-4">
                {/* Main score */}
                <div className="rounded-2xl border border-gray-200/70 bg-gray-50 p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Performance Score</p>
                    <p className={`text-5xl font-bold tabular-nums ${getScoreTone(pageSpeedData.performance_score)}`}>
                      {pageSpeedData.performance_score ?? '-'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(pageSpeedData.fetched_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="capitalize">{pageSpeedData.strategy}</Badge>
                    {pageSpeedData.report_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={pageSpeedData.report_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Relatório
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Category scores */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Acessibilidade', value: pageSpeedData.accessibility_score ?? null },
                    { label: 'Boas práticas', value: pageSpeedData.best_practices_score ?? null },
                    { label: 'SEO', value: pageSpeedData.seo_score ?? null },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-gray-200/70 bg-white p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className={`text-2xl font-bold ${getScoreTone(value)}`}>{value ?? '-'}</p>
                    </div>
                  ))}
                </div>

                {/* Core Web Vitals */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'LCP', value: formatMs(pageSpeedData.lcp_ms) },
                    { label: 'INP', value: formatMs(pageSpeedData.inp_ms) },
                    { label: 'TBT', value: formatMs(pageSpeedData.tbt_ms) },
                    { label: 'CLS', value: pageSpeedData.cls ?? '-' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-gray-200/70 bg-white p-4">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-lg font-semibold">{String(value)}</p>
                    </div>
                  ))}
                </div>

                {/* AI Analysis */}
                {isAnalysisLoading ? (
                  <div className="py-8 text-center">
                    <Sparkles className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Gerando análise com IA...</p>
                  </div>
                ) : analysisData ? (
                  <div className="space-y-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Diagnóstico IA</CardTitle>
                        <CardDescription>
                          Gerado em {new Date(analysisData.generated_at).toLocaleString('pt-BR')}
                          {analysisData.model ? ` • ${analysisData.model}` : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{analysisData.summary}</p>
                      </CardContent>
                    </Card>

                    {analysisData.priority_actions.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Ações priorizadas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {analysisData.priority_actions.slice(0, 5).map((action, index) => (
                            <div key={`${action.title}-${index}`} className="rounded-lg border p-3 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm">{action.title}</p>
                                <Badge variant={getImpactBadge(action.impact)}>Impacto {action.impact}</Badge>
                                <Badge variant="outline">Esforço {action.effort}</Badge>
                                <Badge variant="outline">{action.category}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{action.why}</p>
                              <p className="text-sm"><span className="font-medium">Resultado esperado:</span> {action.expected_result}</p>
                              {action.implementation_steps?.length > 0 && (
                                <div className="text-sm">
                                  <p className="font-medium mb-1">Passos:</p>
                                  <ul className="list-disc pl-5 space-y-1">
                                    {action.implementation_steps.slice(0, 4).map((step, i) => (
                                      <li key={`${action.title}-step-${i}`}>{step}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Wins</CardTitle></CardHeader>
                        <CardContent>
                          {analysisData.quick_wins.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                              {analysisData.quick_wins.map((item, i) => <li key={`quick-${i}`}>{item}</li>)}
                            </ul>
                          ) : <p className="text-sm text-muted-foreground">Sem itens.</p>}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Foco WordPress</CardTitle></CardHeader>
                        <CardContent>
                          {analysisData.wordpress_focus.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                              {analysisData.wordpress_focus.map((item, i) => <li key={`wp-${i}`}>{item}</li>)}
                            </ul>
                          ) : <p className="text-sm text-muted-foreground">Sem itens.</p>}
                        </CardContent>
                      </Card>
                    </div>

                    {analysisData.risk_notes.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Riscos e cuidados</CardTitle></CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {analysisData.risk_notes.map((item, i) => <li key={`risk-${i}`}>{item}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200/70 bg-gray-50 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Clique em <span className="font-medium">Análise IA</span> para gerar um plano de melhoria com base no relatório completo.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum dado de PageSpeed disponível.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientAccountDetail;
