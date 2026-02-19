import React, { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Star,
  Zap,
  Target,
  Clock,
  Eye,
  Headphones,
  Building2,
} from "lucide-react";

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerFast = {
  visible: { transition: { staggerChildren: 0.07 } },
};

// ─── Reusable Section Wrapper ─────────────────────────────────────────────────

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Tag Component ────────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      variants={fadeUp}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase bg-[hsl(72,89%,55%)]/10 text-[hsl(72,89%,45%)] border border-[hsl(72,89%,55%)]/20"
    >
      {children}
    </motion.span>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={fadeUp} className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-base font-medium text-white group-hover:text-[hsl(72,89%,55%)] transition-colors">
          {q}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-5 h-5 text-white/40 flex-shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-white/50 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-20 pb-24">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-[hsl(72,89%,55%)]/6 blur-[120px]"
        />
      </div>
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative z-10 max-w-4xl mx-auto text-center"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase bg-[hsl(72,89%,55%)]/10 text-[hsl(72,89%,45%)] border border-[hsl(72,89%,55%)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(72,89%,55%)] animate-pulse" />
            Programa de Partners
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6"
        >
          Sua agência entrega mais,{" "}
          <span className="text-[hsl(72,89%,55%)]">sem aumentar</span> a equipe.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          Acesso exclusivo a landing pages de alta conversão por{" "}
          <span className="text-white font-semibold">R$600 por página</span> — feitas para rodar
          tráfego e escalar resultados dos seus clientes.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14"
        >
          <a
            href="#preco"
            className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[hsl(72,89%,55%)] text-black font-bold text-sm hover:bg-[hsl(72,89%,48%)] transition-all hover:gap-3"
          >
            Quero ser Partner
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/10 text-white/70 font-medium text-sm hover:border-white/20 hover:text-white transition-all"
          >
            Ver como funciona
          </a>
        </motion.div>

        <motion.div variants={fadeUp} className="flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {[
              "from-lime-400/40 to-lime-600/20",
              "from-sky-400/40 to-sky-600/20",
              "from-violet-400/40 to-violet-600/20",
              "from-rose-400/40 to-rose-600/20",
            ].map((g, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-full border-2 border-[hsl(240,10%,4%)] bg-gradient-to-br ${g}`}
              />
            ))}
          </div>
          <p className="text-sm text-white/40">
            Já fazemos parte de{" "}
            <span className="text-white font-semibold">+20 agências</span> parceiras
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Feature Cards (visual inspirado na referência) ───────────────────────────

function Features() {
  const cards = [
    {
      color: "bg-[hsl(72,89%,55%)]/8 border-[hsl(72,89%,55%)]/15",
      dot: "bg-[hsl(72,89%,55%)]",
      icon: <Target className="w-4 h-4 text-[hsl(72,89%,55%)]" />,
      title: "Preço exclusivo para parceiros",
      desc: "R$600 por página. Valor fixo, sem renegociação a cada projeto.",
    },
    {
      color: "bg-orange-500/5 border-orange-500/15",
      dot: "bg-orange-400",
      icon: <Zap className="w-4 h-4 text-orange-400" />,
      title: "Foco em conversão",
      desc: "Páginas pensadas para tráfego pago — estrutura, hierarquia e CTA otimizados.",
    },
    {
      color: "bg-violet-500/5 border-violet-500/15",
      dot: "bg-violet-400",
      icon: <Eye className="w-4 h-4 text-violet-400" />,
      title: "White label",
      desc: "Você apresenta como entrega da sua agência. A gente fica nos bastidores.",
    },
    {
      color: "bg-sky-500/5 border-sky-500/15",
      dot: "bg-sky-400",
      icon: <Clock className="w-4 h-4 text-sky-400" />,
      title: "Entrega previsível",
      desc: "Prazo claro, processo definido. Sua agência não fica na mão.",
    },
    {
      color: "bg-rose-500/5 border-rose-500/15",
      dot: "bg-rose-400",
      icon: <Building2 className="w-4 h-4 text-rose-400" />,
      title: "Páginas que funcionam",
      desc: "Até 7 dobras, one-pages e sites simples — sem exagero, com propósito.",
    },
    {
      color: "bg-emerald-500/5 border-emerald-500/15",
      dot: "bg-emerald-400",
      icon: <Headphones className="w-4 h-4 text-emerald-400" />,
      title: "Acompanhamento incluso",
      desc: "Monitoramos performance e conversão — sem custo adicional.",
    },
  ];

  return (
    <section id="diferenciais" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <Section className="text-center mb-16">
          <Tag>Funcionalidades</Tag>
          <motion.h2
            variants={fadeUp}
            className="mt-5 text-4xl md:text-5xl font-black text-white tracking-tight"
          >
            Tudo que criamos{" "}
            <span className="text-[hsl(72,89%,55%)]">pensando em você.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
            De ferramentas ágeis a entregas white label, cada detalhe foi pensado para tornar sua
            operação mais rápida e impactante.
          </motion.p>
        </Section>

        {/* Cards empilhados — coluna direita com stack visual */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Coluna esquerda: descrição */}
          <Section>
            <motion.p variants={fadeUp} className="text-white/50 text-lg leading-relaxed mb-8">
              O SuperElements Partners foi criado para agências que atendem múltiplas contas e
              precisam de agilidade. Nada de retrabalho, briefing confuso ou prazo estourado — só
              páginas prontas para converter.
            </motion.p>
            <motion.div variants={staggerFast} className="flex flex-wrap gap-2">
              {["Entrega ágil", "Preço partner", "Páginas para tráfego", "One-pages simples"].map(
                (p) => (
                  <motion.span
                    key={p}
                    variants={fadeUp}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 text-white/60 bg-white/[0.03]"
                  >
                    {p}
                  </motion.span>
                )
              )}
            </motion.div>
          </Section>

          {/* Coluna direita: cards empilhados com offset visual */}
          <Section className="space-y-3">
            {cards.map((c, i) => (
              <motion.div
                key={c.title}
                variants={fadeUp}
                style={{ marginLeft: `${(i % 3) * 8}px` }}
                whileHover={{ x: 4, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative p-5 rounded-2xl border ${c.color} flex items-start gap-4 cursor-default`}
              >
                <span
                  className={`absolute top-4 right-4 w-2 h-2 rounded-full ${c.dot}`}
                />
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  {c.icon}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5">{c.title}</p>
                  <p className="text-white/40 text-xs leading-relaxed">{c.desc}</p>
                </div>
              </motion.div>
            ))}
          </Section>
        </div>
      </div>
    </section>
  );
}

