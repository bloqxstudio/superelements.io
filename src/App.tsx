import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import Projects from "@/pages/Projects";
import ProjectSpace from "@/pages/ProjectSpace";
import Agents from "@/pages/Agents";
import AgentSetup from "@/pages/AgentSetup";
import AgentWorker from "@/pages/AgentWorker";
import Prospects from "@/pages/Prospects";
import Skills from "@/pages/Skills";
import Creatives from "@/pages/Creatives";
import Copy from "@/pages/Copy";
import { CreativeEditor } from "@/features/criativos/Editor";
import { CopyEditorPage } from "@/features/copy/CopyEditorPage";
import WordPressCallback from "@/pages/WordPressCallback";
import PageApproval from "@/pages/PageApproval";
import ProjectInvite from "@/pages/ProjectInvite";
import TeamInvite from "@/pages/TeamInvite";
import CrmOpportunities from "@/pages/crm/Opportunities";
import CrmClients from "@/pages/crm/Clients";
import CrmClientDetail from "@/pages/crm/ClientDetail";
import CrmTeam from "@/pages/crm/Team";
import CrmSocial from "@/pages/crm/Social";
import CrmDiagnosis from "@/pages/crm/Diagnosis";
import CrmInstagram from "@/pages/crm/Instagram";
import InstagramCallback from "@/pages/InstagramCallback";
import AdsCallback from "@/pages/AdsCallback";
import { CrmGate } from "@/features/crm/CrmGate";
import MenuzitoModel from "@/pages/MenuzitoModel";
import MenuzitoStyleGuide from "@/pages/MenuzitoStyleGuide";
import UglyCashModel from "@/pages/UglyCashModel";
import UglyCashStyleGuide from "@/pages/UglyCashStyleGuide";
import UglyCashElementorPreview from "@/pages/UglyCashElementorPreview";
import ZeloStyleGuide from "@/pages/ZeloStyleGuide";
import ZeloElementorPreview from "@/pages/ZeloElementorPreview";
import ProcessBaseElementorPreview from "@/pages/ProcessBaseElementorPreview";
import ProcessBaseTemplatePreview from "@/pages/ProcessBaseTemplatePreview";
import { createProcessBaseBragaProposalTemplate } from "@/features/space/processbaseBragaProposalTemplate";
import { createProcessBaseLinksTemplate } from "@/features/space/processbaseLinksTemplate";
import InpelElementorPreview from "@/pages/InpelElementorPreview";
import JuniorElementorPreview from "@/pages/JuniorElementorPreview";
import LeoSchererElementorPreview from "@/pages/LeoSchererElementorPreview";
import LeoSchererStyleGuide from "@/pages/LeoSchererStyleGuide";
import LeoSchererRedesign from "@/pages/LeoSchererRedesign";
import MsaStyleGuide from "@/pages/MsaStyleGuide";
import { createMsaTemplate } from "@/features/space/msaTemplate";
import SuperElementsLanding from "@/pages/SuperElementsLanding";

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              {/* Volta da aprovação no WordPress; sem login no caminho para não perder a senha da URL */}
              <Route path="/wordpress/retorno" element={<WordPressCallback />} />
              {/* Volta do login do Instagram: troca o código pelo acesso da conta da equipe */}
              <Route path="/instagram/retorno" element={<ProtectedRoute><InstagramCallback /></ProtectedRoute>} />
              {/* Volta do login do Facebook: escolher as contas de anúncios da equipe */}
              <Route path="/anuncios/retorno" element={<ProtectedRoute><AdsCallback /></ProtectedRoute>} />
              {/* Link de aprovação: o cliente abre sem login */}
              <Route path="/aprovar/:shareId" element={<PageApproval />} />
              {/* Convite para editar um projeto junto: mostra o convite antes do login */}
              <Route path="/convite/:inviteId" element={<ProjectInvite />} />
              {/* Convite para a equipe do CRM: mostra o convite antes do login */}
              <Route path="/equipe/convite/:inviteId" element={<TeamInvite />} />
              <Route path="/menuzito-modelo" element={<MenuzitoModel />} />
              <Route path="/menuzito-style-guide" element={<MenuzitoStyleGuide />} />
              <Route path="/uglycash-modelo" element={<UglyCashModel />} />
              <Route path="/uglycash-style-guide" element={<UglyCashStyleGuide />} />
              <Route path="/uglycash-elementor-preview" element={<UglyCashElementorPreview />} />
              <Route path="/zelo-style-guide" element={<ZeloStyleGuide />} />
              <Route path="/zelo-elementor-preview" element={<ZeloElementorPreview />} />
              <Route path="/processbase-elementor-preview" element={<ProcessBaseElementorPreview />} />
              <Route path="/processbase-proposta-braga" element={<ProcessBaseTemplatePreview create={createProcessBaseBragaProposalTemplate} label="ProcessBase · Proposta Braga · Elementor nativo" />} />
              <Route path="/processbase-links" element={<ProcessBaseTemplatePreview create={createProcessBaseLinksTemplate} label="ProcessBase · Cartão de links · Elementor nativo" defaultWidth={390} />} />
              <Route path="/inpel-elementor-preview" element={<InpelElementorPreview />} />
              <Route path="/junior-elementor-preview" element={<JuniorElementorPreview />} />
              <Route path="/leoscherer-style-guide" element={<LeoSchererStyleGuide />} />
              <Route path="/leoscherer-elementor-preview" element={<LeoSchererElementorPreview />} />
              <Route path="/leoscherer-redesign" element={<LeoSchererRedesign />} />
              <Route path="/leoscherer-redesign-proposta" element={<LeoSchererRedesign proposal />} />
              <Route path="/msa-style-guide" element={<MsaStyleGuide />} />
              <Route path="/msa-elementor-preview" element={<ProcessBaseTemplatePreview create={createMsaTemplate} label="MSA · Homepage V4 · Elementor nativo" />} />
              <Route path="/superelements" element={<SuperElementsLanding />} />

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
                <Route path="criativos/:setId" element={<CreativeEditor />} />
                {/* CRM da equipe: funil, clientes, equipe e convites; só para quem é de uma equipe */}
                <Route path="crm" element={<CrmGate><CrmOpportunities /></CrmGate>} />
                <Route path="crm/clientes" element={<CrmGate><CrmClients /></CrmGate>} />
                <Route path="crm/clientes/:clientId" element={<CrmGate><CrmClientDetail /></CrmGate>} />
                <Route path="crm/equipe" element={<CrmGate><CrmTeam /></CrmGate>} />
                {/* Social selling: a fila do dia nas redes; quem segue e envia é a pessoa */}
                <Route path="crm/social" element={<CrmGate><CrmSocial /></CrmGate>} />
                <Route path="crm/diagnostico" element={<CrmGate><CrmDiagnosis /></CrmGate>} />
                {/* O Instagram da equipe pela API oficial da Meta: números, posts, publicar e comentários */}
                <Route path="crm/instagram" element={<CrmGate><CrmInstagram /></CrmGate>} />
                {/* Buscas da equipe na nuvem; a varredura pesada continua no app local. */}
                <Route path="prospeccao" element={<CrmGate><Prospects /></CrmGate>} />
              </Route>
              {/* Projeto aberto em segundo plano para um agente (iframe escondido, só no dev) */}
              <Route path="/agente/:projectId" element={import.meta.hot ? <ProtectedRoute><AgentWorker /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/space" element={<Navigate to="/" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;
