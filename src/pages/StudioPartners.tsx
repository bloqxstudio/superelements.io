/**
 * StudioPartners.tsx — Landing page do programa Studio Partners
 * Design: dark, #080808 bg, #C8FF00 lime accent
 * Animações: Framer Motion com scroll-reveal, parallax, counters, tilt, magnetic
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  useSpring,
  animate,
} from "framer-motion";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const LIME = "#C8FF00";
const BG   = "#080808";
const E1   = [0.22, 1, 0.36, 1]          as const; // snappy ease-out
const E2   = [0.25, 0.46, 0.45, 0.94]    as const; // smooth ease

// ─── Shared animation variants ────────────────────────────────────────────────

const vFadeUp = {
  hidden:  { opacity: 0, y: 32, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.7, ease: E1 } },
};
const vStagger = (delay = 0, gap = 0.09) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: gap, delayChildren: delay } },
});
const vScaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: E1 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Scroll-triggered stagger container */
function Reveal({
  children,
  className,
  style,
  delay = 0,
  gap = 0.09,
  amount = 0.12,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  gap?: number;
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={vStagger(delay, gap)}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/** Section label chip */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={vFadeUp}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "5px 14px", borderRadius: 999,
        border: `1px solid ${LIME}30`,
        background: `${LIME}0d`,
        color: LIME, fontSize: 10.5, fontWeight: 700,
        letterSpacing: "0.13em", textTransform: "uppercase",
      }}>
        {children}
      </span>
    </motion.div>
  );
}

/** Word-by-word animated headline */
function SplitHeading({
  text,
  highlight,
  tag: Tag = "h2",
  style,
}: {
  text: string;
  highlight?: string;
  tag?: "h1" | "h2";
  style?: React.CSSProperties;
}) {
  const words = text.split(" ");
  const highlightWords = highlight ? highlight.split(" ") : [];

  return (
    <Tag style={{ margin: 0, ...style }}>
      {words.map((word, i) => {
        const isHighlight = highlightWords.includes(word);
        return (
          <React.Fragment key={i}>
            <motion.span
              variants={{
                hidden:  { opacity: 0, y: 24, filter: "blur(6px)" },
                visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: E1 } },
              }}
              style={{
                display: "inline-block",
                color: isHighlight ? LIME : "inherit",
              }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 && " "}
          </React.Fragment>
        );
      })}
    </Tag>
  );
}

