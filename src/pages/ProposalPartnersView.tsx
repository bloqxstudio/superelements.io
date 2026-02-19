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
import {
  ArrowRight,
  Check,
  X,
  Zap,
  Target,
  Clock,
  Eye,
  Headphones,
  Building2,
  CalendarDays,
  CreditCard,
  Loader2,
  CircleCheck,
  CircleX,
  Star,
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
  accepted_at: string | null;
  created_at: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 34, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-400">
        <Zap className="h-4 w-4 fill-black text-black" />
      </div>
      <span className="text-sm font-bold tracking-tight text-zinc-900">SuperElements</span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lime-700">
      {children}
    </span>
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
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <section className={className}>{children}</section>;
  }

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 42, filter: "blur(15px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      {children}
    </motion.section>
  );
}

function Confirmed({ status }: { status: "accepted" | "rejected" }) {
  const isAccepted = status === "accepted";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(200,238,140,0.4),transparent_38%),linear-gradient(180deg,#f8faf7_0%,#f4f6f8_65%,#f2f3f5_100%)] px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex max-w-sm flex-col items-center gap-6 rounded-3xl border border-white/80 bg-white/85 px-6 py-12 text-center shadow-[0_28px_65px_-45px_rgba(10,20,8,0.65)] backdrop-blur-xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.15 }}
          className={`flex h-20 w-20 items-center justify-center rounded-full ${
            isAccepted ? "bg-lime-100 text-lime-700" : "bg-red-100 text-red-600"
          }`}
        >
          {isAccepted ? <CircleCheck className="h-10 w-10" /> : <CircleX className="h-10 w-10" />}
        </motion.div>
        <Logo />
        <div>
          <h2 className="mb-2 text-2xl font-black text-zinc-900">
            {isAccepted ? "Bem-vindo ao programa!" : "Proposta recusada"}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            {isAccepted
              ? "Confirmação recebida. Vamos iniciar os próximos passos com sua agência."
              : "Sem problemas. Se quiser retomar essa proposta, é só nos chamar."}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

const features = [
  {
    icon: <Target className="h-4 w-4" />,
    title: "Preço exclusivo partner",
    desc: "R$600 por página, previsível e sem renegociação.",
    color: "from-lime-100 to-lime-50",
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: "Foco em conversão",
    desc: "Estrutura pensada para mídia paga e resultado.",
    color: "from-amber-100 to-orange-50",
  },
  {
    icon: <Eye className="h-4 w-4" />,
    title: "White label real",
    desc: "Entrega aparece como da sua agência, sem ruído.",
    color: "from-violet-100 to-fuchsia-50",
  },
  {
    icon: <Clock className="h-4 w-4" />,
    title: "Entrega previsível",
    desc: "Processo claro com prazo definido para cada página.",
    color: "from-sky-100 to-cyan-50",
  },
  {
    icon: <Building2 className="h-4 w-4" />,
    title: "Escopo que escala",
    desc: "One-pages e sites simples prontos para operação.",
    color: "from-rose-100 to-red-50",
  },
  {
    icon: <Headphones className="h-4 w-4" />,
    title: "Acompanhamento incluso",
    desc: "Monitoramento pós-publicação sem custo extra.",
    color: "from-emerald-100 to-teal-50",
  },
];

const steps = [
  { n: "01", title: "Você envia o briefing", desc: "Objetivo, público e oferta da campanha." },
  { n: "02", title: "Nós produzimos", desc: "Construção da landing page com foco em performance." },
  { n: "03", title: "Você aprova e publica", desc: "Entrega pronta para subir e rodar tráfego." },
];

const testimonials = [
  {
    name: "Mariana Costa",
    role: "Agência Impulso",
    text: "O ritmo da operação mudou. Hoje temos previsibilidade de entrega.",
  },
  {
    name: "Lucas Ferreira",
    role: "Studio F",
    text: "White label funciona perfeitamente. O cliente só vê padrão alto.",
  },
  {
    name: "Juliana Ramos",
    role: "Convertex",
    text: "Prazo e qualidade estáveis. Virou peça central da nossa entrega.",
  },
];

export default function ProposalPartnersView() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [confirming, setConfirming] = useState<"accepted" | "rejected" | null>(null);

  const reducedMotion = useReducedMotion();
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
        console.error("Error loading partners proposal:", err);
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
    setActing(true);
    const { data, error } = await supabase.rpc("public_set_proposal_status_by_token", {
      p_token: token!,
      p_status: action,
    });
    setActing(false);
    if (!error && data) setProposal((p) => (p ? { ...p, status: action } : p));
  }

  const priceFormatted = proposal
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(proposal.price)
    : "";

  const issuedAtText = useMemo(() => {
    if (!proposal) return "";
    return format(new Date(proposal.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [proposal]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(200,238,140,0.4),transparent_38%),linear-gradient(180deg,#f8faf7_0%,#f4f6f8_65%,#f2f3f5_100%)]">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(200,238,140,0.4),transparent_38%),linear-gradient(180deg,#f8faf7_0%,#f4f6f8_65%,#f2f3f5_100%)]">
        <p className="text-lg text-zinc-500">Proposta não encontrada.</p>
      </div>
    );
  }

  if (proposal.status !== "pending") {
    return <Confirmed status={proposal.status as "accepted" | "rejected"} />;
  }

  const heroMotionStyle = reducedMotion ? undefined : { filter: heroBlur, opacity: heroOpacity };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(200,238,140,0.45),transparent_35%),linear-gradient(180deg,#f8faf7_0%,#f4f6f8_65%,#f2f3f5_100%)] text-zinc-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-36 h-72 w-72 rounded-full bg-lime-200/35 blur-3xl" />
        <div className="absolute -right-24 top-[48%] h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-44 bg-gradient-to-b from-white/85 via-white/45 to-transparent backdrop-blur-2xl" />

      <nav className="relative z-20 sticky top-0 border-b border-black/5 bg-white/55 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Logo />
          <span className="hidden text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:block">
            Proposta Partners
          </span>
          <a
            href="#aceitar"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-black"
          >
            Ver proposta
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-12">
        <motion.section
          style={heroMotionStyle}
          className="mb-8 rounded-3xl border border-white/80 bg-white/80 p-7 shadow-[0_32px_80px_-54px_rgba(10,20,8,0.7)] backdrop-blur-xl sm:p-10"
        >
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-4xl">
            <motion.div variants={fadeUp} className="mb-5">
              <Tag>
                <Sparkles className="h-3.5 w-3.5" />
                Convite exclusivo Partners
              </Tag>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl font-black tracking-tight text-zinc-900 sm:text-6xl">
              Olá, <span className="text-lime-700">{proposal.client_name}</span>.
              <br />
              Sua agência pode operar em outro nível de entrega.
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Esta proposta Partners foi preparada para escalar sua produção com previsibilidade, padrão visual alto e execução em ritmo de mídia paga.
            </motion.p>

            {proposal.scope && (
              <motion.p variants={fadeUp} className="mt-5 max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm leading-relaxed text-zinc-700">
                {proposal.scope}
              </motion.p>
            )}

            <motion.div variants={stagger} className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div variants={fadeUp} className="rounded-2xl border border-lime-200 bg-gradient-to-br from-lime-100 to-lime-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Investimento</p>
                <p className="mt-1 text-2xl font-black text-lime-700">{priceFormatted}</p>
              </motion.div>

              {proposal.payment_terms && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-white/80 bg-white/80 p-4">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <BadgeCheck className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Condições</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">{proposal.payment_terms}</p>
                </motion.div>
              )}

              {proposal.deadline && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-white/80 bg-white/80 p-4">
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prazo</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">
                    {format(new Date(proposal.deadline + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </motion.div>
              )}

              <motion.div variants={fadeUp} className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Emitida em</p>
                <p className="mt-1 text-sm font-semibold text-zinc-800">{issuedAtText}</p>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.section>

        <RevealSection delay={0.04} className="mb-10 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_26px_60px_-44px_rgba(10,20,8,0.65)] backdrop-blur-xl sm:p-8">
          <div className="mb-5 max-w-2xl">
            <Tag>O que você recebe</Tag>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
              Estrutura de produção pronta para escalar.
            </h2>
            <p className="mt-2 text-sm text-zinc-600 sm:text-base">
              Um conjunto de diferenciais pensado para agências que precisam de constância e velocidade.
            </p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid gap-3 md:grid-cols-2"
          >
            {features.map((feature) => (
              <motion.article
                key={feature.title}
                variants={fadeUp}
                whileHover={reducedMotion ? undefined : { y: -3, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className={`rounded-2xl border border-white/80 bg-gradient-to-br ${feature.color} p-5`}
              >
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/75 text-zinc-700">
                  {feature.icon}
                </div>
                <h3 className="text-sm font-bold text-zinc-900">{feature.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{feature.desc}</p>
              </motion.article>
            ))}
          </motion.div>
        </RevealSection>

        <RevealSection delay={0.08} className="mb-10 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_26px_60px_-44px_rgba(10,20,8,0.65)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            <Tag>Processo</Tag>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">Como funciona na prática</h2>
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid gap-3 md:grid-cols-3"
          >
            {steps.map((step) => (
              <motion.div key={step.n} variants={fadeUp} className="rounded-2xl border border-zinc-200 bg-zinc-50/75 p-5">
                <p className="text-3xl font-black leading-none text-lime-700/40">{step.n}</p>
                <h3 className="mt-3 text-sm font-bold text-zinc-900">{step.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </RevealSection>

        <RevealSection delay={0.12} className="mb-10 rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_26px_60px_-44px_rgba(10,20,8,0.65)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            <Tag>Depoimentos</Tag>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
              Agências validando o modelo
            </h2>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
            className="grid gap-3 md:grid-cols-3"
          >
            {testimonials.map((item) => (
              <motion.article key={item.name} variants={fadeUp} className="rounded-2xl border border-zinc-200 bg-zinc-50/75 p-5">
                <div className="mb-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-lime-500 text-lime-500" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-zinc-600">"{item.text}"</p>
                <p className="mt-3 text-sm font-semibold text-zinc-900">{item.name}</p>
                <p className="text-xs text-zinc-500">{item.role}</p>
              </motion.article>
            ))}
          </motion.div>
        </RevealSection>

        <div id="aceitar">
          <RevealSection delay={0.16} className="rounded-3xl border border-lime-200 bg-lime-50/75 p-6 shadow-[0_26px_60px_-44px_rgba(72,116,14,0.48)] backdrop-blur-xl sm:p-8">
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">Pronto para entrar no programa?</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
              Ao aceitar, você confirma os termos desta proposta e iniciamos o onboarding da sua agência.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white/85 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cliente</span>
                  <span className="text-sm font-semibold text-zinc-900">{proposal.client_name}</span>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Investimento</span>
                  <span className="text-xl font-black text-lime-700">{priceFormatted}</span>
                </div>
                {proposal.payment_terms && (
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pagamento</span>
                    <span className="text-sm text-zinc-700">{proposal.payment_terms}</span>
                  </div>
                )}
                {proposal.deadline && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prazo</span>
                    <span className="text-sm text-zinc-700">
                      {format(new Date(proposal.deadline + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center gap-3">
                <button
                  onClick={() => setConfirming("accepted")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-black"
                >
                  <Check className="h-4 w-4" />
                  Aceitar e entrar no programa
                </button>
                <button
                  onClick={() => setConfirming("rejected")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white px-6 py-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400"
                >
                  <X className="h-4 w-4" />
                  Recusar
                </button>
                <p className="text-xs text-zinc-500">Ao aceitar, você concorda com os termos da proposta.</p>
              </div>
            </div>
          </RevealSection>
        </div>
      </main>

      <footer className="relative z-10 border-t border-black/5 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <Logo />
          <p className="text-xs text-zinc-500">© 2026 SuperElements. Todos os direitos reservados.</p>
        </div>
      </footer>

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
                  ? "Ao confirmar, você aceita formalmente a proposta e entra para o programa Partners."
                  : "Ao confirmar, a proposta será marcada como recusada."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(null)}
                  disabled={acting}
                  className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await handleAction(confirming);
                    setConfirming(null);
                  }}
                  disabled={acting}
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
