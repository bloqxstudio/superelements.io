import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Copy,
  ExternalLink,
  Loader2,
  ClipboardCheck,
  FileText,
  Handshake,
  Sparkles,
  ArrowUpRight,
  Clock3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";

type ProposalStatus = "pending" | "accepted" | "rejected";
type ProposalTemplate = "simple" | "partners";

interface Proposal {
  id: string;
  token: string;
  client_name: string;
  client_email: string | null;
  scope: string;
  price: number;
  payment_terms: string | null;
  deadline: string | null;
  status: ProposalStatus;
  template: ProposalTemplate;
  accepted_at: string | null;
  created_at: string;
}

const statusConfig: Record<
  ProposalStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
    accent: string;
  }
> = {
  pending: {
    label: "Aguardando",
    variant: "outline",
    icon: <Clock3 className="h-3.5 w-3.5" />,
    accent: "from-amber-100 to-orange-50",
  },
  accepted: {
    label: "Aceita",
    variant: "default",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    accent: "from-emerald-100 to-lime-50",
  },
  rejected: {
    label: "Recusada",
    variant: "destructive",
    icon: <XCircle className="h-3.5 w-3.5" />,
    accent: "from-rose-100 to-red-50",
  },
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  const { label, variant } = statusConfig[status] ?? statusConfig.pending;
  return <Badge variant={variant}>{label}</Badge>;
}

function TemplateBadge({ template }: { template: ProposalTemplate }) {
  if (template === "partners") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-lime-50 text-lime-700 border border-lime-200">
        <Handshake className="w-3 h-3" />
        Partners
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
      <FileText className="w-3 h-3" />
      Simples
    </span>
  );
}

