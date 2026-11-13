import { Suspense } from 'react';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MediaViewer } from "@/components/MediaViewer";
import Layout from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CrmGate } from "@/features/crm/CrmGate";
import { comesFromAdsLink, comesFromLink } from "@/features/crm/connectLinks";
import { lazyNamed, lazyPage } from "@/lib/lazyPage";
import type { LandingTemplate } from "@/features/space/landingTemplates";

// Cada tela é um arquivo JS próprio, baixado quando a rota abre (antes o app inteiro, 5,5 MB, vinha na
// primeira tela, inclusive nos links públicos de formulário e aprovação). Ver `src/lib/lazyPage.ts`.
const Auth = lazyPage(() => import("@/pages/Auth"));
const NotFound = lazyPage(() => import("@/pages/NotFound"));
const Projects = lazyPage(() => import("@/pages/Projects"));
const Home = lazyPage(() => import("@/pages/Home"));
const ProjectSpace = lazyPage(() => import("@/pages/ProjectSpace"));
const AccountWizard = lazyNamed(() => import("@/features/onboarding/AccountWizard"), "AccountWizard");
const Agents = lazyPage(() => import("@/pages/Agents"));
const AgentSetup = lazyPage(() => import("@/pages/AgentSetup"));
const AgentWorker = lazyPage(() => import("@/pages/AgentWorker"));
const Prospects = lazyPage(() => import("@/pages/Prospects"));
const Skills = lazyPage(() => import("@/pages/Skills"));
const Creatives = lazyPage(() => import("@/pages/Creatives"));
const Motion = lazyPage(() => import("@/pages/Motion"));
const CodeSites = lazyPage(() => import("@/pages/sites/CodeSites"));
const SiteEditor = lazyPage(() => import("@/pages/sites/SiteEditor"));
const Copy = lazyPage(() => import("@/pages/Copy"));
const Boards = lazyPage(() => import("@/pages/Boards"));
const ModuleHome = lazyPage(() => import("@/pages/ModuleHome"));
const References = lazyPage(() => import("@/pages/References"));
const BoardRoute = lazyNamed(() => import("@/features/quadros/BoardRoute"), "BoardRoute");
const CreativeEditor = lazyNamed(() => import("@/features/criativos/Editor"), "CreativeEditor");
const MotionStudio = lazyNamed(() => import("@/features/criativos/MotionStudio"), "MotionStudio");
const VideoStudio = lazyNamed(() => import("@/features/criativos/VideoStudio"), "VideoStudio");
const ToVideoStudio = lazyNamed(() => import("@/features/criativos/ToVideoStudio"), "ToVideoStudio");
const CopyEditorPage = lazyNamed(() => import("@/features/copy/CopyEditorPage"), "CopyEditorPage");
const WordPressCallback = lazyPage(() => import("@/pages/WordPressCallback"));
const PageApproval = lazyPage(() => import("@/pages/PageApproval"));
const ProjectInvite = lazyPage(() => import("@/pages/ProjectInvite"));
const TeamInvite = lazyPage(() => import("@/pages/TeamInvite"));
const PublicForm = lazyPage(() => import("@/pages/PublicForm"));
const EnviarFotos = lazyPage(() => import("@/pages/EnviarFotos"));
const CrmOpportunities = lazyPage(() => import("@/pages/crm/Opportunities"));
const CrmClients = lazyPage(() => import("@/pages/crm/Clients"));
const CrmClientDetail = lazyPage(() => import("@/pages/crm/ClientDetail"));
const CrmTeam = lazyPage(() => import("@/pages/crm/Team"));
const Profile = lazyPage(() => import("@/pages/Profile"));
const CrmAccounts = lazyPage(() => import("@/pages/crm/Accounts"));
const CrmSocial = lazyPage(() => import("@/pages/crm/Social"));
const CrmDiagnosis = lazyPage(() => import("@/pages/crm/Diagnosis"));
const CrmInstagram = lazyPage(() => import("@/pages/crm/Instagram"));
const CrmAnuncios = lazyPage(() => import("@/pages/crm/Anuncios"));
const CrmOperacao = lazyPage(() => import("@/pages/crm/Operacao"));
const CrmSite = lazyPage(() => import("@/pages/crm/Site"));
const CrmWhatsApp = lazyPage(() => import("@/pages/crm/WhatsApp"));
const CrmFlows = lazyPage(() => import("@/pages/crm/Flows"));
const CrmForms = lazyPage(() => import("@/pages/crm/Forms"));
const CrmFormEditor = lazyPage(() => import("@/pages/crm/FormEditor"));
const CrmPlan = lazyPage(() => import("@/pages/crm/Plan"));
const CrmContents = lazyPage(() => import("@/pages/crm/Contents"));
const CrmContentDetail = lazyPage(() => import("@/pages/crm/ContentDetail"));
const CrmPauta = lazyPage(() => import("@/pages/crm/Pauta"));
const PautaApproval = lazyPage(() => import("@/pages/PautaApproval"));
const ProductSuggestions = lazyPage(() => import("@/pages/ProductSuggestions"));
const Cerebro = lazyPage(() => import("@/pages/Cerebro"));
const CrmFunnels = lazyPage(() => import("@/pages/crm/Funnels"));
const CrmFunnelDetail = lazyPage(() => import("@/pages/crm/FunnelDetail"));
const InstagramCallback = lazyPage(() => import("@/pages/InstagramCallback"));
const ConnectInstagram = lazyNamed(() => import("@/pages/ConnectInstagram"), "ConnectInstagram");
const ConnectInstagramReturn = lazyNamed(() => import("@/pages/ConnectInstagram"), "ConnectInstagramReturn");
const AdsCallback = lazyPage(() => import("@/pages/AdsCallback"));
const ConnectAds = lazyNamed(() => import("@/pages/ConnectAds"), "ConnectAds");
const ConnectAdsReturn = lazyNamed(() => import("@/pages/ConnectAds"), "ConnectAdsReturn");
const SuperElementsLanding = lazyPage(() => import("@/pages/SuperElementsLanding"));
const ProductLanding = lazyPage(() => import("@/pages/ProductLanding"));
const DesignSystem = lazyPage(() => import("@/pages/DesignSystem"));

