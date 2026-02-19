import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProposalPartnersView from "./ProposalPartnersView";
import {
  Check,
  X,
  Zap,
  CalendarDays,
  CreditCard,
  FileText,
  Loader2,
  CircleCheck,
  CircleX,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ProposalStatus = "pending" | "accepted" | "rejected";

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
  template: "simple" | "partners";
  accepted_at: string | null;
  created_at: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center">
        <Zap className="w-4 h-4 text-black fill-black" />
      </div>
      <span className="font-bold text-zinc-900 text-sm tracking-tight">SuperElements</span>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-[0_20px_40px_-36px_rgba(10,20,8,0.65)] backdrop-blur-xl"
    >
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold leading-snug ${accent ?? "text-zinc-900"}`}>{value}</p>
    </motion.div>
  );
}

function RevealSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <section className={className}>{children}</section>;
  }

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 48, filter: "blur(16px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function Confirmed({ status }: { status: "accepted" | "rejected" }) {
  const isAccepted = status === "accepted";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-white/80 bg-white/85 px-6 py-14 text-center shadow-[0_30px_70px_-45px_rgba(10,20,8,0.65)] backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.15 }}
        className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
          isAccepted ? "bg-lime-100 text-lime-700" : "bg-red-100 text-red-600"
        }`}
      >
        {isAccepted ? <CircleCheck className="h-10 w-10" /> : <CircleX className="h-10 w-10" />}
      </motion.div>
      <h2 className="mb-2 text-2xl font-black text-zinc-900">
        {isAccepted ? "Proposta aceita!" : "Proposta recusada"}
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-600">
        {isAccepted
          ? "Recebemos sua confirmação e seguiremos com os próximos passos do projeto."
          : "Sem problemas. Se quiser retomar a conversa depois, nosso time está disponível."}
      </p>
    </motion.div>
  );
}