// ─── Como Funciona ────────────────────────────────────────────────────────────

function ComoFunciona() {
  const steps = [
    {
      n: "01",
      title: "Você indica o cliente",
      desc: "Compartilha o briefing e os objetivos da campanha.",
    },
    {
      n: "02",
      title: "A gente produz",
      desc: "Desenvolvemos a landing page (até 7 dobras) com foco em conversão.",
    },
    {
      n: "03",
      title: "Você entrega",
      desc: "Página pronta para publicar, integrar com a campanha e rodar.",
    },
  ];

  return (
    <section id="como-funciona" className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[hsl(72,89%,55%)]/3 blur-[100px] rounded-full" />
      </div>
      <div className="max-w-5xl mx-auto relative">
        <Section className="text-center mb-16">
          <Tag>Processo</Tag>
          <motion.h2
            variants={fadeUp}
            className="mt-5 text-4xl md:text-5xl font-black text-white tracking-tight"
          >
            Do briefing à página no ar,{" "}
            <span className="text-[hsl(72,89%,55%)]">sem complicação.</span>
          </motion.h2>
        </Section>

        <Section className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div key={s.n} variants={fadeUp} className="relative group">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-white/10 to-transparent z-0" />
              )}
              <div className="relative z-10 p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 h-full">
                <div className="text-5xl font-black text-[hsl(72,89%,55%)]/20 mb-4 font-mono leading-none">
                  {s.n}
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{s.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </Section>
      </div>
    </section>
  );
}

// ─── Depoimentos ──────────────────────────────────────────────────────────────

