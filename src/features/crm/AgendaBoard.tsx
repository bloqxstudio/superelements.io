import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgendaEvent } from "@/features/crm/googleAgenda";
import { cn } from "@/lib/utils";

/**
 * Quadro da Agenda (2026-11-14, o usuário: "uma visualização de quadro na agenda… ver todos os dias da semana / mês,
 * assim como o Google Agenda"): semana em grade de horas e mês em grade de dias. Clicar num horário vazio cria a
 * reunião naquele horário; clicar num evento abre os detalhes. A semana começa no domingo, como o Google em pt-BR.
 * Horários no fuso do navegador (a equipe está em Brasília).
 */

const DAY = 86_400_000;
const HOUR_PX = 48;
export const keyOf = (d: Date) => d.toLocaleDateString("sv-SE");
export const dateOfKey = (key: string) => new Date(`${key}T00:00:00`);
export const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};
export const startOfWeek = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return addDays(s, -s.getDay());
};
export const startOfMonthGrid = (d: Date) =>
  startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const STATUS: Record<string, string> = {
  accepted: "confirmou",
  declined: "recusou",
  tentative: "talvez",
  needsAction: "sem resposta",
};

/** Os dias (YYYY-MM-DD) que o evento ocupa: dia inteiro vai até o fim (exclusivo); com hora, o dia em que começa. */
function daysOf(e: AgendaEvent): string[] {
  if (!e.allDay) return [keyOf(new Date(e.start))];
  const out: string[] = [];
  for (
    let d = dateOfKey(e.start);
    keyOf(d) < e.end && out.length < 62;
    d = addDays(d, 1)
  )
    out.push(keyOf(d));
  return out.length ? out : [e.start];
}

/** Reunião com cliente (do CRM ou de formulário) ganha a cor de destaque; o resto fica neutro. */
const tone = (e: AgendaEvent) =>
  e.bookingId || e.clients.length
    ? "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100"
    : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100";

export function eventsByDay(events: AgendaEvent[]) {
  const map = new Map<string, AgendaEvent[]>();
  for (const e of events)
    for (const k of daysOf(e)) map.set(k, [...(map.get(k) ?? []), e]);
  for (const list of map.values())
    list.sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
    );
  return map;
}