function TemplateSelector({
  value,
  onChange,
}: {
  value: ProposalTemplate;
  onChange: (v: ProposalTemplate) => void;
}) {
  const options: { id: ProposalTemplate; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      id: "simple",
      icon: <FileText className="w-5 h-5" />,
      title: "Proposta simples",
      desc: "Escopo, valor e prazo. Direta ao ponto.",
    },
    {
      id: "partners",
      icon: <Handshake className="w-5 h-5" />,
      title: "Proposta Partners",
      desc: "Programa SuperElements com diferenciais e oferta exclusiva.",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
            value === o.id
              ? "border-primary bg-primary/5 shadow-[0_0_0_3px_rgba(151,191,47,0.12)]"
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <span
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              value === o.id ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-500"
            )}
          >
            {o.icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{o.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{o.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

interface FormData {
  client_name: string;
  client_email: string;
  scope: string;
  price: string;
  payment_terms: string;
  deadline: string;
  template: ProposalTemplate;
}

const emptyForm: FormData = {
  client_name: "",
  client_email: "",
  scope: "",
  price: "",
  payment_terms: "",
  deadline: "",
  template: "simple",
};

function CreateProposalDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name || !form.scope || !form.price) {
      toast.error("Preencha cliente, escopo e valor.");
      return;
    }
    if (!activeWorkspace?.id) {
      toast.error("Selecione um workspace para criar propostas.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("proposals").insert({
      client_name: form.client_name,
      client_email: form.client_email || null,
      scope: form.scope,
      price: parseFloat(form.price.replace(",", ".")),
      payment_terms: form.payment_terms || null,
      deadline: form.deadline || null,
      template: form.template,
      created_by: user?.id ?? null,
      workspace_id: activeWorkspace.id,
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao criar proposta: " + error.message);
      return;
    }

    toast.success("Proposta criada com sucesso!");
    setForm(emptyForm);
    setOpen(false);
    onCreated();
  }

  const isPartners = form.template === "partners";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova proposta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova proposta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-2">
            <Label>Modelo de proposta</Label>
            <TemplateSelector
              value={form.template}
              onChange={(v) => setForm((f) => ({ ...f, template: v }))}
            />
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Nome do cliente / empresa *</Label>
              <Input
                placeholder="Ex: Agência Impulso"
                value={form.client_name}
                onChange={set("client_name")}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>E-mail do cliente</Label>
              <Input
                type="email"
                placeholder="cliente@email.com"
                value={form.client_email}
                onChange={set("client_email")}
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>
                {isPartners ? "Mensagem personalizada para o cliente" : "Escopo do projeto *"}
              </Label>
              <Textarea
                placeholder={
                  isPartners
                    ? "Ex: Olá! Preparamos essa proposta especialmente para sua agência."
                    : "Descreva entregáveis, funcionalidades e responsabilidades."
                }
                rows={4}
                value={form.scope}
                onChange={set("scope")}
              />
              {isPartners && (
                <p className="text-xs text-gray-400">
                  Essa mensagem abre a proposta. Os diferenciais do programa entram automaticamente.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input
                placeholder={isPartners ? "600,00" : "0,00"}
                value={form.price}
                onChange={set("price")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de entrega</Label>
              <Input type="date" value={form.deadline} onChange={set("deadline")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Condições de pagamento</Label>
              <Input
                placeholder={
                  isPartners ? "Ex: R$600 por página produzida" : "Ex: 50% na aprovação, 50% na entrega"
                }
                value={form.payment_terms}
                onChange={set("payment_terms")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar proposta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevealSection({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeWorkspace } = useWorkspace();

  async function fetchProposals() {
    setLoading(true);
    try {
      let query = supabase
        .from("proposals")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeWorkspace) {
        query = query.eq("workspace_id", activeWorkspace.id);
      } else {
        setProposals([]);
        return;
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Erro ao carregar propostas: " + error.message);
        setProposals([]);
      } else {
        setProposals((data as Proposal[]) ?? []);
      }
    } catch (err) {
      console.error("Unexpected error loading proposals:", err);
      toast.error("Falha inesperada ao carregar propostas.");
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProposals();
  }, [activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function copyLink(token: string) {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function openLink(token: string) {
    window.open(`${window.location.origin}/p/${token}`, "_blank");
  }

  const metrics = useMemo(() => {
    const pending = proposals.filter((p) => p.status === "pending").length;
    const accepted = proposals.filter((p) => p.status === "accepted").length;
    const rejected = proposals.filter((p) => p.status === "rejected").length;
    const totalValue = proposals.reduce((acc, p) => acc + (Number.isFinite(p.price) ? p.price : 0), 0);

    return {
      pending,
      accepted,
      rejected,
      totalValue,
    };
  }, [proposals]);

  const proposalsValueText = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(metrics.totalValue);

  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.section className="mb-8 rounded-3xl border border-gray-200/70 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-semibold tracking-wide text-lime-800">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace de propostas
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Crie, publique e acompanhe propostas com mais impacto visual.
              </h1>
              <p className="max-w-xl text-sm text-gray-600 sm:text-base">
                Uma visão única para pipeline comercial: status em tempo real, links prontos para envio e gestão com ritmo.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CreateProposalDialog onCreated={fetchProposals} />
              <Button variant="outline" className="border-gray-300 bg-white/70" onClick={fetchProposals}>
                Atualizar
              </Button>
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <motion.div variants={itemVariants} className="rounded-2xl border border-gray-200/70 bg-gradient-to-br from-white to-lime-50/70 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">Total em propostas</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{proposalsValueText}</p>
              <p className="mt-1 text-xs text-gray-500">Somatório de toda a base</p>
            </motion.div>

            {(["pending", "accepted", "rejected"] as ProposalStatus[]).map((status) => {
              const count = metrics[status];
              const cfg = statusConfig[status];
              return (
                <motion.div key={status} variants={itemVariants} className={cn("rounded-2xl border border-gray-200/70 bg-gradient-to-br p-4 shadow-sm", cfg.accent)}>
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="text-xs uppercase tracking-wide">{cfg.label}</span>
                    {cfg.icon}
                  </div>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">{count}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.section>

        <RevealSection delay={0.05} className="mb-7">
          <div className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pipeline recente</h2>
                <p className="text-sm text-gray-500">Propostas mais recentes com atalhos rápidos.</p>
              </div>
              <span className="text-xs font-medium text-gray-500">{proposals.length} registros</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white/60 py-16 text-gray-400">
                <ClipboardCheck className="h-10 w-10" />
                <p className="text-sm">Nenhuma proposta criada ainda.</p>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                className="grid gap-3"
              >
                {proposals.slice(0, 5).map((proposal) => (
                  <motion.article
                    key={proposal.id}
                    variants={itemVariants}
                    className="group rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm transition-colors hover:border-lime-200"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{proposal.client_name}</p>
                        <p className="text-xs text-gray-500">{proposal.client_email || "Sem e-mail"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TemplateBadge template={proposal.template} />
                        <StatusBadge status={proposal.status} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
                      <span>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(proposal.price)}
                      </span>
                      <span>
                        Prazo: {proposal.deadline
                          ? format(new Date(proposal.deadline + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </span>
                      <span>
                        Criada em {format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(proposal.token)}>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copiar link
                      </Button>
                      <Button size="sm" className="group/button" onClick={() => openLink(proposal.token)}>
                        Abrir
                        <ArrowUpRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </div>
        </RevealSection>

        <RevealSection delay={0.1}>
          <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-sm">
            <div className="border-b border-gray-200/70 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900">Tabela completa</h2>
              <p className="text-sm text-gray-500">Visão detalhada para operação diária.</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                <ClipboardCheck className="h-10 w-10" />
                <p className="text-sm">Nenhuma proposta criada ainda.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/60">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((p) => (
                    <TableRow key={p.id} className="hover:bg-white/65">
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{p.client_name}</p>
                          {p.client_email && <p className="text-xs text-gray-400">{p.client_email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TemplateBadge template={p.template} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(p.price)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {p.deadline
                          ? format(new Date(p.deadline + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyLink(p.token)}
                            title="Copiar link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openLink(p.token)}
                            title="Abrir proposta"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