function Depoimentos() {
  const testimonials = [
    {
      name: "Mariana Costa",
      role: "Fundadora · Agência Impulso",
      text: "Antes eu passava dias tentando entregar uma landing page de qualidade. Hoje é briefing hoje, aprovação amanhã. O programa mudou o ritmo da minha agência.",
      rating: 5,
      gradient: "from-lime-400/30 to-lime-600/10",
    },
    {
      name: "Lucas Ferreira",
      role: "Gestor de Tráfego · Studio F",
      text: "White label funciona perfeitamente. Meus clientes acham que a entrega é da minha equipe — e o resultado em conversão fala por si. Não tem como não indicar.",
      rating: 5,
      gradient: "from-sky-400/30 to-sky-600/10",
    },
    {
      name: "Juliana Ramos",
      role: "CS · Agência Convertex",
      text: "O que mais me surpreende é a consistência. Cada página sai no prazo, no padrão, pronta para rodar tráfego. É exatamente o que uma agência de performance precisa.",
      rating: 5,
      gradient: "from-violet-400/30 to-violet-600/10",
    },
  ];

  return (
    <section id="depoimentos" className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[hsl(72,89%,55%)]/3 blur-[120px] rounded-full" />
      </div>
      <div className="max-w-5xl mx-auto relative">
        <Section className="text-center mb-16">
          <Tag>Depoimentos</Tag>
          <motion.h2
            variants={fadeUp}
            className="mt-5 text-4xl md:text-5xl font-black text-white tracking-tight"
          >
            Agências que cresceram{" "}
            <span className="text-[hsl(72,89%,55%)]">com o programa.</span>
          </motion.h2>
        </Section>

        <Section className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[hsl(72,89%,55%)] text-[hsl(72,89%,55%)]" />
                ))}
              </div>
              <p className="text-white/60 text-sm leading-relaxed flex-1">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.gradient}`}
                />
                <div>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-white/30 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </Section>
      </div>
    </section>
  );
}

// ─── Preço ────────────────────────────────────────────────────────────────────

function Preco() {
  const features = [
    "Páginas de até 7 dobras",
    "Foco em conversão e tráfego",
    "Entrega white label",
    "Acompanhamento de performance incluso",
    "Suporte direto via canal exclusivo",
  ];

  return (
    <section id="preco" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <Section className="text-center mb-16">
          <Tag>Plano Partner</Tag>
          <motion.h2
            variants={fadeUp}
            className="mt-5 text-4xl md:text-5xl font-black text-white tracking-tight"
          >
            Um plano simples.{" "}
            <span className="text-[hsl(72,89%,55%)]">Sem surpresa.</span>
          </motion.h2>
        </Section>

        <Section className="flex justify-center">
          <motion.div variants={fadeUp} className="relative max-w-md w-full">
            <div className="absolute inset-0 rounded-3xl bg-[hsl(72,89%,55%)]/10 blur-2xl scale-110" />
            <div className="relative rounded-3xl border border-[hsl(72,89%,55%)]/20 bg-[hsl(240,10%,5%)] overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[hsl(72,89%,55%)]/0 via-[hsl(72,89%,55%)] to-[hsl(72,89%,55%)]/0" />
              <div className="p-8">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-white mb-1">Partner</h3>
                    <p className="text-white/40 text-sm">
                      Para agências que atendem múltiplos clientes
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[hsl(72,89%,55%)]/10 text-[hsl(72,89%,55%)] border border-[hsl(72,89%,55%)]/20">
                    Exclusivo
                  </span>
                </div>

                <div className="mb-8">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black text-white">R$600</span>
                    <span className="text-white/30 mb-2 text-sm">/ página</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[hsl(72,89%,55%)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[hsl(72,89%,55%)]" />
                      </div>
                      <span className="text-white/60 text-sm">{f}</span>
                    </li>
                  ))}
                </ul>

                <motion.a
                  href="https://wa.me/5511999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-[hsl(72,89%,55%)] text-black font-bold text-sm hover:bg-[hsl(72,89%,48%)] transition-colors"
                >
                  Quero ser Partner
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </motion.a>

                <p className="text-center text-xs text-white/20 mt-4 leading-relaxed">
                  Programa por convite ou aprovação. Vagas limitadas por ciclo.
                </p>
              </div>
            </div>
          </motion.div>
        </Section>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: "Preciso ter volume mínimo de projetos?",
      a: "Não. Você pode começar com um cliente e escalar conforme sua agência cresce.",
    },
    {
      q: "O cliente sabe que vocês produziram?",
      a: "Não, se você preferir. Trabalhamos em modelo white label.",
    },
    {
      q: "Qual o prazo de entrega?",
      a: "Definimos junto no onboarding de cada projeto. Em média, 5 dias úteis após briefing aprovado.",
    },
    {
      q: "O que é o acompanhamento de performance?",
      a: "Monitoramos métricas de conversão da página e compartilhamos insights com você.",
    },
    {
      q: "Como funciona o pagamento?",
      a: "Por página produzida. Você recebe a proposta e aprova antes de qualquer cobrança.",
    },
    {
      q: "Como entro no programa?",
      a: "Preenche o formulário, a gente avalia e entra em contato em até 48h.",
    },
  ];

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <Section className="text-center mb-14">
          <Tag>FAQ</Tag>
          <motion.h2
            variants={fadeUp}
            className="mt-5 text-4xl md:text-5xl font-black text-white tracking-tight"
          >
            Perguntas de quem já{" "}
            <span className="text-[hsl(72,89%,55%)]">considerou entrar.</span>
          </motion.h2>
        </Section>

        <Section>
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden px-6"
          >
            {items.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </motion.div>
        </Section>
      </div>
    </section>
  );
}

// ─── CTA Final ────────────────────────────────────────────────────────────────

function CTAFinal() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[hsl(72,89%,55%)]/5 blur-[120px] rounded-full"
        />
      </div>
      <div className="max-w-3xl mx-auto relative">
        <Section className="text-center">
          <motion.h2
            variants={fadeUp}
            className="text-5xl md:text-6xl font-black text-white leading-tight tracking-tight mb-6"
          >
            Pronto para ter um{" "}
            <span className="text-[hsl(72,89%,55%)]">parceiro de produção?</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-white/40 mb-10 max-w-xl mx-auto">
            Escale as entregas da sua agência sem contratar mais ninguém.
          </motion.p>
          <motion.div variants={fadeUp}>
            <motion.a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[hsl(72,89%,55%)] text-black font-bold text-base hover:bg-[hsl(72,89%,48%)] transition-colors"
            >
              Quero ser Partner
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </motion.a>
          </motion.div>
        </Section>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Partners() {
  return (
    <div className="min-h-screen bg-[hsl(240,10%,3.9%)] text-white overflow-x-hidden">
      <Hero />
      <Features />
      <ComoFunciona />
      <Depoimentos />
      <Preco />
      <FAQ />
      <CTAFinal />
    </div>
  );
}