// Vitrines dos modelos de clientes (guias de estilo e prévias do Elementor): fora do app, cada uma no seu arquivo
const MenuzitoModel = lazyPage(() => import("@/pages/MenuzitoModel"));
const MenuzitoStyleGuide = lazyPage(() => import("@/pages/MenuzitoStyleGuide"));
const UglyCashModel = lazyPage(() => import("@/pages/UglyCashModel"));
const UglyCashStyleGuide = lazyPage(() => import("@/pages/UglyCashStyleGuide"));
const UglyCashElementorPreview = lazyPage(() => import("@/pages/UglyCashElementorPreview"));
const ZeloStyleGuide = lazyPage(() => import("@/pages/ZeloStyleGuide"));
const ZeloElementorPreview = lazyPage(() => import("@/pages/ZeloElementorPreview"));
const ProcessBaseElementorPreview = lazyPage(() => import("@/pages/ProcessBaseElementorPreview"));
const InpelElementorPreview = lazyPage(() => import("@/pages/InpelElementorPreview"));
const JuniorElementorPreview = lazyPage(() => import("@/pages/JuniorElementorPreview"));
const LeoSchererElementorPreview = lazyPage(() => import("@/pages/LeoSchererElementorPreview"));
const LeoSchererStyleGuide = lazyPage(() => import("@/pages/LeoSchererStyleGuide"));
const LeoSchererRedesign = lazyPage(() => import("@/pages/LeoSchererRedesign"));
const MsaStyleGuide = lazyPage(() => import("@/pages/MsaStyleGuide"));
const templatePreview = (load: () => Promise<() => LandingTemplate>, label: string, defaultWidth?: number) =>
  lazyPage(async () => {
    const [{ default: Preview }, create] = await Promise.all([import("@/pages/ProcessBaseTemplatePreview"), load()]);
    return { default: () => <Preview create={create} label={label} defaultWidth={defaultWidth} /> };
  });
const ProcessBaseBragaPreview = templatePreview(() => import("@/features/space/processbaseBragaProposalTemplate").then((m) => m.createProcessBaseBragaProposalTemplate), "ProcessBase · Proposta Braga · Elementor nativo");
const ProcessBaseLinksPreview = templatePreview(() => import("@/features/space/processbaseLinksTemplate").then((m) => m.createProcessBaseLinksTemplate), "ProcessBase · Cartão de links · Elementor nativo", 390);
const MsaElementorPreview = templatePreview(() => import("@/features/space/msaTemplate").then((m) => m.createMsaTemplate), "MSA · Homepage V4 · Elementor nativo");