/** Animated number counter */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(count, to, {
      duration: 1.6,
      ease: E2,
      onUpdate(v) {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString("pt-BR") + suffix;
      },
    });
    return ctrl.stop;
  }, [inView, to, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

/** Magnetic button with spring */
function MagBtn({
  children, href, primary = false, className,
}: {
  children: React.ReactNode;
  href: string;
  primary?: boolean;
  className?: string;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 18 });
  const sy = useSpring(my, { stiffness: 220, damping: 18 });

  const onMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width  / 2) * 0.28);
    my.set((e.clientY - r.top  - r.height / 2) * 0.28);
  }, [mx, my]);

  const onLeave = useCallback(() => { mx.set(0); my.set(0); }, [mx, my]);

  return (
    <motion.a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      style={{
        x: sx, y: sy,
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "13px 28px", borderRadius: 999,
        fontSize: 14, fontWeight: 700, textDecoration: "none",
        cursor: "pointer",
        ...(primary
          ? { background: LIME, color: "#000" }
          : { border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)", background: "transparent" }),
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={primary
        ? { scale: 1.05, boxShadow: `0 10px 44px ${LIME}60` }
        : { scale: 1.04, borderColor: "rgba(255,255,255,0.32)", color: "#fff" }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={className}
    >
      {children}
    </motion.a>
  );
}

/** 3-D tilt card on hover */
function TiltCard({
  children, style, className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width  - 0.5;
    const py = (e.clientY - r.top)  / r.height - 0.5;
    ry.set(px *  8);
    rx.set(py * -8);
  }, [rx, ry]);

  const onLeave = useCallback(() => { rx.set(0); ry.set(0); }, [rx, ry]);

  return (
    <motion.div
      style={{ ...style, rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}

/** Subtle film-grain noise overlay */
function Grain() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      pointerEvents: "none", opacity: 0.03,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: "200px",
    }} />
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────

function Header() {
  const { scrollY } = useScroll();
  const bg    = useTransform(scrollY, [0, 80], ["rgba(8,8,8,0)",    "rgba(8,8,8,0.92)"]);
  const blur  = useTransform(scrollY, [0, 80], ["blur(0px)",        "blur(28px)"]);
  const bdr   = useTransform(scrollY, [0, 80], ["rgba(255,255,255,0)", "rgba(255,255,255,0.07)"]);

  return (
    <motion.header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      backgroundColor: bg, backdropFilter: blur,
      borderBottom: "1px solid", borderBottomColor: bdr,
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: E1 }}
          style={{ display: "flex", alignItems: "center", gap: 9 }}
        >
          <motion.span
            animate={{ rotate: [0, 18, -6, 0] }}
            transition={{ duration: 1.4, delay: 1, ease: "easeInOut" }}
            style={{ fontSize: 19 }}
          >⚡</motion.span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.025em" }}>
            SuperElements<span style={{ color: LIME }}>.io</span>
          </span>
        </motion.div>

        {/* Center badge */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="sp-hide-mobile"
          style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          Proposta exclusiva · Ousen
        </motion.span>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: E1 }}
        >
          <motion.a
            href="#pricing"
            whileHover={{ scale: 1.06, boxShadow: `0 6px 30px ${LIME}55` }}
            whileTap={{ scale: 0.95 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 999, background: LIME, color: "#000", fontSize: 12, fontWeight: 800, textDecoration: "none" }}
          >
            Quero ser parceiro
          </motion.a>
        </motion.div>
      </div>
    </motion.header>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { scrollY } = useScroll();
  const glowY  = useTransform(scrollY, [0, 600], [0, 100]);
  const fadeOut = useTransform(scrollY, [0, 500], [1, 0]);

  const words = ["A", "produção", "que", "a", "Ousen", "sempre", "precisou."];
  const highlights = new Set(["Ousen", "precisou."]);

  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "130px 28px 100px" }}>

      {/* Radial glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.2, ease: "easeOut" }}
        style={{ position: "absolute", top: "0%", left: "50%", transform: "translateX(-50%)", width: 900, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse at 50% 20%, ${LIME}14 0%, ${LIME}05 45%, transparent 72%)`, pointerEvents: "none", y: glowY }}
      />

      {/* Dot grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.4 }}
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse 80% 65% at 50% 42%, black 25%, transparent 75%)",
        }}
      />

      <motion.div
        style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", textAlign: "center", opacity: fadeOut }}
        initial="hidden"
        animate="visible"
        variants={vStagger(0, 0.07)}
      >

        {/* Pulsing chip */}
        <motion.div variants={vFadeUp} style={{ marginBottom: 30 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "6px 18px 6px 10px", borderRadius: 999,
            border: `1px solid ${LIME}2a`, background: `${LIME}0c`,
            color: LIME, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            <motion.span
              style={{ width: 7, height: 7, borderRadius: "50%", background: LIME, display: "block", flexShrink: 0 }}
              animate={{ opacity: [1, 0.2, 1], scale: [1, 0.75, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            Ousen · Proposta Studio Partners
          </span>
        </motion.div>

        {/* Headline — 2 linhas fixas */}
        <motion.h1
          variants={vFadeUp}
          style={{ fontSize: "clamp(44px, 7.8vw, 84px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.038em", color: "#fff", margin: "0 0 24px" }}
        >
          Páginas que convertem.{" "}
          <span style={{ color: LIME, position: "relative", display: "inline-block" }}>
            Entregues em 3 dias.
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: 1.2, ease: E2 }}
              style={{ position: "absolute", bottom: 2, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${LIME}00, ${LIME}cc, ${LIME}00)`, borderRadius: 2, transformOrigin: "left" }}
            />
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          variants={vFadeUp}
          style={{ fontSize: "clamp(16px, 2.2vw, 19px)", color: "rgba(255,255,255,0.58)", maxWidth: 540, margin: "0 auto 44px", lineHeight: 1.72 }}
        >
          A Ousen foca nos clientes e nas estratégias.{" "}
          <strong style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>A SuperElements entrega a produção</strong> — com processo, prazo garantido e acompanhamento ativo.
        </motion.p>

        {/* CTAs */}
        <motion.div variants={vFadeUp} style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 52 }}>
          <MagBtn href="#pricing" primary>Ver a proposta → a partir de R$600</MagBtn>
          <MagBtn href="#problema">Entender o contexto</MagBtn>
        </motion.div>

      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
      >
        <span style={{ color: "rgba(255,255,255,0.16)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>scroll</span>
        <div style={{ width: 1, height: 42, background: "rgba(255,255,255,0.1)", overflow: "hidden", borderRadius: 1 }}>
          <motion.div
            style={{ width: "100%", height: "45%", background: `linear-gradient(${LIME}, transparent)` }}
            animate={{ y: ["0%", "230%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}

// ─── STATS STRIP ──────────────────────────────────────────────────────────────

function StatsStrip() {
  const items = [
    { num: 3,    suffix: " dias", label: "prazo médio de entrega" },
    { num: 600,  suffix: "",      label: "R$ fixo por página criada", prefix: "R$" },
    { num: 99,   suffix: "",      label: "R$ acompanhamento/mês", prefix: "R$" },
    { num: 2900, suffix: "+",     label: "componentes Elementor prontos" },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <div ref={ref} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.014)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }} className="sp-stats-grid">
        {items.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: i * 0.1, ease: E1 }}
            style={{ padding: "26px 24px", borderRight: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", textAlign: "center" }}
          >
            <div style={{ color: LIME, fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>
              {s.prefix || ""}{inView ? <Counter to={s.num} suffix={s.suffix} /> : `0${s.suffix}`}
            </div>
            <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12, lineHeight: 1.4 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── PROBLEM ──────────────────────────────────────────────────────────────────

const pains = [
  { icon: "💸", color: "#FF6B6B", title: "Os bons cobram caro e somem", body: "Webdesigners de qualidade têm agenda cheia. Quando precisar de urgência, não estão disponíveis — e o funil fica parado." },
  { icon: "⏳", color: "#FFB347", title: "Os baratos entregam sem processo", body: "Sem briefing estruturado, sem revisão, sem padrão. O resultado é retrabalho e prazo estourado toda vez." },
  { icon: "📊", color: "#60a5fa", title: "Gestão por planilha e WhatsApp", body: "Links salvos em tabelas, histórico perdido em grupos. Ninguém sabe o status real de cada projeto sem perguntar." },
  { icon: "🔗", color: "#c084fc", title: "Zero visibilidade dos projetos", body: "Múltiplos clientes, múltiplas páginas, múltiplas URLs — tudo espalhado. Sem uma visão centralizada de nada." },
];

function ProblemSection() {
  return (
    <section id="problema" style={{ padding: "112px 28px 320px", position: "relative" }}>

      {/* background accent — sem overflow:hidden no pai para não quebrar sticky */}
      <div style={{ position: "absolute", left: "-15%", top: "30%", width: 500, height: 500, borderRadius: "50%", background: "rgba(255,107,107,0.04)", filter: "blur(100px)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 1060, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Sticky 2-col */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }} className="sp-problem-grid">

          {/* LEFT — sticky: funciona porque nenhum ancestral tem overflow:hidden */}
          <div className="sp-problem-sticky" style={{ position: "sticky", top: 100, alignSelf: "start" }}>
            <Reveal>
              <Chip>O problema</Chip>
              <motion.h2
                variants={vFadeUp}
                style={{ fontSize: "clamp(28px, 3.8vw, 44px)", fontWeight: 900, letterSpacing: "-0.034em", lineHeight: 1.08, color: "#fff", margin: "18px 0 20px" }}
              >
                Gerenciar produção <span style={{ color: LIME }}>trava</span> quem deveria só vender.
              </motion.h2>
              <motion.p
                variants={vFadeUp}
                style={{ fontSize: 16, color: "rgba(255,255,255,0.52)", lineHeight: 1.78, marginBottom: 32 }}
              >
                A Ousen fecha contratos, cuida dos funis e dos anúncios. Mas toda vez que um cliente novo assina, começa o mesmo ciclo manual — e a operação trava onde deveria escalar.
              </motion.p>

              {/* Quote inline */}
              <motion.div
                variants={vFadeUp}
                style={{ padding: "18px 20px", borderRadius: 14, border: `1px solid ${LIME}20`, background: `${LIME}07`, position: "relative", overflow: "hidden" }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${LIME}bb, ${LIME}00)`, borderRadius: "3px 0 0 3px" }} />
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.74, fontStyle: "italic", margin: "0 0 12px", paddingLeft: 4 }}>
                  "A operação trava onde deveria escalar."
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${LIME}22`, border: `1px solid ${LIME}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>⚖️</div>
                  <span style={{ color: LIME, fontSize: 11, fontWeight: 700 }}>Ousen · Marketing Jurídico</span>
                </div>
              </motion.div>
            </Reveal>
          </div>

          {/* RIGHT — cards que empilham via sticky: cada card gruda num top diferente */}
          <div style={{ position: "relative" }}>
            {pains.map((p, i) => (
              <div
                key={i}
                style={{
                  position: "sticky",
                  top: 100 + i * 18,
                  zIndex: i + 1,
                  paddingBottom: i < pains.length - 1 ? 18 : 0,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: E1 }}
                  style={{
                    borderRadius: 16,
                    border: `1px solid rgba(255,255,255,${0.09 - i * 0.01})`,
                    background: `rgb(${14 + i * 7}, ${14 + i * 7}, ${14 + i * 7})`,
                    padding: "26px 24px",
                    display: "flex",
                    gap: 18,
                    alignItems: "flex-start",
                    boxShadow: `0 2px 0 rgba(255,255,255,0.05), 0 ${8 + i * 8}px ${32 + i * 12}px rgba(0,0,0,0.6)`,
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${p.color}16`, border: `1px solid ${p.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {p.icon}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>{p.title}</div>
                    <div style={{ color: "rgba(255,255,255,0.54)", fontSize: 13, lineHeight: 1.7 }}>{p.body}</div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── SOLUTION ─────────────────────────────────────────────────────────────────

const solutionCards = [
  { icon: "⚡", color: LIME,      title: "Entrega em 3 dias úteis",      body: "Do briefing à página publicada em 3 dias. Velocidade que mantém seus funis rodando sem travamento." },
  { icon: "📋", color: "#60a5fa", title: "Processo do briefing ao suporte", body: "Etapas claras, responsabilidades definidas. Sem achismo, sem retrabalho por falta de alinhamento." },
  { icon: "📊", color: "#c084fc", title: "Painel centralizado",            body: "Todos os seus clientes e páginas num único lugar. Sem planilha, sem perguntar onde está o link." },
  { icon: "👁️", color: "#fb923c", title: "Acompanhamento ativo diário",   body: "Olhamos os projetos todo dia. Ajustes e correções acontecem antes de você precisar pedir." },
  { icon: "🎯", color: "#34d399", title: "Otimização contínua",           body: "Mantemos a página performando: velocidade, conversão, bugs corrigidos em tempo real." },
  { icon: "🏷️", color: "#f472b6", title: "White label completo",          body: "A entrega é com a sua marca. O cliente sente que é você que produziu tudo." },
];

function SolutionSection() {
  return (
    <section style={{ padding: "112px 28px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "20%", right: "-12%", width: 600, height: 600, borderRadius: "50%", background: `${LIME}05`, filter: "blur(120px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <Reveal style={{ marginBottom: 56 }}>
          <Chip>A solução</Chip>
          <SplitHeading
            text="Processo, velocidade e acompanhamento real."
            highlight="real."
            style={{ fontSize: "clamp(30px, 5.2vw, 56px)", fontWeight: 900, letterSpacing: "-0.036em", lineHeight: 1.06, marginTop: 18, marginBottom: 16, color: "#fff" }}
          />
          <motion.p variants={vFadeUp} style={{ fontSize: 17, color: "rgba(255,255,255,0.56)", maxWidth: 560, lineHeight: 1.72, marginBottom: 0 }}>
            O Studio Partners entra na operação da Ousen sem gerar ruído — e centraliza todos os clientes jurídicos num painel que você entende em 10 segundos.
          </motion.p>
        </Reveal>

        {/* Cards grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.08 }}
          variants={vStagger(0, 0.07)}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 64 }}
          className="sp-cards-grid"
        >
          {solutionCards.map((c, i) => (
            <TiltCard key={i}>
              <motion.div
                variants={vFadeUp}
                whileHover={{ borderColor: `${c.color}55`, background: "rgba(255,255,255,0.035)" }}
                style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", padding: "22px 22px 24px", height: "100%", transition: "background 0.2s, border-color 0.2s" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `${c.color}18`, border: `1px solid ${c.color}2e`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 14 }}>
                  {c.icon}
                </div>
                <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 8, lineHeight: 1.35 }}>{c.title}</h3>
                <p style={{ color: "rgba(255,255,255,0.52)", fontSize: 13, lineHeight: 1.68 }}>{c.body}</p>
              </motion.div>
            </TiltCard>
          ))}
        </motion.div>

        {/* Dashboard */}
        <Dashboard />
      </div>
    </section>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

type NavId = "inicio" | "clientes" | "paginas" | "propostas" | "recursos" | "componentes";

const navItems: { id: NavId; icon: string; label: string }[] = [
  { id: "inicio",      icon: "🏠", label: "Início" },
  { id: "clientes",    icon: "👥", label: "Clientes" },
  { id: "paginas",     icon: "📄", label: "Páginas" },
  { id: "propostas",   icon: "📋", label: "Propostas" },
  { id: "recursos",    icon: "📦", label: "Recursos" },
  { id: "componentes", icon: "🧩", label: "Componentes" },
];

function Dashboard() {
  const [active, setActive] = useState<NavId>("inicio");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 48, scale: 0.98 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.8, ease: E1 }}
      style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", background: "#0d0d0d", boxShadow: `0 60px 160px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px ${LIME}08` }}
    >
      {/* Chrome bar */}
      <div style={{ background: "#191919", padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff5f57","#ffbd2e","#28c840"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "4px 13px", fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
          app.superelements.io/dashboard
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["Compartilhar","•••"].map(l => (
            <div key={l} style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.22)", fontSize: 10 }}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", height: 500 }}>

        {/* Sidebar */}
        <div className="sp-dash-sidebar" style={{ width: 215, background: "#111", borderRight: "1px solid rgba(255,255,255,0.055)", display: "flex", flexDirection: "column", padding: "14px 0", flexShrink: 0 }}>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>⚡</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em" }}>SuperElements</span>
          </div>

          <nav style={{ flex: 1, padding: "0 8px" }}>
            {navItems.map(item => (
              <motion.button
                key={item.id}
                onClick={() => setActive(item.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", color: active === item.id ? LIME : "rgba(255,255,255,0.38)", fontSize: 12.5, fontWeight: active === item.id ? 700 : 400, cursor: "pointer", textAlign: "left", marginBottom: 2, position: "relative" }}
                whileHover={{ backgroundColor: active === item.id ? undefined : `${LIME}09` }}
              >
                {active === item.id && (
                  <motion.span
                    layoutId="sp-nav-pill"
                    style={{ position: "absolute", inset: 0, borderRadius: 8, background: `${LIME}18`, border: `1px solid ${LIME}30` }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  />
                )}
                <span style={{ fontSize: 13, position: "relative", zIndex: 1 }}>{item.icon}</span>
                <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
              </motion.button>
            ))}
          </nav>

          <div style={{ margin: "0 8px", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 4 }}>WORKSPACE ATIVO</div>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Ousen</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <motion.div style={{ width: 6, height: 6, borderRadius: "50%", background: LIME }} animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span style={{ color: LIME, fontSize: 10, fontWeight: 600 }}>Ativo</span>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18, ease: E2 }}>
              {active === "inicio"      && <ScreenInicio />}
              {active === "clientes"    && <ScreenClientes />}
              {active === "paginas"     && <ScreenPaginas />}
              {active === "propostas"   && <ScreenPropostas />}
              {active === "recursos"    && <ScreenRecursos />}
              {active === "componentes" && <ScreenComponentes />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard Screens ────────────────────────────────────────────────────────

function ScreenInicio() {
  const kpis = [
    { label: "Clientes ativos", value: "8",  hi: false },
    { label: "Conectados",      value: "8",  hi: true  },
    { label: "Páginas live",    value: "24", hi: false },
    { label: "Em produção",     value: "3",  hi: false },
  ];
  const rows = [
    { name: "dr-joao-advogados.com.br",   pages: "5 págs.", upd: "Hoje"  },
    { name: "escritorio-silva.com.br",    pages: "3 págs.", upd: "Hoje"  },
    { name: "advocacia-torres.com",       pages: "8 págs.", upd: "Ontem" },
  ];
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Boa tarde, Ousen 👋</div>
        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>Visão geral dos seus projetos ativos no nicho jurídico</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ borderRadius: 10, border: k.hi ? `1px solid ${LIME}44` : "1px solid rgba(255,255,255,0.06)", background: k.hi ? `${LIME}0d` : "rgba(255,255,255,0.02)", padding: "12px 13px" }}>
            <div style={{ color: k.hi ? LIME : "#fff", fontWeight: 900, fontSize: 22, marginBottom: 2 }}>{k.value}</div>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", padding: "13px 15px" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 3 }}>Carteira de Clientes</div>
        <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, marginBottom: 12 }}>Todas as contas operando normalmente</div>
        {rows.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <span style={{ color: "rgba(255,255,255,0.68)", fontSize: 11 }}>{r.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{r.pages}</span>
              <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 10 }}>{r.upd}</span>
              <span style={{ color: LIME, fontSize: 10, fontWeight: 700 }}>● Conectado</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenClientes() {
  const cl = [
    { name: "Dr. João Advogados",         domain: "dr-joao-advogados.com.br", niche: "Dir. Trabalhista", pages: 5, score: "98/100" },
    { name: "Escritório Silva & Assoc.",   domain: "escritorio-silva.com.br",  niche: "Dir. Civil",       pages: 3, score: "94/100" },
    { name: "Advocacia Torres",            domain: "advocacia-torres.com",     niche: "Dir. Criminal",    pages: 8, score: "91/100" },
    { name: "Dra. Camila Mendes",          domain: "camilamendes-adv.com.br",  niche: "Dir. Família",     pages: 2, score: "96/100" },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Carteira de Clientes</div>
          <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, marginTop: 2 }}>8 clientes · todos conectados</div>
        </div>
        <button style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${LIME}44`, background: `${LIME}10`, color: LIME, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Novo</button>
      </div>
      {cl.map(c => (
        <div key={c.name} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", padding: "11px 14px", marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{c.name}</div>
            <div style={{ color: "rgba(255,255,255,0.27)", fontSize: 10, marginTop: 2 }}>{c.domain} · {c.niche}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 10 }}>{c.pages} págs.</span>
            <span style={{ color: LIME, fontSize: 11, fontWeight: 800 }}>{c.score}</span>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: LIME }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreenPaginas() {
  const rows = [
    { name: "Home",                      url: "advocacia-torres.com/",    speed: "97", sc: "#4ade80", status: "Live" },
    { name: "Landing — Dir. Criminal",   url: "/direito-criminal",        speed: "91", sc: "#4ade80", status: "Live" },
    { name: "Landing — Defesa Penal",    url: "/defesa-penal",            speed: "88", sc: "#facc15", status: "Live" },
    { name: "Obrigado — Lead Captado",   url: "/obrigado",                speed: "99", sc: "#4ade80", status: "Live" },
    { name: "Landing — Prisão Flagrante",url: "/prisao-flagrante",        speed: "93", sc: "#4ade80", status: "Live" },
    { name: "Nova página",               url: "—",                        speed: "—",  sc: "rgba(255,255,255,0.2)", status: "Em produção" },
  ];
  return (
    <div>
      <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, marginBottom: 8 }}>Clientes → Advocacia Torres → Páginas</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Advocacia Torres</div>
          <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, marginTop: 2 }}>advocacia-torres.com · 8 páginas · performance média 93/100</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: LIME }} />
          <span style={{ color: LIME, fontSize: 10, fontWeight: 700 }}>Conectado</span>
        </div>
      </div>
      <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: 500 }}>{r.name}</div>
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, marginTop: 1 }}>{r.url}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: r.sc, fontSize: 11.5, fontWeight: 700 }}>{r.speed !== "—" ? `${r.speed}/100` : "—"}</span>
              <span style={{ color: r.status === "Live" ? LIME : "rgba(255,180,50,0.9)", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: r.status === "Live" ? `${LIME}18` : "rgba(255,180,50,0.12)" }}>{r.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenPropostas() {
  const cols = [
    { label: "Em aberto",  color: "#facc15", cards: [{ client: "Dra. Roberta Fonseca", svc: "Landing Dir. Prev.", val: "R$1.800" }] },
    { label: "Em produção",color: "#60a5fa", cards: [{ client: "Advocacia Torres", svc: "Nova landing page", val: "R$600" }, { client: "Dr. João Advogados", svc: "Obrigado + Upsell", val: "R$600" }] },
    { label: "Entregue",   color: LIME,      cards: [{ client: "Escritório Silva", svc: "Home + 2 Landings", val: "R$1.800" }] },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Propostas</div>
          <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, marginTop: 2 }}>Pipeline comercial · 4 propostas ativas</div>
        </div>
        <button style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${LIME}44`, background: `${LIME}10`, color: LIME, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Nova</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {cols.map(col => (
          <div key={col.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9, padding: "0 2px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700 }}>{col.label}</span>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, marginLeft: "auto" }}>{col.cards.length}</span>
            </div>
            {col.cards.map((card, i) => (
              <div key={i} style={{ borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", padding: "10px 12px", marginBottom: 7 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 11.5 }}>{card.client}</div>
                <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 9.5, margin: "3px 0 5px" }}>{card.svc}</div>
                <div style={{ color: col.color, fontWeight: 800, fontSize: 12 }}>{card.val}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenRecursos() {
  const cats = [
    { name: "Templates de Briefing", items: [{ name: "Briefing — Landing Jurídica", type: "PDF", dl: 12 }, { name: "Briefing — Site Institucional", type: "PDF", dl: 7 }, { name: "Checklist de Entrega", type: "PDF", dl: 19 }] },
    { name: "Templates Elementor",   items: [{ name: "Kit Jurídico — Advocacia Criminal", type: "ZIP", dl: 24 }, { name: "Kit Jurídico — Família", type: "ZIP", dl: 18 }, { name: "Kit — Previdenciário", type: "ZIP", dl: 11 }] },
  ];
  return (
    <div>
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, marginBottom: 3 }}>Recursos</div>
      <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, marginBottom: 18 }}>Templates, briefings e arquivos do parceiro</div>
      {cats.map(cat => (
        <div key={cat.name} style={{ marginBottom: 20 }}>
          <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>{cat.name}</div>
          {cat.items.map(item => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 13 }}>{item.type === "PDF" ? "📄" : "📦"}</span>
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 11.5 }}>{item.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9.5 }}>{item.dl} dl</span>
                <span style={{ padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700 }}>{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ScreenComponentes() {
  const [filter, setFilter] = useState("Jurídico");
  const filters = ["Todos","Hero","CTA","Formulários","FAQ","Jurídico"];
  const components = [
    { name: "Hero — Advogado Dark",    cat: "Hero",      bg: "#1a1a1a" },
    { name: "CTA — Consulta Gratuita", cat: "CTA",       bg: "#0f2027" },
    { name: "Form — Lead Jurídico",    cat: "Formulários",bg: "#1a1a2e" },
    { name: "Depoimentos — Ganhos",    cat: "Depoimentos",bg: "#16213e" },
    { name: "FAQ — Dúvidas Jurídicas", cat: "FAQ",       bg: "#0f0f0f" },
    { name: "Área de Prática — Cards", cat: "Jurídico",  bg: "#1c1c1c" },
  ];
  return (
    <div>
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Biblioteca de Componentes</div>
      <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, marginBottom: 12 }}>2.900+ componentes prontos pra usar no Elementor</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 13 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "3px 9px", borderRadius: 999, border: f === filter ? `1px solid ${LIME}55` : "1px solid rgba(255,255,255,0.08)", background: f === filter ? `${LIME}15` : "transparent", color: f === filter ? LIME : "rgba(255,255,255,0.35)", fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {components.map(c => (
          <div key={c.name} style={{ borderRadius: 9, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ height: 52, background: `linear-gradient(135deg, ${c.bg}, rgba(200,255,0,0.05))`, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: `${LIME}07` }} />
            </div>
            <div style={{ padding: "7px 9px", background: "#161616" }}>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9.5, fontWeight: 600 }}>{c.name}</div>
              <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 8.5, marginTop: 1 }}>{c.cat}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROCESS ──────────────────────────────────────────────────────────────────

const steps = [
  { n: "01", title: "Briefing estruturado",  desc: "Formulário direto com tudo que precisamos. Sem reunião longa, sem e-mail perdido." },
  { n: "02", title: "Produção Elementor",    desc: "2.900+ componentes prontos. Rápido, com padrão visual garantido desde o começo." },
  { n: "03", title: "Revisão e ajuste",      desc: "Uma rodada de feedback clara, com escopo definido. Sem voltar à estaca zero." },
  { n: "04", title: "Entrega em 3 dias",     desc: "Página publicada, testada e conectada ao painel. Você apresenta pro cliente." },
  { n: "05", title: "Acompanhamento ativo",  desc: "Monitoramos diariamente. Bugs e otimizações sem você precisar cobrar." },
];

function ProcessSection() {
  return (
    <section style={{ padding: "112px 28px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 350, borderRadius: "50%", background: `${LIME}04`, filter: "blur(110px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 72 }}>
          <Chip>Processo</Chip>
          <SplitHeading
            text="Do briefing ao ar em 5 passos."
            highlight="5"
            style={{ fontSize: "clamp(30px, 5.2vw, 56px)", fontWeight: 900, letterSpacing: "-0.036em", lineHeight: 1.06, marginTop: 18, marginBottom: 14, color: "#fff" }}
          />
          <motion.p variants={vFadeUp} style={{ color: "rgba(255,255,255,0.52)", fontSize: 16, maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>
            Cada projeto segue o mesmo fluxo. Previsível, eficiente e sem surpresas.
          </motion.p>
        </Reveal>

        <div>
          <motion.div
            initial="hidden" whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={vStagger(0, 0.1)}
            style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}
            className="sp-process-grid"
          >
            {steps.map((s, i) => (
              <TiltCard key={i}>
                <motion.div
                  variants={vFadeUp}
                  whileHover={{ borderColor: `${LIME}55`, background: "rgba(255,255,255,0.035)" }}
                  style={{ textAlign: "center", padding: "28px 14px 22px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", cursor: "default" }}
                >
                  <motion.div
                    whileHover={{ scale: 1.12 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    style={{ width: 54, height: 54, borderRadius: "50%", border: `2px solid ${LIME}44`, background: `${LIME}0e`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: LIME, fontWeight: 900, fontSize: 15 }}
                  >
                    {s.n}
                  </motion.div>
                  <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 9, lineHeight: 1.35 }}>{s.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.68 }}>{s.desc}</p>
                </motion.div>
              </TiltCard>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── COMPARISON ───────────────────────────────────────────────────────────────

const compRows: { c: string; s: boolean | string; g: boolean | string; ch: boolean | string }[] = [
  { c: "Entrega em 3 dias",             s: true,       g: false,       ch: false },
  { c: "Preço fixo por projeto",         s: true,       g: "Às vezes",  ch: true },
  { c: "Processo estruturado",           s: true,       g: "Depende",   ch: false },
  { c: "Disponibilidade imediata",       s: true,       g: false,       ch: "Às vezes" },
  { c: "Acompanhamento pós-entrega",     s: true,       g: false,       ch: false },
  { c: "Painel de gestão centralizado",  s: true,       g: false,       ch: false },
  { c: "Sem precisar gerenciar",         s: true,       g: false,       ch: false },
];

function ComparisonSection() {
  function Cell({ val }: { val: boolean | string }) {
    if (val === true) return (
      <motion.span
        initial={{ scale: 0, rotate: -20 }} whileInView={{ scale: 1, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        style={{ color: LIME, fontSize: 18, fontWeight: 900, display: "inline-block" }}
      >✓</motion.span>
    );
    if (val === false) return <span style={{ color: "rgba(255,80,80,0.55)", fontSize: 18, fontWeight: 900 }}>✗</span>;
    return <span style={{ color: "#f5a623", fontSize: 11.5, fontWeight: 700 }}>{val}</span>;
  }

  return (
    <section style={{ padding: "112px 28px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <Reveal style={{ marginBottom: 52 }}>
          <Chip>Comparativo</Chip>
          <SplitHeading
            text="Por que a gente em vez de freelancer?"
            highlight="gente"
            style={{ fontSize: "clamp(28px, 4.8vw, 52px)", fontWeight: 900, letterSpacing: "-0.036em", lineHeight: 1.06, marginTop: 18, marginBottom: 14, color: "#fff" }}
          />
          <motion.p variants={vFadeUp} style={{ color: "rgba(255,255,255,0.54)", fontSize: 16, maxWidth: 520, lineHeight: 1.68 }}>
            Para a Ousen, não é só sobre preço. É sobre previsibilidade, processo e não ter que gerenciar mais uma pessoa por trás de cada cliente jurídico.
          </motion.p>
        </Reveal>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: 0.7, ease: E1 }}
          style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}
        >
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            {["Critério","Studio Partners","Freelancer bom","Freelancer barato"].map((h, i) => (
              <div key={h} style={{ padding: "14px 18px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: i === 1 ? LIME : "rgba(255,255,255,0.28)", textAlign: i === 0 ? "left" : "center", background: i === 1 ? `${LIME}07` : "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", borderLeft: i === 1 ? `1px solid ${LIME}1e` : "none", borderRight: i === 1 ? `1px solid ${LIME}1e` : "none" }}>
                {h}
              </div>
            ))}
          </div>

          {compRows.map((row, i) => (
            <motion.div
              key={row.c}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: E1 }}
              style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: i < compRows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
            >
              <div style={{ padding: "13px 18px", color: "rgba(255,255,255,0.7)", fontSize: 13.5 }}>{row.c}</div>
              {[row.s, row.g, row.ch].map((val, ci) => (
                <div key={ci} style={{ padding: "13px 18px", textAlign: "center", background: ci === 0 ? (i % 2 === 0 ? `${LIME}06` : `${LIME}04`) : (i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent"), borderLeft: ci === 0 ? `1px solid ${LIME}12` : "none", borderRight: ci === 0 ? `1px solid ${LIME}12` : "none" }}>
                  <Cell val={val} />
                </div>
              ))}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── PRICING ─────────────────────────────────────────────────────────────────

function PricingSection() {
  const p1 = [
    "Criação no Elementor com 2.900+ componentes exclusivos",
    "Design responsivo — mobile, tablet e desktop",
    "Revisões inclusas no escopo do projeto",
    "Entrega em até 3 dias úteis",
    "White label — entrega com a sua marca",
  ];
  const p2 = [
    "Monitoramento diário dos projetos ativos",
    "Correção de bugs com atuação rápida",
    "Otimização de performance contínua",
    "Ajustes de copy e design quando necessário",
    "Relatório mensal de métricas",
    "Suporte via WhatsApp com resposta ativa",
    "Acesso ao painel centralizado SuperElements",
  ];

  return (
    <section id="pricing" style={{ padding: "112px 28px", position: "relative" }}>
      <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 800, height: 400, borderRadius: "50%", background: `${LIME}04`, filter: "blur(120px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1020, margin: "0 auto", position: "relative" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 60 }}>
          <Chip>Investimento</Chip>
          <SplitHeading
            text="Preço fixo. Sem surpresas."
            highlight="Sem"
            style={{ fontSize: "clamp(30px, 5.2vw, 56px)", fontWeight: 900, letterSpacing: "-0.036em", lineHeight: 1.06, marginTop: 18, marginBottom: 14, color: "#fff" }}
          />
          <motion.p variants={vFadeUp} style={{ color: "rgba(255,255,255,0.54)", fontSize: 16, maxWidth: 480, margin: "0 auto", lineHeight: 1.68 }}>
            A Ousen sabe exatamente o que vai custar antes de fechar com o cliente. Margem previsível, processo garantido.
          </motion.p>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>

          {/* Plan 1 — destaque */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.7, ease: E1 }}
            style={{ borderRadius: 22, border: `1px solid ${LIME}44`, background: "#0c0c0c", overflow: "hidden", position: "relative" }}
          >
            {/* Top shimmer bar */}
            <div style={{ height: 3, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, ${LIME}, transparent)` }} />
              <motion.div
                animate={{ x: ["-100%","200%"] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)` }}
              />
            </div>

            {/* Internal glow */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.8 }}
              style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 340, height: 220, borderRadius: "50%", background: `${LIME}0b`, filter: "blur(55px)", pointerEvents: "none" }}
            />

            <div style={{ padding: "28px 30px 32px", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <span style={{ padding: "4px 13px", borderRadius: 999, background: `${LIME}18`, border: `1px solid ${LIME}44`, color: LIME, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>⚡ Por projeto</span>
                <span style={{ padding: "4px 11px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600 }}>Mais popular</span>
              </div>

              <h3 style={{ color: "#fff", fontWeight: 900, fontSize: 21, marginBottom: 4 }}>Criação de Página</h3>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 7, margin: "20px 0 7px" }}>
                <span style={{ color: LIME, fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.045em" }}>R$600</span>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, marginBottom: 9 }}>/ página</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 22 }}>Pagamento único · preço fixo independente da complexidade</p>

              {/* Margin callout */}
              <div style={{ padding: "13px 16px", borderRadius: 13, background: `${LIME}0a`, border: `1px solid ${LIME}1e`, marginBottom: 28 }}>
                <p style={{ color: "rgba(255,255,255,0.52)", fontSize: 12.5, lineHeight: 1.68 }}>
                  <span style={{ color: LIME, fontWeight: 700 }}>Margem da Ousen: </span>
                  A Ousen cobra R$1.500 do escritório → paga R$600 → fica com{" "}
                  <strong style={{ color: "#fff", fontWeight: 700 }}>R$900 líquido (60%)</strong> sem produzir nada.
                </p>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 30px", display: "flex", flexDirection: "column", gap: 12 }}>
                {p1.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${LIME}18`, border: `1px solid ${LIME}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ color: LIME, fontSize: 9.5, fontWeight: 900 }}>✓</span>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 13.5, lineHeight: 1.55 }}>{f}</span>
                  </li>
                ))}
              </ul>

              <motion.a
                href="https://wa.me/5551999999999"
                target="_blank" rel="noopener noreferrer"
                whileHover={{ scale: 1.04, boxShadow: `0 10px 48px ${LIME}60` }}
                whileTap={{ scale: 0.97 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", borderRadius: 13, background: LIME, color: "#000", fontSize: 14.5, fontWeight: 800, textDecoration: "none" }}
              >
                💬 Quero começar com a Ousen
              </motion.a>
            </div>
          </motion.div>

          {/* Plan 2 */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.7, delay: 0.12, ease: E1 }}
            style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c", padding: "28px 30px 32px" }}
          >
            <h3 style={{ color: "#fff", fontWeight: 900, fontSize: 21, marginBottom: 6 }}>Acompanhamento Mensal</h3>
            <p style={{ color: "rgba(255,255,255,0.52)", fontSize: 13.5, lineHeight: 1.65, marginBottom: 20 }}>
              A gente fica de olho nos seus projetos diariamente. Ajustes, bugs e otimizações sem você precisar cobrar.
            </p>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 7, marginBottom: 7 }}>
              <span style={{ color: "#fff", fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.045em" }}>R$99</span>
              <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, marginBottom: 8 }}>/ mês</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 12, marginBottom: 28 }}>Até 10 projetos ativos inclusos</p>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 30px", display: "flex", flexDirection: "column", gap: 12 }}>
              {p2.map(f => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 9.5 }}>✓</span>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, lineHeight: 1.55 }}>{f}</span>
                </li>
              ))}
            </ul>

            <motion.a
              href="https://wa.me/5551999999999"
              target="_blank" rel="noopener noreferrer"
              whileHover={{ scale: 1.03, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.09)" }}
              whileTap={{ scale: 0.97 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", borderRadius: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14.5, fontWeight: 700, textDecoration: "none" }}
            >
              💬 Quero o acompanhamento
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const glowScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1.2, 0.7]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.4, 1], [0, 1, 0.3]);

  return (
    <section ref={ref} style={{ padding: "120px 28px 140px", position: "relative", overflow: "hidden", textAlign: "center" }}>
      <motion.div
        style={{ position: "absolute", bottom: "-15%", left: "50%", transform: "translateX(-50%)", width: 800, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse, ${LIME}0b, transparent 68%)`, scale: glowScale, opacity: glowOpacity, pointerEvents: "none" }}
      />
      {/* Horizontal lines */}
      {[-1, 1].map(d => (
        <motion.div key={d}
          initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }}
          viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.3, ease: E2 }}
          style={{ position: "absolute", top: "50%", left: d < 0 ? 0 : "50%", width: "50%", height: 1, background: `linear-gradient(${d < 0 ? "270deg" : "90deg"}, transparent, rgba(255,255,255,0.05))`, transformOrigin: d < 0 ? "right" : "left", pointerEvents: "none" }}
        />
      ))}

      <div style={{ maxWidth: 680, margin: "0 auto", position: "relative" }}>
        <Reveal style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Chip>Ousen · Próximo passo</Chip>
          <motion.h2
            variants={vFadeUp}
            style={{ fontSize: "clamp(34px, 6.5vw, 68px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.03, margin: "24px 0 20px" }}
          >
            Processo real.<br />
            Entrega em <span style={{ color: LIME }}>3 dias.</span>
          </motion.h2>
          <motion.p variants={vFadeUp} style={{ color: "rgba(255,255,255,0.54)", fontSize: 17, lineHeight: 1.72, marginBottom: 42, maxWidth: 480 }}>
            Essa proposta foi feita para a Ousen. Fale com a gente agora e comece o primeiro projeto jurídico ainda essa semana.
          </motion.p>
          <motion.div variants={vFadeUp} style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <MagBtn href="https://wa.me/5551999999999" primary>💬 Falar com a SuperElements</MagBtn>
            <MagBtn href="mailto:contato@superelements.io">✉️ Enviar e-mail</MagBtn>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
      viewport={{ once: true }} transition={{ duration: 0.7 }}
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, maxWidth: 1200, margin: "0 auto" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 17 }}>⚡</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 800, fontSize: 14, letterSpacing: "-0.02em" }}>
          SuperElements<span style={{ color: LIME }}>.io</span>
        </span>
      </div>
      <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 12 }}>Studio Partners · Proposta para Ousen · © 2026</span>
    </motion.footer>
  );
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { overflow-x: hidden; }
  .sp-hide-mobile   { display: block; }
  .sp-stats-grid    { }
  .sp-problem-grid  { }
  .sp-cards-grid    { }
  .sp-process-grid  { }
  .sp-dash-sidebar  { }

  @media (max-width: 900px) {
    .sp-problem-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .sp-problem-sticky { position: static !important; }
    .sp-cards-grid   { grid-template-columns: 1fr 1fr !important; }
    .sp-process-grid { grid-template-columns: repeat(3, 1fr) !important; }
  }
  @media (max-width: 700px) {
    .sp-hide-mobile  { display: none !important; }
    .sp-stats-grid   { grid-template-columns: repeat(2, 1fr) !important; }
    .sp-problem-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .sp-problem-sticky { position: static !important; }
    .sp-cards-grid   { grid-template-columns: 1fr !important; }
    .sp-process-grid { grid-template-columns: 1fr 1fr !important; }
    .sp-dash-sidebar { display: none !important; }
  }
  @media (max-width: 480px) {
    .sp-process-grid { grid-template-columns: 1fr !important; }
    .sp-stats-grid   { grid-template-columns: 1fr 1fr !important; }
  }
`;

// ─── PAGE ROOT ────────────────────────────────────────────────────────────────

export default function StudioPartners() {
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "sp-styles";
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("sp-styles")?.remove(); };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <Grain />
      <Header />
      <Hero />
      <StatsStrip />
      <ProblemSection />
      <SolutionSection />
      <ProcessSection />
      <ComparisonSection />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