export default function ProposalView() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"accepted" | "rejected" | null>(null);
  const [confirming, setConfirming] = useState<"accepted" | "rejected" | null>(null);

  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroBlur = useTransform(scrollYProgress, [0, 0.22], ["blur(0px)", "blur(8px)"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0.72]);

  useEffect(() => {
    let isMounted = true;

    const fetchProposal = async () => {
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Proposal fetch timeout")), 15000)
        );

        const result = (await Promise.race([
          supabase.from("proposals").select("*").eq("token", token).single(),
          timeout,
        ])) as { data: Proposal | null; error: any };

        if (!isMounted) return;
        if (!result.error) {
          setProposal(result.data as Proposal);
        } else {
          setProposal(null);
        }
      } catch (err) {
        console.error("Error loading proposal:", err);
        if (isMounted) setProposal(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchProposal();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleAction(action: "accepted" | "rejected") {
    if (!proposal) return;
    setActing(action);
    const { data, error } = await supabase.rpc("public_set_proposal_status_by_token", {
      p_token: token!,
      p_status: action,
    });

    setActing(null);
    if (!error && data) {
      setProposal((current) => (current ? { ...current, status: action } : current));
    }
  }

  const priceFormatted = proposal
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(proposal.price)
    : "";

  const issuedAtText = useMemo(() => {
    if (!proposal) return "";
    return format(new Date(proposal.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [proposal]);

  if (!loading && proposal?.template === "partners") {
    return (
      <ErrorBoundary>
        <ProposalPartnersView />
      </ErrorBoundary>
    );
  }

  const heroMotionStyle = shouldReduceMotion ? undefined : { filter: heroBlur, opacity: heroOpacity };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(200,238,140,0.45),transparent_36%),linear-gradient(180deg,#f8faf7_0%,#f4f6f8_65%,#f2f3f5_100%)] text-zinc-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-32 h-72 w-72 rounded-full bg-lime-200/35 blur-3xl" />
        <div className="absolute -right-24 top-[44%] h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-white/85 via-white/45 to-transparent backdrop-blur-2xl" />

      <nav className="relative z-20 border-b border-black/5 bg-white/50 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Logo />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Proposta comercial</span>
        </div>
      </nav>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-20 pt-14">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
          </div>
        ) : !proposal ? (
          <div className="py-32 text-center">
            <p className="text-lg text-zinc-500">Proposta não encontrada.</p>
          </div>
        ) : proposal.status !== "pending" ? (
          <div className="py-16">
            <Confirmed status={proposal.status as "accepted" | "rejected"} />
          </div>
        ) : (
          <>
            <motion.section
              style={heroMotionStyle}
              className="mb-8 rounded-3xl border border-white/80 bg-white/80 p-7 shadow-[0_32px_80px_-54px_rgba(10,20,8,0.7)] backdrop-blur-xl sm:p-9"
            >
              <motion.div initial="hidden" animate="visible" variants={stagger}>
                <motion.span
                  variants={fadeUp}
                  className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lime-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Proposta exclusiva
                </motion.span>

                <motion.h1 variants={fadeUp} className="text-3xl font-black tracking-tight text-zinc-900 sm:text-5xl">
                  Olá, <span className="text-lime-700">{proposal.client_name}.</span>
                  <br className="hidden sm:block" />
                  Este projeto foi desenhado para o seu cenário.
                </motion.h1>

                <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                  Revise os detalhes abaixo e confirme quando estiver pronto. Ao aceitar, nossa equipe já segue para kickoff e produção.
                </motion.p>
              </motion.div>
            </motion.section>

            <RevealSection delay={0.04} className="mb-8">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={stagger}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <InfoCard
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Investimento"
                  value={priceFormatted}
                  accent="text-lime-700"
                />

                {proposal.payment_terms && (
                  <InfoCard
                    icon={<BadgeCheck className="h-4 w-4" />}
                    label="Condições"
                    value={proposal.payment_terms}
                  />
                )}

                {proposal.deadline && (
                  <InfoCard
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Prazo"
                    value={format(new Date(proposal.deadline + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  />
                )}

                <InfoCard icon={<CalendarDays className="h-4 w-4" />} label="Emitida em" value={issuedAtText} />
              </motion.div>
            </RevealSection>

            <RevealSection delay={0.08} className="mb-8">
              <div className="rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_24px_55px_-44px_rgba(10,20,8,0.6)] backdrop-blur-xl sm:p-8">
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Escopo do projeto</p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 sm:text-base">
                  {proposal.scope}
                </p>
              </div>
            </RevealSection>

            <RevealSection delay={0.12}>
              <div className="rounded-3xl border border-lime-200/80 bg-lime-50/75 p-6 shadow-[0_26px_58px_-44px_rgba(72,116,14,0.45)] backdrop-blur-xl sm:p-8">
                <h2 className="text-xl font-black text-zinc-900 sm:text-2xl">Deseja seguir com esta proposta?</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
                  Ao aceitar, você confirma os termos apresentados nesta página e autoriza o início do projeto.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => setConfirming("accepted")}
                    className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-black"
                  >
                    <Check className="h-4 w-4" />
                    Aceitar proposta
                  </button>
                  <button
                    onClick={() => setConfirming("rejected")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white/75 px-6 py-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                    Recusar
                  </button>
                </div>
              </div>
            </RevealSection>
          </>
        )}
      </main>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md"
            onClick={() => !acting && setConfirming(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.94, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 16, scale: 0.94, filter: "blur(10px)" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-sm rounded-3xl border border-white/80 bg-white/90 p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${
                  confirming === "accepted" ? "bg-lime-100 text-lime-700" : "bg-red-100 text-red-600"
                }`}
              >
                {confirming === "accepted" ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
              </div>

              <h3 className="mb-2 text-lg font-bold text-zinc-900">
                {confirming === "accepted" ? "Confirmar aceite?" : "Confirmar recusa?"}
              </h3>
              <p className="mb-7 text-sm leading-relaxed text-zinc-600">
                {confirming === "accepted"
                  ? "Ao confirmar, você aceita formalmente esta proposta."
                  : "Ao confirmar, esta proposta será marcada como recusada."}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(null)}
                  disabled={!!acting}
                  className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await handleAction(confirming);
                    setConfirming(null);
                  }}
                  disabled={!!acting}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                    confirming === "accepted"
                      ? "bg-zinc-900 text-white hover:bg-black"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {confirming === "accepted" ? "Sim, aceitar" : "Sim, recusar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