function App() {
  return (
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={null}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              {/* Volta da aprovação no WordPress; sem login no caminho para não perder a senha da URL */}
              <Route path="/wordpress/retorno" element={<WordPressCallback />} />
              {/* Volta do login do Instagram: troca o código pelo acesso da conta da equipe */}
              {/* Quem veio pelo link do cliente volta sem login; o resto, como antes */}
              <Route path="/instagram/retorno" element={comesFromLink() ? <ConnectInstagramReturn /> : <ProtectedRoute><InstagramCallback /></ProtectedRoute>} />
              <Route path="/conectar/instagram/:token" element={<ConnectInstagram />} />
              {/* Volta do login do Facebook: escolher as contas de anúncios da equipe */}
              <Route path="/anuncios/retorno" element={comesFromAdsLink() ? <ConnectAdsReturn /> : <ProtectedRoute><AdsCallback /></ProtectedRoute>} />
              <Route path="/conectar/anuncios/:token" element={<ConnectAds />} />
              {/* Link de aprovação: o cliente abre sem login */}
              <Route path="/aprovar/:shareId" element={<PageApproval />} />
              {/* Pauta: o cliente aprova e comenta as peças de um envio, sem login */}
              <Route path="/pauta/aprovar/:id" element={<PautaApproval />} />
              {/* Convite para editar um projeto junto: mostra o convite antes do login */}
              <Route path="/convite/:inviteId" element={<ProjectInvite />} />
              {/* Convite para a equipe do CRM: mostra o convite antes do login */}
              <Route path="/equipe/convite/:inviteId" element={<TeamInvite />} />
              {/* Link direto para um formulário (campanhas, WhatsApp, e-mail): público, sem login */}
              <Route path="/f/:id" element={<PublicForm />} />
              <Route path="/enviar/:token" element={<EnviarFotos />} />
              <Route path="/menuzito-modelo" element={<MenuzitoModel />} />
              <Route path="/menuzito-style-guide" element={<MenuzitoStyleGuide />} />
              <Route path="/uglycash-modelo" element={<UglyCashModel />} />
              <Route path="/uglycash-style-guide" element={<UglyCashStyleGuide />} />
              <Route path="/uglycash-elementor-preview" element={<UglyCashElementorPreview />} />
              <Route path="/zelo-style-guide" element={<ZeloStyleGuide />} />
              <Route path="/zelo-elementor-preview" element={<ZeloElementorPreview />} />
              <Route path="/processbase-elementor-preview" element={<ProcessBaseElementorPreview />} />
              <Route path="/processbase-proposta-braga" element={<ProcessBaseBragaPreview />} />
              <Route path="/processbase-links" element={<ProcessBaseLinksPreview />} />
              <Route path="/inpel-elementor-preview" element={<InpelElementorPreview />} />
              <Route path="/junior-elementor-preview" element={<JuniorElementorPreview />} />
              <Route path="/leoscherer-style-guide" element={<LeoSchererStyleGuide />} />
              <Route path="/leoscherer-elementor-preview" element={<LeoSchererElementorPreview />} />
              <Route path="/leoscherer-redesign" element={<LeoSchererRedesign />} />
              <Route path="/leoscherer-redesign-proposta" element={<LeoSchererRedesign proposal />} />
              <Route path="/msa-style-guide" element={<MsaStyleGuide />} />
              <Route path="/msa-elementor-preview" element={<MsaElementorPreview />} />
              <Route path="/superelements" element={<SuperElementsLanding />} />
              <Route path="/lp" element={<ProductLanding />} />
              <Route path="/design-system" element={<DesignSystem />} />

              {/* Projetos (um por cliente); cada um abre o seu Space */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Projects />} />
                <Route path="inicio" element={<Home />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="projetos/:projectId" element={<ProjectSpace />} />
                {/* Os agentes trabalhando agora, cada um no seu projeto */}
                <Route path="agentes" element={<Agents />} />
                <Route path="agentes/configurar" element={<AgentSetup />} />
                {/* As skills do chat dos agentes: padrão, da equipe e as suas */}
                <Route path="skills" element={<Skills />} />
                {/* Posts de Instagram na marca de cada projeto: editor de camadas e exportação */}
                {/* Copy: o documento de texto da empresa (posts, páginas, campanhas, pesquisas) */}
                <Route path="copy" element={<Copy />} />
                <Route path="copy/:docId" element={<CopyEditorPage />} />
                <Route path="criativos" element={<Creatives />} />
                <Route path="sites" element={<CodeSites />} />
                <Route path="sites/:siteId" element={<SiteEditor />} />
                <Route path="motion" element={<Motion />} />
                <Route path="motion/:setId" element={<MotionStudio />} />
                {/* Um estúdio só de vídeo (2026-11-09): os endereços antigos de cena e explicativo abrem nele */}
                <Route path="motion/:setId/video" element={<VideoStudio />} />
                <Route path="motion/:setId/cena" element={<ToVideoStudio />} />
                <Route path="motion/:setId/explica" element={<ToVideoStudio />} />
                <Route path="criativos/:setId" element={<CreativeEditor />} />
                {/* CRM da equipe: funil, clientes, equipe e convites; só para quem é de uma equipe */}
                <Route path="plano" element={<CrmGate><CrmPlan /></CrmGate>} />
                <Route path="pauta" element={<CrmGate><CrmPauta /></CrmGate>} />
                <Route path="conteudos" element={<CrmGate><CrmContents /></CrmGate>} />
                <Route path="conteudos/:id" element={<CrmGate><CrmContentDetail /></CrmGate>} />
                <Route path="crm" element={<CrmGate><CrmOpportunities /></CrmGate>} />
                <Route path="crm/clientes" element={<CrmGate><CrmClients /></CrmGate>} />
                <Route path="crm/clientes/:clientId" element={<CrmGate><CrmClientDetail /></CrmGate>} />
                <Route path="crm/equipe" element={<CrmGate><CrmTeam /></CrmGate>} />
                {/* As contas (empresas-cliente) e os módulos de cada uma; só o admin da plataforma */}
                <Route path="contas" element={<CrmAccounts />} />
                {/* Sugestões ao time de produto (pela Iara): o admin vê todas; cada pessoa, as suas */}
                <Route path="sugestoes" element={<ProductSuggestions />} />
                {/* Segundo cérebro (cerebro/ do repositório): só o admin da plataforma; no dev edita os arquivos */}
                <Route path="cerebro" element={<Cerebro />} />
                <Route path="quadros" element={<Boards />} />
                <Route path="modulo/:moduleId" element={<ModuleHome />} />
                <Route path="referencias" element={<References />} />
                <Route path="quadros/:boardId" element={<BoardRoute />} />
                <Route path="contas/nova" element={<AccountWizard />} />
                {/* Social selling: a fila do dia nas redes; quem segue e envia é a pessoa */}
                <Route path="crm/social" element={<CrmGate><CrmSocial /></CrmGate>} />
                <Route path="crm/diagnostico" element={<CrmGate><CrmDiagnosis /></CrmGate>} />
                {/* O Instagram da equipe pela API oficial da Meta: números, posts, publicar e comentários */}
                <Route path="crm/instagram" element={<CrmGate><CrmInstagram /></CrmGate>} />
                <Route path="crm/anuncios" element={<CrmGate><CrmAnuncios /></CrmGate>} />
                <Route path="crm/operacao" element={<CrmGate><CrmOperacao /></CrmGate>} />
                {/* As visitas do site da equipe, contadas pelo script visitas.js colado no WordPress */}
                <Route path="crm/site" element={<CrmGate><CrmSite /></CrmGate>} />
                {/* O número de WhatsApp da equipe conectado pelo QR code (serviço services/whatsapp) */}
                <Route path="crm/whatsapp" element={<CrmGate><CrmWhatsApp /></CrmGate>} />
                {/* Fluxos de atendimento e prospecção: a rotina comercial em mensagens de WhatsApp */}
                <Route path="crm/fluxos" element={<CrmGate><CrmFlows /></CrmGate>} />
                <Route path="crm/formularios" element={<CrmGate><CrmForms /></CrmGate>} />
                <Route path="crm/formularios/:id" element={<CrmGate><CrmFormEditor /></CrmGate>} />
                <Route path="crm/funis" element={<CrmGate><CrmFunnels /></CrmGate>} />
                <Route path="crm/funis/:id" element={<CrmGate><CrmFunnelDetail /></CrmGate>} />
                {/* Buscas da equipe na nuvem; a varredura pesada continua no app local. */}
                <Route path="prospeccao" element={<CrmGate><Prospects /></CrmGate>} />
              </Route>
              {/* Projeto aberto em segundo plano para um agente (iframe escondido, só no dev) */}
              <Route path="/agente/:projectId" element={import.meta.hot ? <ProtectedRoute><AgentWorker /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/space" element={<Navigate to="/" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <MediaViewer />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;
