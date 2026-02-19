import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '@/store/connectionsStore';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Globe,
  Calendar,
  FileText,
  Plus,
  Clock3,
  Hash,
  Gauge,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

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

  const connection = connectionId ? getConnectionById(connectionId) : null;

  useEffect(() => {
    if (connectionId) {
      fetchPages();
    }
  }, [connectionId]);

  // Auto-import pages on first load if no pages exist
  useEffect(() => {
    if (connectionId && !isLoading && pages.length === 0 && connection && !isImporting) {
      console.log('No pages found, auto-importing...');
      importPages();
    }
  }, [connectionId, isLoading, pages.length, connection]);

  const fetchPages = async () => {
    if (!connectionId) return;

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

  // Busca os scores já salvos no banco para exibir inline nos cards
  const fetchCachedScores = async (pageIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('client_page_performance')
        .select('client_page_id, performance_score, fetched_at')
        .in('client_page_id', pageIds)
        .eq('strategy', 'mobile')
        .order('fetched_at', { ascending: false });

      if (error || !data) return;

      // Pega o score mais recente por página
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
      // silencioso — scores são complementares, não críticos
    }
  };

  // Roda PageSpeed em background para todas as páginas publicadas sem score
  const runBackgroundScan = async (allPages: ClientPage[]) => {
    const toScan = allPages.filter(p => p.status === 'publish' && !pageScores[p.id]);
    if (toScan.length === 0) return;

    setIsScanningInBackground(true);
    try {
      // Processa em lotes de 3 para não sobrecarregar a API
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
        // Atualiza os scores após cada lote
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
      console.log('Starting page import for connection:', connection.id);

      // Try using Edge Function first (best approach - no CORS issues)
      try {
        const { data, error } = await supabase.functions.invoke('fetch-wordpress-pages', {
          body: { connectionId: connection.id }
        });

        if (!error && data?.success) {
          console.log('Successfully imported via Edge Function:', data.imported);
          toast.success(`Successfully imported ${data.imported} page(s)`);
          await fetchPages();
          // Dispara scan automático após importar
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

      // Fallback: Direct fetch (will work if WordPress has CORS enabled)
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

        if (includeContext) {
          params.set('context', 'edit');
        }

        return params;
      };

      const fetchPage = async (page: number, includeContext: boolean) => {
        const params = buildParams(page, includeContext);
        const url = `${apiUrl}?${params.toString()}`;
        console.log('Trying direct fetch from:', url);
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
        if (Array.isArray(batch)) {
          wpPages = wpPages.concat(batch);
        }
      }

      if (!Array.isArray(wpPages) || wpPages.length === 0) {
        toast.info('No pages found in WordPress site');
        return;
      }

      // Import pages to database
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
        .upsert(pagesToInsert, {
          onConflict: 'connection_id,wordpress_page_id'
        });

      if (dbError) throw dbError;

      console.log('Successfully imported pages:', wpPages.length);
      toast.success(`Successfully imported ${wpPages.length} page(s)`);
      await fetchPages();
      // Dispara scan automático após importar (fallback direto)
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
        {
          headers: { 'Authorization': `Basic ${auth}` }
        }
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
    if (!window.confirm('Are you sure you want to remove this page from tracking?')) {
      return;
    }

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
        body: {
          pageId: page.id,
          strategy,
          forceRefresh,
        }
      });

      if (error || !data?.success || !data?.data) {
        let detailedError = error?.message || data?.error || 'Falha ao buscar PageSpeed';

        const context = (error as any)?.context;
        if (context instanceof Response) {
          try {
            const contextPayload = await context.json();
            if (contextPayload?.error) {
              detailedError = contextPayload.error;
            }
          } catch {
            // Keep the fallback message when the error response body is not JSON.
          }
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

    // Se já tem score local, pré-popula o modal imediatamente
    const localScore = pageScores[page.id];
    if (localScore) {
      setPageSpeedData({
        performance_score: localScore.performance_score,
        lcp_ms: null,
        inp_ms: null,
        tbt_ms: null,
        cls: null,
        strategy: 'mobile',
        fetched_at: localScore.fetched_at,
      });
    } else {
      setPageSpeedData(null);
    }

    setIsPageSpeedOpen(true);
    // Busca os dados completos (vai retornar do cache do banco em ms se disponível)
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
        body: {
          pageId: selectedPage.id,
          strategy: pageSpeedStrategy,
          forceRefresh,
        }
      });

      if (error || !data?.success || !data?.data) {
        let detailedError = error?.message || data?.error || 'Falha ao gerar análise IA';

        const context = (error as any)?.context;
        if (context instanceof Response) {
          try {
            const contextPayload = await context.json();
            if (contextPayload?.error) {
              detailedError = contextPayload.error;
            }
          } catch {
            // Keep fallback message.
          }
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

  const getScoreTone = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 90) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatMs = (value: number | null) => {
    if (value === null) return '-';
    if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
    return `${value} ms`;
  };

  const getImpactBadge = (impact: AnalysisAction['impact']): 'default' | 'secondary' | 'outline' => {
    switch (impact) {
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const filteredPages = pages.filter(page =>
    (page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (statusFilter === 'all' || page.status === statusFilter)
  ).sort((a, b) =>
    new Date(b.modified_date).getTime() - new Date(a.modified_date).getTime()
  );

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

  const getPageStatusLabel = (status: string) => {
    switch (status) {
      case 'publish':
        return 'Publicada';
      case 'draft':
        return 'Rascunho';
      case 'private':
        return 'Privada';
      case 'pending':
        return 'Pendente';
      default:
        return status;
    }
  };

  const getPageStatusBadge = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'publish':
        return 'default';
      case 'draft':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!connection) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Client account not found</p>
            <Button onClick={() => navigate('/client-accounts')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Client Accounts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/client-accounts')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Client Accounts
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{connection.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <a
                href={connection.base_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {connection.base_url}
              </a>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={importPages}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import Pages
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pages</p>
                <p className="text-2xl font-bold">{pages.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Published</p>
                <p className="text-2xl font-bold">
                  {pages.filter(p => p.status === 'publish').length}
                </p>
              </div>
              <Globe className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">
                  {pages.filter(p => p.status === 'draft').length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connection</p>
                <Badge variant={connection.status === 'connected' ? 'default' : 'destructive'}>
                  {connection.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.key}
                variant={statusFilter === filter.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label} ({filter.count})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pages List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading pages...</p>
          </CardContent>
        </Card>
      ) : filteredPages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma página encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {pages.length === 0
                ? 'Importe as páginas do WordPress para começar.'
                : 'Tente ajustar a busca ou o filtro de status.'}
            </p>
            {pages.length === 0 && (
              <Button onClick={importPages} disabled={isImporting}>
                <Plus className="mr-2 h-4 w-4" />
                Importar páginas agora
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredPages.map((page) => (
            <Card key={page.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight">{page.title}</CardTitle>
                    <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={getPageStatusBadge(page.status)}>
                        {getPageStatusLabel(page.status)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Hash className="h-3 w-3" />
                        ID {page.wordpress_page_id}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Slug</p>
                      <p className="font-medium truncate">/{page.slug || '-'}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Última modificação</p>
                      <p className="font-medium">
                        {new Date(page.modified_date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-md border p-3 sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">URL</p>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{page.url}</span>
                      </a>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Importada em</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(page.imported_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground mb-1">Último sync</p>
                      <p className="font-medium flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {page.last_synced
                          ? new Date(page.last_synced).toLocaleString('pt-BR')
                          : 'Ainda não sincronizada'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Score inline */}
                    {pageScores[page.id] ? (
                      <button
                        onClick={() => openPageSpeedModal(page)}
                        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm hover:bg-accent transition-colors"
                        title={`Atualizado ${new Date(pageScores[page.id].fetched_at).toLocaleString('pt-BR')}`}
                      >
                        <Gauge className="h-3 w-3 text-muted-foreground" />
                        <span className={`font-bold tabular-nums ${getScoreTone(pageScores[page.id].performance_score)}`}>
                          {pageScores[page.id].performance_score ?? '-'}
                        </span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openPageSpeedModal(page)}
                        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Gauge className="h-3 w-3" />
                        {isScanningInBackground && page.status === 'publish' ? (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Analisando...
                          </span>
                        ) : (
                          <span>Ver score</span>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={page.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncPage(page.id)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sync
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deletePage(page.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isPageSpeedOpen} onOpenChange={setIsPageSpeedOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PageSpeed - {selectedPage?.title || 'Página'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
              {isPageSpeedCached && (
                <Badge variant="outline">Cache (1h)</Badge>
              )}
              {isAnalysisCached && (
                <Badge variant="outline">IA em cache</Badge>
              )}
            </div>

            {isPageSpeedLoading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Executando análise PageSpeed...</p>
                </CardContent>
              </Card>
            ) : pageSpeedData ? (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Performance Score</p>
                      <p className={`text-4xl font-bold ${getScoreTone(pageSpeedData.performance_score)}`}>
                        {pageSpeedData.performance_score ?? '-'}
                      </p>
                    </div>
                    <Badge variant="outline">{pageSpeedData.strategy}</Badge>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Acessibilidade</p>
                      <p className={`text-2xl font-semibold ${getScoreTone(pageSpeedData.accessibility_score ?? null)}`}>
                        {pageSpeedData.accessibility_score ?? '-'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Boas práticas</p>
                      <p className={`text-2xl font-semibold ${getScoreTone(pageSpeedData.best_practices_score ?? null)}`}>
                        {pageSpeedData.best_practices_score ?? '-'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">SEO</p>
                      <p className={`text-2xl font-semibold ${getScoreTone(pageSpeedData.seo_score ?? null)}`}>
                        {pageSpeedData.seo_score ?? '-'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">LCP</p>
                      <p className="text-lg font-semibold">{formatMs(pageSpeedData.lcp_ms)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">INP</p>
                      <p className="text-lg font-semibold">{formatMs(pageSpeedData.inp_ms)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">TBT</p>
                      <p className="text-lg font-semibold">{formatMs(pageSpeedData.tbt_ms)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">CLS</p>
                      <p className="text-lg font-semibold">{pageSpeedData.cls ?? '-'}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Última coleta: {new Date(pageSpeedData.fetched_at).toLocaleString('pt-BR')}
                    </p>
                    {pageSpeedData.report_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={pageSpeedData.report_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir relatório
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {isAnalysisLoading ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Sparkles className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Gerando análise com IA...</p>
                    </CardContent>
                  </Card>
                ) : analysisData ? (
                  <div className="space-y-3">
                    <Card>
                      <CardHeader>
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
                        <CardHeader>
                          <CardTitle className="text-base">Ações priorizadas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {analysisData.priority_actions.slice(0, 5).map((action, index) => (
                            <div key={`${action.title}-${index}`} className="rounded-md border p-3 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{action.title}</p>
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
                        <CardHeader>
                          <CardTitle className="text-sm">Quick Wins</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysisData.quick_wins.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                              {analysisData.quick_wins.map((item, i) => (
                                <li key={`quick-${i}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">Sem itens.</p>
                          )}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Foco WordPress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysisData.wordpress_focus.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                              {analysisData.wordpress_focus.map((item, i) => (
                                <li key={`wp-${i}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">Sem itens.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {analysisData.risk_notes.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Riscos e cuidados</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {analysisData.risk_notes.map((item, i) => (
                              <li key={`risk-${i}`}>{item}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Clique em <span className="font-medium">Análise IA</span> para gerar um plano de melhoria com base no relatório completo.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum dado de PageSpeed disponível.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientAccountDetail;