/** Eventos que se cruzam no mesmo dia dividem a largura (colunas como no Google). */
function layout(list: AgendaEvent[], dayStart: number) {
  const items = list
    .filter((e) => !e.allDay)
    .map((e) => {
      const start = Math.max(Date.parse(e.start), dayStart);
      const end = Math.min(
        Math.max(Date.parse(e.end), start + 15 * 60_000),
        dayStart + DAY,
      );
      return { e, start, end, col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: typeof items = [];
  let clusterEnd = 0;
  const close = () => {
    const n = Math.max(1, ...cluster.map((i) => i.col + 1));
    for (const i of cluster) i.cols = n;
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) close();
    const used = new Set(
      cluster.filter((i) => i.end > item.start).map((i) => i.col),
    );
    let col = 0;
    while (used.has(col)) col++;
    item.col = col;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  close();
  return items;
}

// ---------- semana ----------

export const WeekBoard: React.FC<{
  start: Date;
  events: AgendaEvent[];
  onSlot: (date: string, time: string) => void;
  onOpen: (event: AgendaEvent) => void;
}> = ({ start, events, onSlot, onOpen }) => {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start],
  );
  const byDay = useMemo(() => eventsByDay(events), [events]);
  // Uma área só de rolagem (vertical e lateral): o cabeçalho fica preso no topo e as horas à esquerda
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const today = keyOf(new Date(now));

  useEffect(() => {
    // Abre no começo do expediente (7h), como o Google
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, []);
  useEffect(() => {
    // Tela estreita (a semana rola para o lado): abre já no dia de hoje
    const box = scroller.current;
    const index = days.findIndex((d) => keyOf(d) === keyOf(new Date()));
    if (!box || index < 0 || box.scrollWidth <= box.clientWidth) return;
    box.scrollLeft = ((box.scrollWidth - 52) / 7) * index;
  }, [days]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hasAllDay = days.some((d) =>
    (byDay.get(keyOf(d)) ?? []).some((e) => e.allDay),
  );
  const cols = "grid grid-cols-[52px_repeat(7,minmax(0,1fr))]";

  return (
    <div
      ref={scroller}
      className="max-h-[calc(100vh-260px)] min-h-[420px] overflow-auto rounded-xl border border-gray-200 bg-white"
    >
      <div className="min-w-[720px]">
        <div className="sticky top-0 z-30 bg-white">
          {/* cabeçalho dos dias */}
          <div className={cn(cols, "border-b border-gray-200")}>
            <div className="sticky left-0 z-20 bg-white" />
            {days.map((d) => {
              const k = keyOf(d);
              return (
                <div
                  key={k}
                  className="border-l border-gray-100 py-2 text-center"
                >
                  <div
                    className={cn(
                      "text-[11px] font-medium uppercase",
                      k === today ? "text-violet-700" : "text-gray-500",
                    )}
                  >
                    {WEEKDAYS[d.getDay()]}
                  </div>
                  <div
                    className={cn(
                      "mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg",
                      k === today
                        ? "bg-violet-600 font-semibold text-white"
                        : "text-gray-900",
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* dia inteiro */}
          {hasAllDay && (
            <div className={cn(cols, "border-b border-gray-200")}>
              <div className="sticky left-0 z-20 bg-white py-1 pr-2 text-right text-[10px] text-gray-400">
                dia todo
              </div>
              {days.map((d) => (
                <div
                  key={keyOf(d)}
                  className="flex min-w-0 flex-col gap-0.5 border-l border-gray-100 p-0.5"
                >
                  {(byDay.get(keyOf(d)) ?? [])
                    .filter((e) => e.allDay)
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onOpen(e)}
                        className={cn(
                          "truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium",
                          tone(e),
                        )}
                      >
                        {e.title}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* grade de horas */}
        <div>
          <div
            className={cn(cols, "relative")}
            style={{ height: 24 * HOUR_PX }}
          >
            {/* horas fixas à esquerda quando a semana rola para o lado (celular) */}
            <div className="sticky left-0 z-20 bg-white">
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-gray-400"
                  style={{ top: h * HOUR_PX }}
                >
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>
            {days.map((d) => {
              const k = keyOf(d);
              const dayStart = d.getTime();
              const items = layout(byDay.get(k) ?? [], dayStart);
              const nowTop =
                k === today
                  ? ((now - dayStart) / 60_000) * (HOUR_PX / 60)
                  : null;
              return (
                <div
                  key={k}
                  role="presentation"
                  className="relative cursor-pointer border-l border-gray-100"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(243 244 246) ${HOUR_PX - 1}px, rgb(243 244 246) ${HOUR_PX}px)`,
                  }}
                  onClick={(ev) => {
                    const y =
                      ev.clientY - ev.currentTarget.getBoundingClientRect().top;
                    const minutes = Math.min(
                      23 * 60 + 30,
                      Math.max(0, Math.floor((y / HOUR_PX) * 2) * 30),
                    );
                    onSlot(
                      k,
                      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
                    );
                  }}
                >
                  {items.map(({ e, start, end, col, cols: n }) => {
                    const top = ((start - dayStart) / 60_000) * (HOUR_PX / 60);
                    const height = Math.max(
                      18,
                      ((end - start) / 60_000) * (HOUR_PX / 60) - 2,
                    );
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onOpen(e);
                        }}
                        className={cn(
                          "absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm",
                          tone(e),
                          Date.parse(e.end) < now && "opacity-60",
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${(col / n) * 100}% + 2px)`,
                          width: `calc(${100 / n}% - 4px)`,
                        }}
                        title={`${hhmm(e.start)} – ${hhmm(e.end)} · ${e.title}`}
                      >
                        <span className="block truncate font-medium">
                          {e.title}
                        </span>
                        {height > 30 && (
                          <span className="block truncate opacity-80">
                            {hhmm(e.start)} – {hhmm(e.end)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {nowTop !== null && nowTop >= 0 && nowTop <= 24 * HOUR_PX && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-rose-500"
                      style={{ top: nowTop }}
                    >
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- mês ----------

export const MonthBoard: React.FC<{
  month: Date;
  events: AgendaEvent[];
  onSlot: (date: string, time: string) => void;
  onOpen: (event: AgendaEvent) => void;
  onDay: (date: string) => void;
}> = ({ month, events, onSlot, onOpen, onDay }) => {
  const start = startOfMonthGrid(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = useMemo(() => eventsByDay(events), [events]);
  const today = keyOf(new Date());
  const MAX = 3;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-2 text-center text-[11px] font-medium uppercase text-gray-500"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const k = keyOf(d);
            const list = byDay.get(k) ?? [];
            const other = d.getMonth() !== month.getMonth();
            return (
              <div
                key={k}
                role="presentation"
                onClick={() => onSlot(k, "10:00")}
                className={cn(
                  "min-h-[112px] cursor-pointer border-gray-100 p-1",
                  i % 7 && "border-l",
                  i >= 7 && "border-t",
                  other && "bg-gray-50/60",
                )}
              >
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onDay(k);
                  }}
                  className={cn(
                    "mb-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs hover:bg-gray-100",
                    k === today
                      ? "bg-violet-600 font-semibold text-white hover:bg-violet-700"
                      : other
                        ? "text-gray-400"
                        : "text-gray-800",
                  )}
                  aria-label={`Ver a semana de ${d.toLocaleDateString("pt-BR")}`}
                >
                  {d.getDate() === 1
                    ? d.toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })
                    : d.getDate()}
                </button>
                <div className="flex flex-col gap-0.5">
                  {list.slice(0, MAX).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpen(e);
                      }}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-left text-[11px]",
                        e.allDay
                          ? cn("border font-medium", tone(e))
                          : "text-gray-800 hover:bg-gray-100",
                      )}
                    >
                      {!e.allDay && (
                        <span
                          className={cn(
                            "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
                            e.bookingId || e.clients.length
                              ? "bg-violet-500"
                              : "bg-sky-500",
                          )}
                        />
                      )}
                      {!e.allDay && (
                        <span className="mr-1 tabular-nums text-gray-500">
                          {hhmm(e.start)}
                        </span>
                      )}
                      {e.title}
                    </button>
                  ))}
                  {list.length > MAX && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDay(k);
                      }}
                      className="px-1 text-left text-[11px] font-medium text-gray-500 hover:text-gray-900"
                    >
                      +{list.length - MAX} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- detalhes do evento ----------

export const EventDetails: React.FC<{
  event?: AgendaEvent;
  onClose: () => void;
  onCancel: (event: AgendaEvent) => void;
}> = ({ event: e, onClose, onCancel }) => {
  const guests = e?.attendees.filter((a) => !a.self) ?? [];
  const past = e ? Date.parse(e.end) < Date.now() : false;
  const when = !e
    ? ""
    : e.allDay
      ? dateOfKey(e.start).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })
      : `${new Date(e.start).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · ${hhmm(e.start)} – ${hhmm(e.end)}`;
  return (
    <Dialog open={!!e} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {e && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words pr-6">{e.title}</DialogTitle>
              <DialogDescription className="first-letter:uppercase">
                {when}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              {e.bookingId && (
                <span className="w-fit rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                  Marcada pelo formulário
                </span>
              )}
              {e.clients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {e.clients.map((c) => (
                    <Link
                      key={c.clientId}
                      to={`/crm/clientes/${c.clientId}`}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      {c.name || "Cliente"}
                    </Link>
                  ))}
                </div>
              )}
              {guests.length > 0 && (
                <ul className="grid gap-1">
                  {guests.map((a) => (
                    <li
                      key={a.email}
                      className="flex items-center justify-between gap-3 text-gray-700"
                    >
                      <span className="min-w-0 truncate">
                        {a.name || a.email}
                      </span>
                      {a.status && STATUS[a.status] && (
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            a.status === "accepted"
                              ? "text-emerald-700"
                              : a.status === "declined"
                                ? "text-rose-600"
                                : "text-gray-500",
                          )}
                        >
                          {STATUS[a.status]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {e.location && (
                <p className="break-words text-gray-600">{e.location}</p>
              )}
              {e.description && (
                <p className="whitespace-pre-line break-words text-gray-600">
                  {e.description.replace(/<[^>]+>/g, " ")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {e.meet && !past && (
                  <a
                    href={e.meet}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    <Video className="h-3.5 w-3.5" /> Entrar no Meet
                  </a>
                )}
                {e.link && (
                  <a
                    href={e.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
                  >
                    Abrir no Google <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <DialogFooter>
              {!past && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => onCancel(e)}
                >
                  Cancelar reunião
                </Button>
              )}
              <Button type="button" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
