#!/usr/bin/env node
// Conector dos agentes do Superelements. Gerado por scripts/connector/build.mjs: não edite aqui.

// scripts/connector/conector.ts
import { randomInt, randomUUID as randomUUID3 } from "node:crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import http from "node:http";
import os2 from "node:os";
import path3 from "node:path";

// src/features/space/chat/protocol.ts
var CHAT_AGENTS = {
  claude: { id: "claude", name: "Claude Code", color: "#D97757", ink: "#FFFFFF" },
  codex: { id: "codex", name: "Codex", color: "#0A0A0A", ink: "#FFFFFF" }
};
var CHAT_AGENT_IDS = Object.keys(CHAT_AGENTS);
var CHAT_EVENTS = {
  hello: "space-chat:hello",
  send: "space-chat:send",
  stop: "space-chat:stop",
  reset: "space-chat:reset",
  state: "space-chat:state",
  cursor: "space-chat:cursor"
};
var chatSession = (projectId, agent, epoch) => `chat-${agent}-${projectId.slice(0, 8)}-${epoch.toString(36)}`;

// scripts/space/chatPlugin.ts
import { execFile, spawn } from "node:child_process";
import { randomUUID as randomUUID2 } from "node:crypto";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import os from "node:os";
import path2 from "node:path";

// scripts/space/vitePlugin.ts
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
var STALE_AFTER = 25e3;
var CALL_TIMEOUT = 3e4;
var LONG_CALLS = /* @__PURE__ */ new Set(["publish", "restore", "wordpress", "approval", "invite", "create"]);
var LONG_TIMEOUT = 28e4;
var OPEN_TIMEOUT = 45e3;
var IDLE_CLOSE = 6 * 6e4;
var ACCOUNT_CALLS = /* @__PURE__ */ new Set(["projects", "create", "open"]);
var READS = /* @__PURE__ */ new Set(["status", "pull", "render", "view", "say", "work", "focus"]);
var WRITES = /* @__PURE__ */ new Set(["apply", "plan", "publish", "restore", "approval", "invite", "wordpress", "brand", "brief", "details"]);
var MAX_STEPS = 40;
var KEEP_FOR = 24 * 60 * 6e4;
var STATE_FILE = ".space/bridge.json";
var AGENTS_FILE = ".space/agentes.json";
var isOpen = (client) => client.socket.readyState === 1;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
var BridgeError = class extends Error {
  constructor(status, message, retry = false) {
    super(message);
    this.status = status;
    this.retry = retry;
  }
};
var sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};
var readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});
var current = null;
var bridgeAddress = () => current;
function spaceBridge() {
  return {
    name: "space-bridge",
    apply: "serve",
    configureServer(server) {
      const token = randomBytes(18).toString("hex");
      const tabs = /* @__PURE__ */ new Map();
      const pending = /* @__PURE__ */ new Map();
      const stateFile2 = path.resolve(server.config.root, STATE_FILE);
      const agentsFile = path.resolve(server.config.root, AGENTS_FILE);
      const lastUse = /* @__PURE__ */ new Map();
      const releasing = /* @__PURE__ */ new Set();
      const agents = /* @__PURE__ */ new Map();
      try {
        const saved = JSON.parse(readFileSync(agentsFile, "utf8"));
        for (const entry of saved) if (Date.now() - entry.lastAt < KEEP_FOR) agents.set(entry.key, entry);
      } catch {
      }
      const liveTabs = () => {
        const now = Date.now();
        for (const [id, tab] of tabs) if (!isOpen(tab.client) || now - tab.seenAt > STALE_AFTER) dropTab(id);
        return [...tabs.values()];
      };
      const people = () => liveTabs().filter((t) => t.info.role !== "worker");
      const byUse = (a, b) => Number(b.info.visible) - Number(a.info.visible) || b.info.activeAt - a.info.activeAt;
      const holders = (projectId) => liveTabs().filter((t) => t.info.projectId === projectId);
      const placeOf = (projectId) => {
        const open = holders(projectId).filter((t) => t.info.ready);
        const person = open.find((t) => t.info.role !== "worker");
        const tab = person ?? open[0];
        return { where: tab ? person ? "canvas" : "background" : null, sync: tab?.info.sync ?? null };
      };
      const payload = () => {
        const list = [...agents.values()].sort((a, b) => b.lastAt - a.lastAt);
        return { at: Date.now(), agents: list.map((entry) => ({ ...entry, ...placeOf(entry.projectId) })) };
      };
      let broadcastTimer;
      let saveTimer;
      const changed = () => {
        broadcastTimer ??= setTimeout(() => {
          broadcastTimer = void 0;
          server.ws.send("space-bridge:agents", payload());
        }, 120);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try {
            mkdirSync(path.dirname(agentsFile), { recursive: true });
            writeFileSync(agentsFile, JSON.stringify([...agents.values()], null, 2));
          } catch {
          }
        }, 1e3);
      };
      const dropTab = (tabId) => {
        const tab = tabs.get(tabId);
        if (!tab) return;
        tabs.delete(tabId);
        if (tab.info.role === "worker" && tab.info.projectId) releasing.delete(tab.info.projectId);
        for (const [requestId, call2] of pending) {
          if (call2.tabId !== tabId) continue;
          pending.delete(requestId);
          clearTimeout(call2.timer);
          call2.reject(new BridgeError(503, "A aba que tinha o projeto aberto fechou no meio do pedido", true));
        }
        changed();
      };
      const release = (projectId) => {
        const worker = holders(projectId).find((t) => t.info.role === "worker");
        if (!worker || releasing.has(projectId)) return;
        const host = worker.info.host && tabs.get(worker.info.host);
        if (!host) return;
        releasing.add(projectId);
        host.client.send("space-bridge:release", { projectId });
      };
      const register = (info, client) => {
        if (!info?.tabId) return;
        if (info.role !== "worker") claim();
        const before = tabs.get(info.tabId)?.info;
        tabs.set(info.tabId, { client, info, seenAt: Date.now() });
        if (info.role === "worker" && info.projectId && !lastUse.has(info.projectId)) lastUse.set(info.projectId, Date.now());
        if (info.role !== "worker" && info.projectId) release(info.projectId);
        if (!before || before.ready !== info.ready || before.projectId !== info.projectId || before.sync !== info.sync) changed();
      };
      server.ws.on("space-bridge:hello", (info, client) => {
        register(info, client);
        client.send("space-bridge:agents", payload());
      });
      server.ws.on("space-bridge:state", register);
      server.ws.on("space-bridge:bye", (data) => {
        if (data?.tabId) dropTab(data.tabId);
      });
      server.ws.on("space-bridge:reply", (data) => {
        const call2 = data?.requestId ? pending.get(data.requestId) : void 0;
        if (!call2) return;
        pending.delete(data.requestId);
        clearTimeout(call2.timer);
        if (data.ok) call2.resolve({ result: data.result, steps: data.steps });
        else call2.reject(Object.assign(new BridgeError(500, data.error || "O Space recusou o pedido", !!data.retry), { steps: data.steps }));
      });
      server.ws.on("space-bridge:dismiss", (data) => {
        for (const [key, entry] of agents) if (key === data?.key || data?.projectId && entry.projectId === data.projectId) agents.delete(key);
        changed();
      });
      const pickTab = (tabId) => {
        if (tabId) return liveTabs().find((t) => t.info.tabId === tabId || t.info.tabId.startsWith(tabId));
        const score = (t) => (t.info.ready ? 4 : 0) + (t.info.projectId ? 2 : 0) + (t.info.visible ? 1 : 0);
        return people().sort((a, b) => score(b) - score(a) || b.info.activeAt - a.info.activeAt)[0];
      };
      const executorFor = async (projectId, { open = true } = {}) => {
        const deadline = Date.now() + OPEN_TIMEOUT;
        let asked = false;
        for (; ; ) {
          const all = holders(projectId);
          const ready2 = all.filter((t) => t.info.ready && !(t.info.role === "worker" && releasing.has(projectId)));
          const tab = ready2.find((t) => t.info.role !== "worker") ?? ready2[0];
          if (tab) return tab;
          const failed = all.find((t) => t.info.failed);
          if (failed && all.every((t) => t.info.failed)) throw new BridgeError(404, failed.info.failed);
          if (!all.length) {
            if (!open) return void 0;
            if (!asked) {
              const host = people().sort(byUse)[0];
              if (!host) throw new BridgeError(409, "Nenhuma aba do Space conectada. Abra o app no preview ou no navegador.");
              host.client.send("space-bridge:spawn", { projectId });
              asked = true;
            }
          }
          if (Date.now() > deadline) throw new BridgeError(504, `O projeto n\xE3o abriu em ${OPEN_TIMEOUT / 1e3} s. Confira o app aberto (login, internet).`);
          await sleep(250);
        }
      };
      const call = (tab, method, params, agent, session) => new Promise((resolve, reject) => {
        const requestId = randomUUID();
        const timeout = LONG_CALLS.has(method) ? LONG_TIMEOUT : CALL_TIMEOUT;
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new BridgeError(504, `O Space n\xE3o respondeu a "${method}" em ${timeout / 1e3} s`));
        }, timeout);
        pending.set(requestId, { tabId: tab.info.tabId, resolve, reject, timer });
        tab.client.send("space-bridge:call", { requestId, method, params, agent, session });
      });
      const callProject = async (projectId, method, params, agent, session) => {
        for (let attempt = 0; ; attempt++) {
          const tab = await executorFor(projectId);
          lastUse.set(projectId, Date.now());
          try {
            return { tab, reply: await call(tab, method, params, agent, session) };
          } catch (error) {
            const again = error instanceof BridgeError && error.retry && (READS.has(method) || error.status !== 503);
            if (!again || attempt > 0) throw error;
            await sleep(400);
          }
        }
      };
      const track = (who, tab, method, params, reply, error) => {
        const projectId = tab.info.projectId;
        if (!who.session || !projectId || method === "view" || method === "render" || ACCOUNT_CALLS.has(method)) return;
        const key = `${who.session}:${projectId}`;
        const now = Date.now();
        let entry = agents.get(key);
        if (!entry) {
          entry = { key, session: who.session, agent: who.agent, projectId, startedAt: now, lastAt: now, state: "working", rev: 0, steps: [] };
          agents.set(key, entry);
        }
        entry.agent = who.agent;
        entry.projectName = tab.info.projectName ?? entry.projectName;
        entry.lastAt = now;
        for (const step of reply?.steps ?? []) if (!entry.steps.some((s) => s.id === step.id)) entry.steps.push(step);
        if (error && WRITES.has(method)) entry.steps.push({ id: randomUUID(), at: now, kind: "error", text: error });
        const p = params ?? {};
        const r = reply?.result ?? {};
        const first = (value) => Array.isArray(value) && typeof value[0] === "string" ? value[0] : void 0;
        if (!error) {
          switch (method) {
            case "work":
              if (p.done) entry.now = void 0;
              else {
                entry.state = "working";
                entry.now = text(p.text, 120) || "Trabalhando";
                entry.pageId = r.pageId ?? entry.pageId;
                entry.sectionId = first(r.sectionIds) ?? entry.sectionId;
              }
              break;
            case "say":
              if (p.kind === "done" || p.kind === "question") {
                entry.state = p.kind;
                entry.now = void 0;
              } else entry.state = "working";
              entry.sectionId = first(r.sectionIds) ?? entry.sectionId;
              break;
            case "apply":
              entry.state = "working";
              entry.rev++;
              entry.pageId = first(r.pageIds) ?? entry.pageId;
              entry.sectionId = Object.keys(r.touched ?? {})[0] ?? entry.sectionId;
              break;
            case "plan":
              entry.state = "working";
              entry.rev++;
              entry.now = "Construindo a p\xE1gina";
              entry.pageId = r.pageId ?? entry.pageId;
              entry.sectionId = r.sections?.[0]?.id ?? entry.sectionId;
              break;
            case "pull": {
              const content = r.content;
              if (content?.length === 1) entry.pageId = content[0].id;
              break;
            }
          }
        }
        if (entry.steps.length > MAX_STEPS) entry.steps = entry.steps.slice(-MAX_STEPS);
        changed();
      };
      server.ws.on(
        "space-bridge:view",
        async (data, client) => {
          if (!data?.requestId || !data.projectId) return;
          try {
            const tab = await executorFor(data.projectId, { open: !!data.open });
            if (!tab) throw new BridgeError(404, "fechado");
            lastUse.set(data.projectId, Date.now());
            const { result } = await call(tab, "view", { page: data.page, section: data.section });
            client.send("space-bridge:view-reply", { requestId: data.requestId, ok: true, result });
          } catch (error) {
            client.send("space-bridge:view-reply", { requestId: data.requestId, ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
      );
      const sweep = setInterval(() => {
        const now = Date.now();
        for (const tab of liveTabs()) {
          const id = tab.info.projectId;
          if (tab.info.role === "worker" && id && now - (lastUse.get(id) ?? now) > IDLE_CLOSE) release(id);
        }
        for (const [key, entry] of agents) if (now - entry.lastAt > KEEP_FOR) agents.delete(key);
      }, 3e4);
      server.httpServer?.on("close", () => clearInterval(sweep));
      server.middlewares.use("/__space", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const given2 = req.headers["x-space-token"] ?? url.searchParams.get("token");
        if (given2 !== token) return sendJson(res, 403, { error: "Chave da ponte errada ou ausente (veja .space/bridge.json)" });
        try {
          if (req.method === "GET" && url.pathname === "/status") {
            return sendJson(res, 200, { tabs: liveTabs().map((t) => t.info), agents: payload().agents });
          }
          if (req.method === "GET" && url.pathname === "/agents") {
            return sendJson(res, 200, payload());
          }
          if (req.method === "POST" && url.pathname === "/release") {
            const { project } = JSON.parse(await readBody(req) || "{}");
            const id = String(project ?? "");
            const worker = holders(id).find((t) => t.info.role === "worker");
            if (!worker) return sendJson(res, 200, { released: false, where: placeOf(id).where });
            release(id);
            const deadline = Date.now() + 25e3;
            while (Date.now() < deadline && holders(id).some((t) => t.info.role === "worker")) await sleep(250);
            return sendJson(res, 200, { released: !holders(id).some((t) => t.info.role === "worker") });
          }
          if (req.method === "POST" && url.pathname === "/call") {
            const body = JSON.parse(await readBody(req) || "{}");
            const { method, params, tab: tabId, project } = body;
            const agent = text(body.agent, 24) || void 0;
            const who = { agent: agent ?? "Agente", session: text(body.session, 120) };
            let tab;
            let reply;
            try {
              if (tabId || !project || ACCOUNT_CALLS.has(method)) {
                tab = pickTab(tabId);
                if (!tab) return sendJson(res, 409, { error: "Nenhuma aba do Space conectada. Abra o app no preview ou no navegador." });
                if (tab.info.projectId) lastUse.set(tab.info.projectId, Date.now());
                reply = await call(tab, method, params, agent, who.session || void 0);
              } else {
                ;
                ({ tab, reply } = await callProject(String(project), method, params, agent, who.session || void 0));
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              if (tab) track(who, tab, method, params, { steps: error.steps }, message);
              return sendJson(res, error instanceof BridgeError ? error.status : 500, { error: message });
            }
            track(who, tab, method, params, reply);
            return sendJson(res, 200, { tab: tab.info, result: reply.result });
          }
          if (req.method === "GET" && url.pathname === "/render") {
            const project = url.searchParams.get("project");
            const params = {
              page: url.searchParams.get("page") ?? void 0,
              sections: url.searchParams.get("sections")?.split(",").filter(Boolean),
              device: url.searchParams.get("device") ?? "desktop",
              // Vídeo: com as animações de entrada e as imagens sem carregamento preguiçoso
              motion: url.searchParams.get("motion") === "play" ? "play" : "static"
            };
            let html;
            if (project && !url.searchParams.get("tab")) {
              html = (await callProject(project, "render", params)).reply.result;
            } else {
              const tab = pickTab(url.searchParams.get("tab") ?? void 0);
              if (!tab) return sendJson(res, 409, { error: "Nenhuma aba do Space conectada" });
              html = (await call(tab, "render", params)).result;
            }
            res.statusCode = 200;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            return res.end(html);
          }
          sendJson(res, 404, { error: `Rota desconhecida: ${req.method} ${url.pathname}` });
        } catch (error) {
          sendJson(res, error instanceof BridgeError ? error.status : 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
      let state = null;
      function claim() {
        if (!state) return;
        try {
          if (JSON.parse(readFileSync(stateFile2, "utf8")).token === token) return;
        } catch {
        }
        mkdirSync(path.dirname(stateFile2), { recursive: true });
        writeFileSync(stateFile2, JSON.stringify(state, null, 2));
      }
      server.httpServer?.on("listening", () => {
        const address = server.httpServer?.address();
        if (!address) return;
        const host = address.address === "127.0.0.1" ? "127.0.0.1" : "localhost";
        state = { url: `http://${host}:${address.port}`, token, pid: process.pid, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
        current = { url: state.url, token };
        claim();
      });
      server.httpServer?.on("close", () => {
        try {
          if (existsSync(stateFile2) && JSON.parse(readFileSync(stateFile2, "utf8")).token === token) rmSync(stateFile2, { force: true });
        } catch {
        }
      });
    }
  };
}

// scripts/space/chatPlugin.ts
var CHAT_FILE = ".space/chat.json";
var SESSIONS_DIR = ".space/sessoes";
var KEEP_MESSAGES = 80;
var MAX_TEXT = 8e3;
var RUN_TIMEOUT = 20 * 6e4;
var OUTSIDE = ["publish", "restore", "approval", "invite", "wp", "new", "open", "close"];
var runKey = (projectId, agent) => `${projectId}:${agent}`;
var clip = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
var short = (value, max = 90) => value.length > max ? `${value.slice(0, max - 1).trimEnd()}\u2026` : value;
var isWindows = process.platform === "win32";
function findBin(id) {
  const fromEnv = process.env[id === "claude" ? "SPACE_CLAUDE_BIN" : "SPACE_CODEX_BIN"]?.trim();
  if (fromEnv) return existsSync2(fromEnv) ? fromEnv : void 0;
  const names = isWindows ? [`${id}.exe`, `${id}.cmd`] : [id];
  for (const dir of (process.env.PATH ?? "").split(path2.delimiter).filter(Boolean)) {
    for (const name of names) {
      const full = path2.join(dir, name);
      if (existsSync2(full)) return full;
    }
  }
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA ?? path2.join(home, "AppData", "Local");
  const roaming = process.env.APPDATA ?? path2.join(home, "AppData", "Roaming");
  const known = id === "claude" ? [path2.join(home, ".local", "bin", isWindows ? "claude.exe" : "claude"), path2.join(roaming, "npm", "claude.cmd")] : [path2.join(local, "Programs", "OpenAI", "Codex", "bin", "codex.exe"), path2.join(roaming, "npm", "codex.cmd"), "/usr/local/bin/codex", "/opt/homebrew/bin/codex"];
  return known.find((file) => existsSync2(file));
}
function launch(bin, args, options) {
  if (isWindows && bin.toLowerCase().endsWith(".cmd")) {
    const quoted2 = [bin, ...args].map((a) => `"${a.replaceAll('"', '\\"')}"`).join(" ");
    return spawn(quoted2, { ...options, shell: true, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  }
  return spawn(bin, args, { ...options, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
}
var versionOf = (bin) => new Promise((resolve) => {
  execFile(
    bin,
    ["--version"],
    { timeout: 8e3, windowsHide: true, shell: isWindows && bin.toLowerCase().endsWith(".cmd") },
    (error, stdout) => resolve(error ? void 0 : stdout.toString().trim().split("\n")[0])
  );
});
function kill(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (isWindows) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else child.kill("SIGTERM");
}
var checking = null;
var checkAgents = () => checking ??= Promise.all(
  CHAT_AGENT_IDS.map(async (id) => {
    const bin = findBin(id);
    if (!bin) return { id, available: false, reason: `${CHAT_AGENTS[id].name} n\xE3o foi encontrado nesta m\xE1quina` };
    const version = await versionOf(bin);
    return version ? { id, available: true, version } : { id, available: false, reason: `${CHAT_AGENTS[id].name} n\xE3o respondeu (${bin})` };
  })
);
var ordinal = (n) => `${n}\xAA`;
function contextLines(context) {
  const lines = [];
  if (context.pageName) lines.push(`- P\xE1gina: ${context.pageName}${context.pageId ? ` (id ${context.pageId})` : ""}`);
  for (const s of context.sections) lines.push(`- Se\xE7\xE3o: "${s.title}" (id ${s.id}${s.index !== void 0 ? `, ${ordinal(s.index + 1)} da p\xE1gina` : ""})`);
  const el = context.element;
  if (el) {
    const owner = context.sections.find((s) => s.id === el.sectionId);
    lines.push(`- Camada: ${el.kind}${el.text ? ` "${short(el.text, 120)}"` : ""} (elemento ${el.elementId}, na se\xE7\xE3o ${owner ? `"${owner.title}"` : el.sectionId})`);
  }
  if (!context.sections.length && !el) lines.push("- Nada selecionado: vale a p\xE1gina acima.");
  return lines;
}
var REPO_GUIDE = "- Siga a skill do cliente (`.claude/skills/cliente/SKILL.md`) e as regras do projeto na se\xE7\xE3o dele no `AGENTS.md` (procure pelo nome do projeto; o arquivo \xE9 grande, leia s\xF3 a se\xE7\xE3o).";
function preamble(projectId, projectName, agent, guide) {
  const name = CHAT_AGENTS[agent].name;
  return [
    `Voc\xEA \xE9 o ${name}, trabalhando no projeto "${projectName ?? projectId}" do Space (id ${projectId}) pelo chat que fica dentro do canvas. Quem pediu est\xE1 olhando o canvas agora: v\xEA o seu cursor e cada mudan\xE7a na hora.`,
    "",
    "Como trabalhar:",
    "- Tudo passa pela ponte: `node scripts/space/space.mjs <comando>`, rodado da raiz do reposit\xF3rio, sempre nessa forma. Esta sess\xE3o j\xE1 est\xE1 ligada ao projeto: n\xE3o use `open`, `new` nem `close`.",
    guide,
    "- Trabalhe s\xF3 no que est\xE1 selecionado (abaixo). N\xE3o varra o site: leia s\xF3 a p\xE1gina da sele\xE7\xE3o (`pull --page <id da p\xE1gina>`) e mude s\xF3 as se\xE7\xF5es e camadas citadas, a n\xE3o ser que o pedido diga outra coisa.",
    '- Mostre onde est\xE1: antes de mexer, `node scripts/space/space.mjs work "<o que est\xE1 fazendo>" --section <id da se\xE7\xE3o>` (com `--element <id>` quando for uma camada). Grave cada mudan\xE7a com `push <arquivo> --label "<o que mudou>"`. Ao terminar, `work --done`.',
    "- Fora deste chat: publicar, voltar vers\xE3o do site, link de aprova\xE7\xE3o, convite e WordPress (`publish`, `restore`, `approval`, `invite`, `wp`). Se o pedido precisar disso, diga e pare.",
    "- N\xE3o use `say`: a resposta vai aqui. Responda em portugu\xEAs, curto: o que mudou e onde (p\xE1gina \u203A se\xE7\xE3o). Se a decis\xE3o for de quem pediu (texto que muda o posicionamento, tirar conte\xFAdo, duas dire\xE7\xF5es), pergunte antes de mudar."
  ].join("\n");
}
function promptFor(payload, first, projectName, guide) {
  const parts = [
    first ? preamble(payload.projectId, projectName, payload.agent, guide) : "",
    "Selecionado no canvas agora:",
    ...contextLines(payload.context),
    "",
    `Pedido: ${payload.text}`
  ];
  return parts.filter((p, i) => p || i > 0).join("\n").trim();
}
var quoted = (args) => args.match(/"([^"]+)"|'([^']+)'/)?.slice(1).find(Boolean);
var flagValue = (args, flag) => args.match(new RegExp(`--${flag}[ =](?:"([^"]+)"|'([^']+)'|(\\S+))`))?.slice(1).find(Boolean);
function bridgeCommand(command) {
  const inner = command.match(/-Command\s+(['"])([\s\S]*)\1\s*$/)?.[2] ?? command;
  const m = inner.match(/space\.mjs["']?\s+([a-z][\w-]*)([\s\S]*)$/);
  return m ? { name: m[1], args: m[2].trim(), inner } : { name: null, args: "", inner };
}
function stepFromCommand(command) {
  const { name, args, inner } = bridgeCommand(command);
  const detail = short(inner.replace(/\s+/g, " "), 160);
  if (!name) {
    if (/space\.mjs["']?\s*$/.test(inner)) return { kind: "read", text: "Vendo os comandos da ponte", detail };
    return { kind: "run", text: short(inner.replace(/\s+/g, " "), 80), detail };
  }
  const label = flagValue(args, "label");
  const map = {
    status: ["canvas", "Olhando o projeto e a sele\xE7\xE3o"],
    pull: ["read", "Lendo a p\xE1gina"],
    push: ["canvas", label ? `Gravando no canvas: ${label}` : "Gravando no canvas"],
    work: ["canvas", /--done/.test(args) ? "Terminando" : quoted(args) ?? "Marcando onde est\xE1 mexendo"],
    plan: ["canvas", "Pondo o plano da p\xE1gina no canvas"],
    build: ["run", "Montando a se\xE7\xE3o com o builder"],
    shot: ["read", "Tirando foto para conferir"],
    video: ["read", "Gravando o v\xEDdeo da p\xE1gina"],
    remove: ["canvas", label ?? "Tirando uma se\xE7\xE3o"],
    move: ["canvas", label ?? "Mudando a ordem das se\xE7\xF5es"],
    "page-add": ["canvas", "Criando uma p\xE1gina"],
    "page-remove": ["canvas", label ?? "Tirando uma p\xE1gina"],
    focus: ["canvas", "Levando o canvas at\xE9 a se\xE7\xE3o"],
    brand: ["canvas", "Olhando a marca do projeto"],
    brief: ["read", "Lendo o briefing"],
    say: ["note", quoted(args) ?? "Escrevendo no painel"]
  };
  const [kind, text2] = map[name] ?? ["run", `space ${name}`];
  return { kind, text: short(text2, 110), detail };
}
function sectionOfFile(root, file) {
  if (typeof file !== "string" || !/\.space[\\/]/.test(file) || !file.endsWith(".json") || /[\\/]_[^\\/]*$/.test(file)) return null;
  try {
    const data = JSON.parse(readFileSync2(path2.resolve(root, file), "utf8"));
    return typeof data?.id === "string" && typeof data.title === "string" ? { id: data.id, title: data.title } : null;
  } catch {
    return null;
  }
}
var baseName = (file) => typeof file === "string" ? path2.basename(file) : "arquivo";
function stepFromTool(root, name, input) {
  if (name === "Bash" || name === "PowerShell") return stepFromCommand(String(input.command ?? ""));
  const file = input.file_path ?? input.notebook_path;
  const section = sectionOfFile(root, file);
  const detail = typeof file === "string" ? path2.relative(root, path2.resolve(root, file)).replaceAll("\\", "/") : void 0;
  switch (name) {
    case "Read":
      return { kind: "read", text: section ? `Lendo a se\xE7\xE3o "${section.title}"` : `Lendo ${baseName(file)}`, detail, sectionId: section?.id };
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "NotebookEdit":
      return { kind: "edit", text: section ? `Editando a se\xE7\xE3o "${section.title}"` : `${name === "Write" ? "Escrevendo" : "Editando"} ${baseName(file)}`, detail, sectionId: section?.id };
    case "Glob":
    case "Grep":
      return { kind: "search", text: `Procurando ${short(String(input.pattern ?? ""), 60)}` };
    case "Skill":
      return { kind: "note", text: `Seguindo a skill ${String(input.skill ?? input.name ?? "")}`.trim() };
    case "TodoWrite":
      return { kind: "note", text: "Organizando os passos" };
    case "Task":
    case "Agent":
      return { kind: "note", text: clip(input.description, 80) || "Chamando um ajudante" };
    default:
      return { kind: "run", text: name };
  }
}
function cursorOf(step) {
  if (step.sectionId) return { mode: step.kind === "edit" ? "edit" : "read", text: step.kind === "edit" ? "Editando" : "Lendo", sectionId: step.sectionId };
  if (step.kind === "read") return { mode: "read", text: step.text };
  if (step.kind === "search") return { mode: "think", text: "Procurando" };
  return null;
}
function spaceChat({ guide = REPO_GUIDE } = {}) {
  return {
    name: "space-chat",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;
      const chatFile = path2.resolve(root, CHAT_FILE);
      const conversations = /* @__PURE__ */ new Map();
      const runs = /* @__PURE__ */ new Map();
      try {
        const saved = JSON.parse(readFileSync2(chatFile, "utf8"));
        for (const item2 of saved) {
          for (const message of item2.messages) if (message.streaming) Object.assign(message, { streaming: false, thinking: false, stopped: true });
          conversations.set(item2.projectId, item2);
        }
      } catch {
      }
      const stored = (projectId, projectName) => {
        let item2 = conversations.get(projectId);
        if (!item2) {
          item2 = { projectId, projectName, messages: [], epoch: Date.now(), resume: {}, updatedAt: Date.now() };
          conversations.set(projectId, item2);
        }
        if (projectName) item2.projectName = projectName;
        return item2;
      };
      const running = (projectId) => CHAT_AGENT_IDS.filter((id) => runs.has(runKey(projectId, id)));
      const view = (item2) => ({
        projectId: item2.projectId,
        projectName: item2.projectName,
        messages: item2.messages,
        running: running(item2.projectId),
        updatedAt: item2.updatedAt,
        epoch: item2.epoch
      });
      let saveTimer;
      const save = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try {
            mkdirSync2(path2.dirname(chatFile), { recursive: true });
            writeFileSync2(chatFile, JSON.stringify([...conversations.values()], null, 2));
          } catch {
          }
        }, 800);
      };
      const broadcast = (item2) => {
        item2.updatedAt = Date.now();
        server.ws.send(CHAT_EVENTS.state, { projectId: item2.projectId, conversation: view(item2) });
        save();
      };
      const pendingMessages = /* @__PURE__ */ new Map();
      let flushTimer;
      const touch = (item2, message) => {
        pendingMessages.set(message.id, { item: item2, message });
        flushTimer ??= setTimeout(() => {
          flushTimer = void 0;
          for (const { item: owner, message: changed } of pendingMessages.values()) {
            owner.updatedAt = Date.now();
            server.ws.send(CHAT_EVENTS.state, { projectId: owner.projectId, message: changed, running: running(owner.projectId), epoch: owner.epoch });
          }
          pendingMessages.clear();
          save();
        }, 70);
      };
      const cursor = (run, hint) => server.ws.send(CHAT_EVENTS.cursor, { projectId: run.projectId, session: run.session, agent: CHAT_AGENTS[run.agent].name, ...hint });
      const appendText = (run, text2) => {
        if (!text2) return;
        const parts = run.message.parts ??= [];
        const last = parts[parts.length - 1];
        if (last?.type === "text") last.text += run.newBlock && last.text ? `

${text2}` : text2;
        else parts.push({ type: "text", text: text2 });
        run.newBlock = false;
        run.message.thinking = false;
      };
      const addStep = (run, key, step, state = "running") => {
        const existing = run.steps.get(key);
        if (existing) return existing;
        const full = { id: key, at: Date.now(), state, ...step };
        run.steps.set(key, full);
        (run.message.parts ??= []).push({ type: "step", step: full });
        run.newBlock = true;
        run.message.thinking = false;
        const hint = cursorOf(full);
        if (hint) cursor(run, hint);
        return full;
      };
      const finishStep = (run, key, ok) => {
        const step = run.steps.get(key);
        if (step && step.state === "running") step.state = ok ? "ok" : "error";
        run.message.thinking = true;
      };
      const item = (run) => conversations.get(run.projectId);
      const onClaude = (run, event) => {
        if (event.parent_tool_use_id) return;
        switch (event.type) {
          case "system":
            if (event.subtype === "init" && event.session_id) item(run).resume.claude = event.session_id;
            return;
          case "stream_event": {
            const e = event.event ?? {};
            if (e.type === "message_start") run.message.thinking = true;
            if (e.type === "content_block_start") {
              if (e.content_block?.type === "text") run.newBlock = true;
              if (e.content_block?.type === "thinking") run.message.thinking = true;
            }
            if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
              run.streamed.add("text");
              appendText(run, e.delta.text);
            }
            return;
          }
          case "assistant": {
            const content = event.message?.content ?? [];
            const sawDeltas = run.streamed.delete("text");
            for (const block of content) {
              if (block.type === "tool_use") addStep(run, block.id, stepFromTool(root, block.name, block.input ?? {}));
              else if (block.type === "text" && !sawDeltas) {
                run.newBlock = true;
                appendText(run, block.text);
              }
            }
            return;
          }
          case "user":
            for (const block of event.message?.content ?? []) {
              if (block.type === "tool_result") finishStep(run, block.tool_use_id, !block.is_error);
            }
            return;
          case "result":
            run.finished = true;
            run.message.durationMs = event.duration_ms;
            run.message.costUsd = event.total_cost_usd;
            if (event.session_id) item(run).resume.claude = event.session_id;
            if (event.is_error || event.subtype && event.subtype !== "success") run.message.error = clip(event.result, 600) || `O ${CHAT_AGENTS.claude.name} parou (${event.subtype})`;
            return;
        }
      };
      const onCodex = (run, event) => {
        const it = event.item ?? {};
        switch (event.type) {
          case "thread.started":
            if (event.thread_id) item(run).resume.codex = event.thread_id;
            return;
          case "turn.started":
            run.message.thinking = true;
            return;
          case "item.started":
            if (it.type === "command_execution") addStep(run, it.id, stepFromCommand(String(it.command ?? "")));
            else if (it.type === "reasoning") run.message.thinking = true;
            return;
          case "item.completed":
            if (it.type === "agent_message") {
              run.newBlock = true;
              appendText(run, String(it.text ?? ""));
            } else if (it.type === "command_execution") {
              addStep(run, it.id, stepFromCommand(String(it.command ?? "")));
              finishStep(run, it.id, it.exit_code === 0 || it.exit_code == null && it.status === "completed");
            } else if (it.type === "file_change") {
              const changes = it.changes ?? [];
              const sections = changes.map((c) => sectionOfFile(root, c.path)).filter(Boolean);
              const text2 = sections.length ? `Editando a se\xE7\xE3o "${sections[0].title}"` : `Editando ${changes.map((c) => baseName(c.path)).join(", ") || "arquivos"}`;
              addStep(run, it.id, { kind: "edit", text: short(text2, 110), detail: changes.map((c) => c.path).join(", "), sectionId: sections[0]?.id }, it.status === "failed" ? "error" : "ok");
            } else if (it.type === "mcp_tool_call" || it.type === "web_search") {
              addStep(run, it.id, { kind: "run", text: it.type === "web_search" ? `Pesquisando ${clip(it.query, 60)}` : `${it.server ?? ""} ${it.tool ?? ""}`.trim() }, "ok");
            } else if (it.type === "error") run.message.error = clip(it.message, 600);
            return;
          case "turn.completed":
            run.finished = true;
            return;
          case "turn.failed":
            run.finished = true;
            run.message.error = clip(event.error?.message, 600) || "O Codex parou com erro";
            return;
          case "error":
            run.message.error = clip(event.message, 600);
            return;
        }
      };
      const start = async (payload) => {
        const text2 = clip(payload.text, MAX_TEXT);
        if (!payload.projectId || !text2 || !CHAT_AGENTS[payload.agent]) return;
        const conversation = stored(payload.projectId, payload.projectName);
        const key = runKey(payload.projectId, payload.agent);
        const info = CHAT_AGENTS[payload.agent];
        const context = { ...payload.context, sections: payload.context?.sections ?? [] };
        conversation.messages.push({ id: randomUUID2(), at: Date.now(), role: "user", agent: payload.agent, text: text2, context });
        const answer = { id: randomUUID2(), at: Date.now(), role: "agent", agent: payload.agent, parts: [], streaming: true, thinking: true };
        conversation.messages.push(answer);
        if (conversation.messages.length > KEEP_MESSAGES) conversation.messages = conversation.messages.slice(-KEEP_MESSAGES);
        const fail = (error) => {
          Object.assign(answer, { streaming: false, thinking: false, error });
          broadcast(conversation);
        };
        if (runs.has(key)) return fail(`O ${info.name} ainda est\xE1 trabalhando no pedido anterior. Espere ou pare antes.`);
        const bin = findBin(payload.agent);
        if (!bin) return fail(`${info.name} n\xE3o foi encontrado nesta m\xE1quina. Instale, ou diga onde est\xE1 em ${payload.agent === "claude" ? "SPACE_CLAUDE_BIN" : "SPACE_CODEX_BIN"}.`);
        const session = chatSession(payload.projectId, payload.agent, conversation.epoch);
        try {
          const sessionsDir = path2.resolve(root, SESSIONS_DIR);
          mkdirSync2(sessionsDir, { recursive: true });
          const binding = { projectId: payload.projectId, projectName: conversation.projectName, agent: info.name, session, at: (/* @__PURE__ */ new Date()).toISOString() };
          writeFileSync2(path2.join(sessionsDir, `${session.replace(/[^\w.-]/g, "_").slice(0, 100)}.json`), `${JSON.stringify(binding, null, 2)}
`);
        } catch (error) {
          return fail(`N\xE3o consegui ligar a sess\xE3o ao projeto: ${error instanceof Error ? error.message : String(error)}`);
        }
        const resume = conversation.resume[payload.agent];
        const prompt = promptFor({ ...payload, text: text2, context }, !resume, conversation.projectName, guide);
        const env = { ...process.env, SPACE_SESSION: session, SPACE_AGENT: info.name, NO_COLOR: "1", FORCE_COLOR: "0" };
        const bridge = bridgeAddress();
        if (bridge) Object.assign(env, { SPACE_BRIDGE_URL: bridge.url, SPACE_BRIDGE_TOKEN: bridge.token });
        for (const k of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "CODEX_THREAD_ID", "CODEX_SESSION_ID", "SPACE_PROJECT"]) delete env[k];
        const space = "node scripts/space/space.mjs";
        const args = payload.agent === "claude" ? [
          "-p",
          "--output-format",
          "stream-json",
          "--verbose",
          "--include-partial-messages",
          "--permission-mode",
          "acceptEdits",
          "--strict-mcp-config",
          "--allowedTools",
          `Bash(${space}:*)`,
          `PowerShell(${space}:*)`,
          "Read",
          "Edit",
          "Write",
          "Glob",
          "Grep",
          "Skill",
          "TodoWrite",
          "--disallowedTools",
          ...OUTSIDE.flatMap((cmd) => [`Bash(${space} ${cmd}:*)`, `PowerShell(${space} ${cmd}:*)`]),
          ...resume ? ["--resume", resume] : []
        ] : [
          // A ponte é um servidor no localhost: o sandbox precisa deixar a rede aberta
          "exec",
          "--json",
          "-s",
          "workspace-write",
          "-c",
          "sandbox_workspace_write.network_access=true",
          "--skip-git-repo-check",
          ...resume ? ["resume", resume, "-"] : ["-"]
        ];
        let child;
        try {
          child = launch(bin, args, { cwd: root, env });
        } catch (error) {
          return fail(`N\xE3o consegui abrir o ${info.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
        const run = {
          projectId: payload.projectId,
          agent: payload.agent,
          child,
          message: answer,
          session,
          startedAt: Date.now(),
          stopped: false,
          finished: false,
          stderr: "",
          timer: setTimeout(() => stop(payload.projectId, payload.agent, "Passou de 20 minutos sem terminar: parei."), RUN_TIMEOUT),
          streamed: /* @__PURE__ */ new Set(),
          newBlock: false,
          steps: /* @__PURE__ */ new Map()
        };
        runs.set(key, run);
        broadcast(conversation);
        const first = context.element?.sectionId ?? context.sections[0]?.id;
        cursor(run, { mode: "arrive", text: "Lendo o pedido", sectionId: first, pageId: context.pageId, elementId: context.element?.elementId });
        child.stdin?.on("error", () => {
        });
        child.stdin?.end(prompt);
        let buffer = "";
        child.stdout?.setEncoding("utf8");
        child.stdout?.on("data", (chunk) => {
          buffer += chunk;
          let nl;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("{")) continue;
            try {
              const event = JSON.parse(line);
              if (payload.agent === "claude") onClaude(run, event);
              else onCodex(run, event);
              touch(conversation, answer);
            } catch {
            }
          }
        });
        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk) => {
          run.stderr = (run.stderr + chunk).slice(-6e3);
        });
        const done = (code2, spawnError) => {
          if (runs.get(key) !== run) return;
          runs.delete(key);
          clearTimeout(run.timer);
          for (const step of run.steps.values()) if (step.state === "running") step.state = run.stopped || code2 ? "error" : "ok";
          answer.streaming = false;
          answer.thinking = false;
          answer.durationMs ??= Date.now() - run.startedAt;
          if (run.stopped) answer.stopped = true;
          else if (spawnError) answer.error = `N\xE3o consegui abrir o ${info.name}: ${spawnError.message}`;
          else if (!run.finished && code2) {
            const reason = run.stderr.split("\n").filter((l) => l.trim() && !/rmcp::|failed to load skill|AuthRequired/.test(l)).slice(-6).join("\n");
            answer.error ??= reason ? short(reason, 600) : `O ${info.name} saiu com o c\xF3digo ${code2}`;
          }
          if (!answer.parts?.length && !answer.error && !answer.stopped) answer.error = `O ${info.name} terminou sem resposta`;
          broadcast(conversation);
          cursor(run, { mode: "done", text: answer.error ? "Parou com erro" : answer.stopped ? "Parado" : "Pronto" });
        };
        child.on("error", (error) => done(1, error));
        child.on("close", (code2) => done(code2));
      };
      const stop = (projectId, agent, note) => {
        const run = runs.get(runKey(projectId, agent));
        if (!run) return;
        run.stopped = true;
        if (note) run.message.error = note;
        kill(run.child);
      };
      server.ws.on(CHAT_EVENTS.hello, async (data, client) => {
        const list = await checkAgents();
        const item2 = data?.projectId ? conversations.get(data.projectId) : void 0;
        client.send(CHAT_EVENTS.state, { projectId: data?.projectId, agents: list, conversation: item2 ? view(item2) : null });
      });
      server.ws.on(CHAT_EVENTS.send, (payload) => void start(payload));
      server.ws.on(CHAT_EVENTS.stop, (data) => {
        if (data?.projectId && data.agent) stop(data.projectId, data.agent);
      });
      server.ws.on(CHAT_EVENTS.reset, (data) => {
        const item2 = data?.projectId ? conversations.get(data.projectId) : void 0;
        if (!item2) return;
        for (const id of CHAT_AGENT_IDS) stop(item2.projectId, id);
        Object.assign(item2, { messages: [], resume: {}, epoch: Date.now() });
        broadcast(item2);
      });
      server.httpServer?.on("close", () => {
        for (const run of runs.values()) kill(run.child);
      });
    }
  };
}

// scripts/connector/conector.ts
var DEFAULT_PORT = 47823;
var PORT_TRIES = 5;
var MAX_WRONG = 20;
var LOCK_FOR = 10 * 6e4;
var MAX_BODY = 60 * 1024 * 1024;
var CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var AGENTS_MD = `# Agentes do Superelements

Pasta do conector do Superelements (ele reescreve este arquivo ao abrir). Aqui o Claude Code ou o Codex trabalham nas p\xE1ginas de um projeto do Space, o canvas do Superelements, aberto no navegador de quem pediu pelo chat.

## Como trabalhar

- Tudo passa por \`node scripts/space/space.mjs <comando>\`, rodado desta pasta. A sess\xE3o j\xE1 vem ligada ao projeto.
- \`status\`: p\xE1ginas, se\xE7\xF5es (com id) e o que est\xE1 selecionado no canvas.
- \`pull --page <id>\`: grava uma se\xE7\xE3o por arquivo em \`.space/<projeto>/<p\xE1gina>/\`. Cada arquivo tem \`title\`, \`data\` e \`elements\` (o JSON nativo do Elementor).
- \`work "<o que est\xE1 fazendo>" --section <id> [--element <id>]\`: mostra no canvas onde voc\xEA est\xE1. \`work --done\` ao terminar.
- Mudar: edite \`elements\` no arquivo (textos e settings), mantendo os ids dos elementos, e grave com \`push <arquivo> --label "<o que mudou>"\`. Cada push \xE9 um passo do Ctrl+Z de quem est\xE1 no canvas.
- Se\xE7\xE3o nova: um arquivo sem \`id\`, com \`title\`, \`place\` (\`{ "after": "<id da se\xE7\xE3o>" }\`) e \`elements\`. Parta de uma se\xE7\xE3o da mesma p\xE1gina, para manter o padr\xE3o.
- \`shot --section <id>\`: foto da se\xE7\xE3o, para conferir antes de entregar.

## Regras

- Mexa s\xF3 no que foi pedido e selecionado. N\xE3o varra o site.
- Nada sai do canvas: n\xE3o use \`publish\`, \`restore\`, \`approval\`, \`invite\` nem \`wp\`.
- N\xE3o invente fatos: pre\xE7os, n\xFAmeros, pr\xEAmios e depoimentos s\xF3 se j\xE1 estiverem na p\xE1gina.
- Responda em portugu\xEAs, curto: o que mudou e onde (p\xE1gina \u203A se\xE7\xE3o).
`;
var GUIDE = "- Siga o `AGENTS.md` desta pasta: como as p\xE1ginas s\xE3o feitas e como gravar.";
var arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : void 0;
};
var major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(`O conector precisa do Node 18 ou mais novo (este \xE9 o ${process.versions.node}). Baixe em https://nodejs.org`);
  process.exit(1);
}
var folder = path3.resolve(arg("pasta") ?? path3.join(os2.homedir(), "superelements-agentes"));
var write = (file, content) => {
  const full = path3.join(folder, file);
  mkdirSync3(path3.dirname(full), { recursive: true });
  writeFileSync3(full, content);
};
write("scripts/space/space.mjs", "#!/usr/bin/env node\n/**\n * Claude ou Codex no Space: l\xEA e muda as p\xE1ginas do projeto aberto no canvas, pela\n * ponte do servidor de dev (scripts/space/vitePlugin.ts). Quem salva na conta\n * \xE9 a aba do Space, com o login de quem est\xE1 nela; cada grava\xE7\xE3o daqui \xE9 um\n * passo do Ctrl+Z no canvas.\n *\n *   node scripts/space/space.mjs status\n *   node scripts/space/space.mjs pull --page Home\n *   node scripts/space/space.mjs push .space/msa/home/03-sobre.json --label \"Sobre mais curto\"\n *\n * Rode sem argumentos para ver todos os comandos.\n */\nimport { spawn } from 'node:child_process'\nimport { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'\nimport { createHash } from 'node:crypto'\nimport os from 'node:os'\nimport path from 'node:path'\nimport { fileURLToPath, pathToFileURL } from 'node:url'\n\nconst ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')\nconst WORK = path.join(ROOT, '.space')\nconst STATE_FILE = path.join(WORK, 'bridge.json')\n\nconst HELP = `Agente no Space (Claude ou Codex) \u2014 trabalhar na p\xE1gina do cliente direto no canvas\n\nV\xE1rios agentes ao mesmo tempo: cada sess\xE3o (Claude ou Codex) trabalha no seu projeto.\n\"open\" liga a sess\xE3o a um projeto; dali em diante os comandos v\xE3o para ele, esteja ele\naberto na tela de algu\xE9m (que v\xEA o agente no canvas) ou em segundo plano. A tela de\nquem acompanha n\xE3o muda. Acompanhe todos em /agentes no app.\n\n  status                          projeto da sess\xE3o, p\xE1ginas, se\xE7\xF5es, o que est\xE1 selecionado e os outros agentes\n  projects                        projetos da conta (e quem est\xE1 trabalhando em cada um)\n  agents                          agentes trabalhando agora, em todos os projetos\n  open <nome|id> [--show]         liga esta sess\xE3o ao projeto e espera ele abrir (em segundo plano,\n                                  se ningu\xE9m o tem aberto); --show tamb\xE9m o mostra na tela do usu\xE1rio\n  new <nome> [--context \"<briefing>\" | --context-file <arquivo>] [--show]\n                                  cria um projeto na conta e liga esta sess\xE3o a ele\n  close                           terminou: o projeto em segundo plano salva e fecha agora (sozinho, fecha\n                                  depois de 6 min sem pedido)\n  brief [--set \"<texto>\" | --file <arquivo>]\n                                  mostra ou troca o briefing do projeto (o campo Contexto)\n  pull [--page <nome>]...         baixa as p\xE1ginas para .space/<projeto>/<p\xE1gina>/ (uma se\xE7\xE3o por arquivo)\n  push <arquivo|pasta>... --label \"<o que mudou>\" [--force] [--no-focus]\n                                  grava no canvas as se\xE7\xF5es alteradas e as novas (um passo do Ctrl+Z)\n  remove <se\xE7\xE3o>... --label \"...\" tira se\xE7\xF5es da p\xE1gina\n  move <se\xE7\xE3o> (--after <se\xE7\xE3o> | --before <se\xE7\xE3o> | --index <n>) [--page <nome>] --label \"...\"\n  page-add <nome> [--label \"...\"] cria uma p\xE1gina no canvas\n  page-remove <nome> --label \"\u2026\"  tira uma p\xE1gina (com as se\xE7\xF5es dela) do canvas\n  plan \"<se\xE7\xE3o>\" \"<se\xE7\xE3o>\"\u2026 (--new <nome da p\xE1gina> | --page <nome> [--after <se\xE7\xE3o>])\n                                  p\xF5e o plano no canvas: se\xE7\xF5es em esqueleto borrado, que ficam n\xEDtidas ao gravar\n  work \"<o que estou fazendo>\" [--section <se\xE7\xE3o>]\u2026 [--page <nome>] [--element <id da camada>] | work --done\n                                  mostra no canvas onde o agente est\xE1 mexendo (borrado com varredura) e leva o\n                                  cursor dele at\xE9 l\xE1 (at\xE9 a camada, se ela estiver selecionada no canvas)\n  build <arquivo.ts> [--out <arquivo.json>] [--page <nome>] [--after <se\xE7\xE3o>]\n                                  gera uma se\xE7\xE3o com os builders do repo (export default: elemento, lista ou {title, elements})\n  say \"<texto>\" [--kind note|question|done] [--section <se\xE7\xE3o>]\n                                  escreve no painel do agente no canvas (nome: SPACE_AGENT, ou detectado)\n  brand [<DESIGN.md>] [--on | --off]\n                                  mostra, grava (e liga) ou liga/desliga a marca do projeto; a anterior fica em .space/<projeto>/marca-anterior.md\n  focus <se\xE7\xE3o> | --page <nome>   leva o canvas at\xE9 a se\xE7\xE3o ou a p\xE1gina\n  shot [--page <nome>] [--section <se\xE7\xE3o>]... [--device desktop|tablet|mobile|all]\n                                  fotos da p\xE1gina (ou das se\xE7\xF5es) como o player mostra, em .space/<projeto>/fotos/\n  video [--page <nome>] [--device desktop|mobile|all] [--pause <s>] [--speed <px/s>] [--out arquivo.mp4]\n                                  v\xEDdeo da p\xE1gina rolando do topo ao fim, com as anima\xE7\xF5es (ffmpeg), em .space/<projeto>/videos/\n\nCom o cliente e o site (falam com a conta e com o WordPress; cada um \xE9 um passo combinado):\n  approval [--page <nome>] [--wait <min>]\n                                  links de aprova\xE7\xE3o e respostas do cliente; --wait espera ele responder \xE0 vers\xE3o atual\n  approval send --page <nome> [--label \"...\"]\n                                  manda a p\xE1gina de agora para o cliente (cria o link ou troca a foto do mesmo link)\n  approval revoke --page <nome>   desativa o link\n  invite | invite create [--label \"<para quem>\"] | invite cancel <id>\n                                  pessoas e convites abertos; convite para editar o projeto junto (uma pessoa, 7 dias)\n  wp                              conex\xE3o com o WordPress e as p\xE1ginas j\xE1 ligadas ao site\n  wp connect <site> [--user <login> --password \"<senha de aplica\xE7\xE3o>\"]\n                                  sem senha: o link para o WordPress aprovar; com ela: grava a conex\xE3o\n  wp pages | wp import <id>...    p\xE1ginas do site; trazer p\xE1ginas do site para o canvas\n  details --page <nome> [--title --slug --seo-title --description --keyword]\n                                  t\xEDtulo, endere\xE7o e SEO que v\xE3o junto ao publicar (--slug= limpa)\n  publish --page <nome> [--live] [--layout canvas|tema] [--overwrite] --yes\n                                  publica no WordPress (p\xE1gina nova vai como rascunho sem --live); sem --yes s\xF3 mostra o que faria\n  restore --page <nome> --yes     volta a p\xE1gina do site para a vers\xE3o de antes da \xFAltima publica\xE7\xE3o daqui\n\n  <se\xE7\xE3o> \xE9 o id (ou o come\xE7o dele), o n\xFAmero na p\xE1gina (\"3\", com --page) ou parte do t\xEDtulo.\n  Op\xE7\xF5es gerais: --project <nome|id> (ou SPACE_PROJECT) usa outro projeto s\xF3 neste comando;\n  --tab <id> escolhe a aba; --json mostra a resposta crua.\n  A sess\xE3o vem de CLAUDE_CODE_SESSION_ID, das vari\xE1veis do Codex ou de SPACE_SESSION; o nome no painel, de SPACE_AGENT.`\n\n// ---------- argumentos ----------\n\nconst argv = process.argv.slice(2)\nconst command = argv.shift()\nconst flags = {}\nconst positional = []\nfor (let i = 0; i < argv.length; i++) {\n  const arg = argv[i]\n  if (!arg.startsWith('--')) {\n    positional.push(arg)\n    continue\n  }\n  const [key, inline] = arg.slice(2).split(/=(.*)/s)\n  const value = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)\n  if (flags[key] === undefined) flags[key] = value\n  else flags[key] = [].concat(flags[key], value)\n}\nconst list = (value) => (value === undefined ? [] : [].concat(value).filter((v) => v !== true))\nconst one = (value) => list(value)[0]\n\n/**\n * Sair com erro sem process.exit na hora: no Windows (Node 24) ele derruba o\n * processo com \"UV_HANDLE_CLOSING\" quando o fetch ainda est\xE1 fechando o socket.\n * O erro sobe at\xE9 a entrada, que define o c\xF3digo de sa\xEDda.\n */\nclass Exit extends Error {\n  constructor(code) {\n    super(`sa\xEDda ${code}`)\n    this.code = code\n  }\n}\nconst quit = (code) => {\n  throw new Exit(code)\n}\nconst fail = (message, code = 1) => {\n  console.error(`\u2716 ${message}`)\n  quit(code)\n}\n\n// ---------- ponte ----------\n\nfunction bridge() {\n  // O chat do canvas diz qual servidor de dev chamou o agente (pode haver mais de um rodando)\n  if (process.env.SPACE_BRIDGE_URL && process.env.SPACE_BRIDGE_TOKEN) return { url: process.env.SPACE_BRIDGE_URL, token: process.env.SPACE_BRIDGE_TOKEN }\n  if (!existsSync(STATE_FILE)) fail('A ponte n\xE3o est\xE1 no ar: o servidor de dev (npm run dev / preview do Ship Studio) precisa estar rodando com o plugin space-bridge.')\n  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))\n}\n\nasync function request(pathname, init = {}) {\n  const { url, token } = bridge()\n  let response\n  try {\n    response = await fetch(`${url}/__space${pathname}`, { ...init, headers: { 'x-space-token': token, 'content-type': 'application/json', ...init.headers } })\n  } catch {\n    fail(`N\xE3o consegui falar com o servidor de dev em ${url}. Ele est\xE1 rodando?`)\n  }\n  const body = await response.json().catch(() => ({}))\n  if (!response.ok) fail(body.error ?? `HTTP ${response.status}`)\n  return body\n}\n\n/**\n * Quem est\xE1 usando a ponte, para o painel do canvas: SPACE_AGENT decide; sem\n * ela, o Claude Code se identifica por CLAUDECODE e o Codex pelas vari\xE1veis CODEX_.\n */\nconst AGENT =\n  process.env.SPACE_AGENT?.trim() ||\n  (process.env.CLAUDECODE ? 'Claude' : Object.keys(process.env).some((k) => k.startsWith('CODEX_')) ? 'Codex' : 'Agente')\n\n/**\n * Cada sess\xE3o do agente (uma conversa do Claude Code ou do Codex) trabalha no\n * seu projeto. Sem uma sess\xE3o conhecida, vale SPACE_SESSION; sen\xE3o, todas as\n * chamadas sem sess\xE3o dividem uma s\xF3.\n */\nconst SESSION =\n  [process.env.SPACE_SESSION, process.env.CLAUDE_CODE_SESSION_ID, process.env.CODEX_THREAD_ID, process.env.CODEX_SESSION_ID]\n    .map((v) => v?.trim())\n    .find(Boolean) ?? `${AGENT.toLowerCase()}-sem-sessao`\nconst SESSION_FILE = path.join(WORK, 'sessoes', `${SESSION.replace(/[^\\w.-]/g, '_').slice(0, 100)}.json`)\n\n/** O projeto em que esta sess\xE3o trabalha (gravado pelo open, pelo new ou pelo primeiro status). */\nconst readBinding = () => {\n  try {\n    return JSON.parse(readFileSync(SESSION_FILE, 'utf8'))\n  } catch {\n    return null\n  }\n}\nconst writeBinding = (project) => {\n  mkdirSync(path.dirname(SESSION_FILE), { recursive: true })\n  writeFileSync(SESSION_FILE, `${JSON.stringify({ projectId: project.id, projectName: project.name, agent: AGENT, session: SESSION, at: new Date().toISOString() }, null, 2)}\\n`)\n}\n\n/** Projeto deste comando: --project, SPACE_PROJECT ou o da sess\xE3o. Sem nenhum, a tela de quem usa o app. */\nlet target = null\n\nconst call = async (method, params = {}) =>\n  (await request('/call', { method: 'POST', body: JSON.stringify({ method, params, tab: one(flags.tab), agent: AGENT, session: SESSION, project: flags.tab ? undefined : target?.id }) })).result\n\n/** Um projeto da conta pelo nome (ou parte dele) ou pelo id. */\nasync function findProject(ref) {\n  const { projects } = await call('projects')\n  const lower = String(ref).toLowerCase()\n  const exact = projects.filter((p) => p.id === ref || p.name.toLowerCase() === lower)\n  const matches = exact.length ? exact : projects.filter((p) => p.id.startsWith(ref) || p.name.toLowerCase().includes(lower) || slug(p.name) === slug(ref))\n  if (matches.length !== 1) fail(matches.length ? `Mais de um projeto: ${matches.map((p) => p.name).join(', ')}` : `Projeto n\xE3o encontrado: ${ref}. Projetos: ${projects.map((p) => p.name).join(', ')}`)\n  return matches[0]\n}\n\nasync function resolveTarget() {\n  const ref = one(flags.project) ?? process.env.SPACE_PROJECT?.trim()\n  if (ref) {\n    const project = await findProject(ref)\n    target = { id: project.id, name: project.name, from: 'flag' }\n    return\n  }\n  const binding = readBinding()\n  if (binding?.projectId) target = { id: binding.projectId, name: binding.projectName, from: 'session' }\n}\n\n/** Primeiro comando de uma sess\xE3o sem projeto: ela fica no projeto da tela de quem usa o app. */\nfunction bindFromStatus(status) {\n  if (target || flags.tab || !status.ready || !status.project) return\n  writeBinding(status.project)\n  target = { id: status.project.id, name: status.project.name, from: 'session' }\n  console.error(`\u2139 Esta sess\xE3o (${AGENT}) ficou no projeto ${status.project.name}: os pr\xF3ximos comandos v\xE3o para ele, mesmo que a tela mude. Para trocar: open <projeto>.`)\n}\n\n/** Outros agentes que mexeram no mesmo projeto h\xE1 pouco: a prote\xE7\xE3o do push vale entre eles, mas \xE9 bom saber. */\nasync function othersIn(projectId) {\n  const { agents } = await request('/agents').catch(() => ({ agents: [] }))\n  return agents.filter((a) => a.projectId === projectId && a.session !== SESSION && a.state === 'working' && Date.now() - a.lastAt < 10 * 60_000)\n}\n\n// ---------- utilidades ----------\n\nexport const slug = (name) =>\n  String(name)\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, '-')\n    .replace(/^-|-$/g, '') || 'pagina'\n\nconst pad = (n) => String(n).padStart(2, '0')\nconst localHash = (section) => createHash('sha1').update(JSON.stringify([section.title, section.elements, section.data ?? {}])).digest('hex').slice(0, 12)\nconst shortenDataUrls = (text) =>\n  text.replace(/data:[a-z]+\\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{120,}/gi, (m) => `data:\u2026(${Math.round(m.length / 1024)} KB, encurtado)`)\nconst readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))\nconst writeJson = (file, value) => {\n  mkdirSync(path.dirname(file), { recursive: true })\n  writeFileSync(file, `${JSON.stringify(value, null, 2)}\\n`)\n}\nconst rel = (file) => path.relative(ROOT, file).replaceAll('\\\\', '/')\n\n/** Clientes com marca e builder no repo. O nome do projeto no Space decide qual. */\nconst CLIENTS = [\n  { match: /process\\s*base/i, brand: 'brands/processbase', builder: 'src/features/processbase/elementor.ts', scope: 'ProcessBase model' },\n  { match: /\\bmsa\\b|marketing\\s*sem\\s*ag/i, brand: 'brands/marketing-sem-agencia', builder: 'src/features/msa', scope: 'MSA \u2014 Marketing sem Ag\xEAncia model' },\n  { match: /j[u\xFA]nior/i, brand: 'brands/junior-automaticos', builder: 'src/features/junior/elementor.ts', scope: 'J\xFAnior Autom\xE1ticos model' },\n  { match: /caramelo|petshop/i, brand: 'brands/caramelo-pet', builder: 'src/features/petshop/elementor.ts', scope: 'Caramelo Pet model (petshop example)' },\n  { match: /inpel/i, brand: 'brands/inpel', builder: 'src/features/inpel/elementor.ts', scope: 'Inpel model' },\n  { match: /zelo/i, brand: 'public/zelo', builder: 'src/features/zelo/elementor.ts', scope: 'Zelo model' },\n  { match: /leo\\s*scherer/i, brand: 'brands/leo-scherer', builder: 'src/features/leoscherer', scope: 'Leo Scherer model' },\n  { match: /evermind/i, brand: 'public/brands/evermind', builder: 'src/features/evermind', scope: 'Evermind experiment (BYQ evermind-hero-2)' },\n  { match: /skiper/i, brand: 'src/features/skiper', builder: 'src/features/skiper/elementor.ts', scope: 'Skiper UI experiment (effects lab)' },\n  { match: /super\\s*elements/i, brand: 'brands/superelements', builder: 'src/features/superelements', scope: 'Superelements model (our own product page)' },\n  // Prospectos de S\xE3o Leopoldo (RS), 2026-10-03: redesign para vender, ainda n\xE3o s\xE3o clientes\n  { match: /baldez/i, brand: 'brands/baldez-moreira', builder: 'src/features/baldezmoreira/elementor.ts', scope: 'Baldez & Moreira model (prospect)' },\n  { match: /fonseca/i, brand: 'brands/fonseca-lorenco', builder: 'src/features/fonsecalorenco/elementor.ts', scope: 'Fonseca & Loren\xE7o model (prospect)' },\n  { match: /macarthy/i, brand: 'brands/macarthy-scherer', builder: 'src/features/macarthyscherer/elementor.ts', scope: 'Macarthy Scherer model (prospect)' },\n  { match: /braggio|cerveira/i, brand: 'brands/cerveira-braggio', builder: 'src/features/cerveirabraggio/elementor.ts', scope: 'Cerveira Braggio model (prospect)' },\n  // O est\xFAdio do usu\xE1rio, que vende o servi\xE7o de sites (2026-10-04)\n  { match: /avence/i, brand: 'brands/avence-studio', builder: 'src/features/avence/elementor.ts', scope: 'Avence Studio model (our studio)' },\n  // Advogados de S\xE3o Leopoldo que anunciam no Google (2026-10-04)\n  { match: /reche\\s*becker|emmanuel\\s*becker/i, brand: 'brands/emmanuel-reche-becker', builder: 'src/features/rechebecker/elementor.ts', scope: 'Emmanuel Reche Becker model (prospect)' },\n  { match: /depizzol|cassel\\s*martins|\\bdacm\\b/i, brand: 'brands/dacm-advogados', builder: 'src/features/dacm/elementor.ts', scope: 'DACM Advogados model (prospect)' },\n  { match: /stemmer/i, brand: 'brands/stemmer-advogados', builder: 'src/features/stemmer/elementor.ts', scope: 'Stemmer Advogados model (prospect)' },\n  { match: /bordinh/i, brand: 'brands/ferreira-bordinhao', builder: 'src/features/ferreirabordinhao/elementor.ts', scope: 'Ferreira & Bordinh\xE3o model (prospect)' },\n  { match: /katia\\s*paix/i, brand: 'brands/katia-paixao', builder: 'src/features/katiapaixao/elementor.ts', scope: 'Katia Paix\xE3o model (prospect)' },\n]\nconst clientOf = (name = '') => CLIENTS.find((c) => c.match.test(name))\n\nconst projectDir = (project) => path.join(WORK, slug(project?.name ?? 'projeto'))\n\n/** Se\xE7\xE3o do status a partir do id, come\xE7o do id, n\xFAmero na p\xE1gina ou parte do t\xEDtulo. */\nfunction resolveSection(status, ref, pageRef) {\n  if (!ref) fail('Diga qual se\xE7\xE3o')\n  const pages = pageRef ? [resolvePage(status, pageRef)] : status.pages\n  const all = pages.flatMap((p) => p.sections.map((s) => ({ ...s, page: p }))).concat(pageRef ? [] : status.loose.map((s) => ({ ...s, page: null })))\n  // \"3\" com uma p\xE1gina s\xF3 em jogo \xE9 a posi\xE7\xE3o, mesmo que algum id comece com 3\n  if (/^\\d{1,3}$/.test(ref) && pages.length === 1) {\n    const hit = pages[0].sections[Number(ref) - 1]\n    if (hit) return { ...hit, page: pages[0] }\n  }\n  const byId = all.filter((s) => s.id === ref || s.id.startsWith(ref))\n  if (byId.length === 1) return byId[0]\n  const lower = ref.toLowerCase()\n  const byTitle = all.filter((s) => s.title.toLowerCase().includes(lower))\n  if (byTitle.length === 1) return byTitle[0]\n  fail(byTitle.length > 1 ? `\"${ref}\" serve para mais de uma se\xE7\xE3o: ${byTitle.map((s) => `${s.title} (${s.id.slice(0, 8)})`).join(', ')}` : `Se\xE7\xE3o n\xE3o encontrada: ${ref}`)\n}\n\nfunction resolvePage(status, ref) {\n  if (!ref) return status.pages.find((p) => p.id === status.activePageId) ?? status.pages[0]\n  const lower = String(ref).toLowerCase()\n  const page =\n    status.pages.find((p) => p.id === ref || p.id.startsWith(ref)) ??\n    status.pages.find((p) => p.name.toLowerCase() === lower) ??\n    status.pages.find((p) => slug(p.name) === slug(ref))\n  if (!page) fail(`P\xE1gina n\xE3o encontrada: ${ref}. P\xE1ginas: ${status.pages.map((p) => p.name).join(', ')}`)\n  return page\n}\n\nasync function readyStatus() {\n  const status = await call('status')\n  if (!status.ready) fail(status.project ? `O projeto ${status.project.name} ainda est\xE1 abrindo; tente de novo.` : 'Nenhum projeto aberto no Space. Pe\xE7a para abrir um, ou use \"open <nome>\".')\n  bindFromStatus(status)\n  return status\n}\n\n/** Em segundo plano n\xE3o h\xE1 canvas aberto, e o Ctrl+Z de quem abrir depois n\xE3o alcan\xE7a a mudan\xE7a. */\nconst undoHint = (status) =>\n  status.where === 'background' ? 'Feito em segundo plano: para desfazer, grave de novo a vers\xE3o anterior (pull, editar, push).' : 'Ctrl+Z no Space desfaz.'\n\nconst STATE_LABEL = { working: 'trabalhando', question: 'esperando resposta', done: 'terminou' }\nconst agentLine = (a) => {\n  const idle = a.state === 'working' && Date.now() - a.lastAt > 5 * 60_000\n  const where = a.where === 'canvas' ? 'no canvas' : a.where === 'background' ? 'em segundo plano' : 'fechado'\n  return `${a.agent} em ${a.projectName ?? a.projectId.slice(0, 8)} (${idle ? 'parado' : STATE_LABEL[a.state]}, ${where}, ${ago(a.lastAt)})${a.now && !idle ? `: ${a.now}` : ''}`\n}\nconst ago = (at) => {\n  const minutes = Math.round((Date.now() - at) / 60_000)\n  return minutes < 1 ? 'agora' : minutes < 60 ? `h\xE1 ${minutes} min` : `h\xE1 ${Math.round(minutes / 60)} h`\n}\n\n// ---------- comandos ----------\n\nasync function cmdStatus() {\n  const { tabs, agents = [] } = await request('/status')\n  if (!tabs.length) fail('Nenhuma aba do Space conectada. Abra o app no preview do Ship Studio ou no navegador (npm run dev).')\n  const status = await call('status')\n  bindFromStatus(status)\n  if (flags.json) return console.log(JSON.stringify({ tabs, agents, session: SESSION, target, status }, null, 2))\n\n  const people = tabs.filter((t) => t.role !== 'worker')\n  const background = tabs.filter((t) => t.role === 'worker')\n  if (people.length > 1) console.log(`Telas abertas: ${people.map((t) => `${t.tabId.slice(0, 6)} ${t.projectName ?? t.url}${t.visible ? '' : ' (aba escondida)'}`).join(' \xB7 ')}`)\n  if (background.length) console.log(`Em segundo plano: ${background.map((t) => `${t.projectName ?? t.projectId?.slice(0, 8)}${t.ready ? '' : ' (abrindo)'}`).join(', ')}`)\n  const others = agents.filter((a) => a.session !== SESSION && Date.now() - a.lastAt < 60 * 60_000 && a.state !== 'done')\n  if (others.length) console.log(`Outros agentes: ${others.map(agentLine).join(' \xB7 ')}`)\n  if (!status.project) return console.log(`Aba em ${status.route}: nenhum projeto aberto. Escolha um com: open <projeto> (projetos: node scripts/space/space.mjs projects)`)\n  const screen = people.find((t) => t.visible && t.projectId) ?? people.find((t) => t.projectId)\n  console.log(`Sess\xE3o: ${AGENT} \xB7 ${target ? `trabalha em ${status.project.name}` : 'sem projeto'} \xB7 ${status.where === 'background' ? 'em segundo plano (ningu\xE9m est\xE1 com ele aberto na tela)' : 'aberto na tela do usu\xE1rio (ele v\xEA no canvas)'}`)\n  if (screen && screen.projectId !== status.project.id) console.log(`A tela do usu\xE1rio est\xE1 em ${screen.projectName ?? screen.url}. Se o pedido \xE9 sobre ela: open \"${screen.projectName ?? screen.projectId}\".`)\n  console.log(`Projeto: ${status.project.name}  (${status.project.id})${status.ready ? '' : '  \xB7 ainda abrindo'}`)\n  if (!status.ready) return\n  const client = clientOf(status.project.name)\n  console.log(`Marca no Space: ${status.brand.name ?? 'nenhuma'}${status.brand.enabled ? '' : ' (desligada)'}${client ? `  \xB7 no repo: ${client.brand} \xB7 builder: ${client.builder} \xB7 AGENTS.md: \"${client.scope}\"` : ''}`)\n  if (status.project.context?.trim()) console.log(`Briefing: ${status.project.context.trim().replace(/\\s+/g, ' ').slice(0, 220)}${status.project.context.length > 220 ? '\u2026' : ''}`)\n  console.log(`Tela no canvas: ${status.device} \xB7 n\xEDvel: ${status.editLevel}`)\n  console.log('')\n  const selected = new Set(status.selection.sectionIds)\n  for (const page of status.pages) {\n    const active = page.id === status.activePageId ? '  \u2190 ativa' : ''\n    const wp = page.wordpress ? `  \xB7 WordPress: ${page.wordpress.link ?? page.wordpress.siteUrl}` : ''\n    console.log(`\u25B8 ${page.name}  (${page.sections.length} se\xE7\xF5es, ${page.id.slice(0, 8)})${active}${wp}`)\n    for (const s of page.sections) {\n      const marks = [selected.has(s.id) && 'SELECIONADA', s.fromSite && 'do site', !s.valid && 'JSON inv\xE1lido', s.sourceId].filter(Boolean)\n      console.log(`   ${pad(s.index + 1)}. ${s.title}  \xB7  ${s.id.slice(0, 8)}${marks.length ? `  [${marks.join(', ')}]` : ''}`)\n    }\n  }\n  if (status.loose.length) console.log(`\u25B8 Soltas no canvas: ${status.loose.map((s) => `${s.title} (${s.id.slice(0, 8)})`).join(', ')}`)\n  const el = status.selection.element\n  if (el) {\n    const section = status.pages.flatMap((p) => p.sections).find((s) => s.id === el.sectionId)\n    console.log(`\\nCamada escolhida: ${el.label ?? el.widgetType ?? el.elType} (${el.elementId}) em \"${section?.title ?? el.sectionId}\"${el.text ? `: \"${el.text}\"` : ''}`)\n  } else if (selected.size) console.log(`\\nSelecionadas: ${status.selection.sectionIds.length}`)\n}\n\nasync function cmdProjects() {\n  const { projects, status } = await call('projects')\n  if (flags.json) return console.log(JSON.stringify(projects, null, 2))\n  if (!projects.length) return console.log(status === 'ready' ? 'A conta n\xE3o tem projetos.' : 'A lista de projetos ainda n\xE3o carregou nesta aba (abra a tela de Projetos).')\n  const { agents } = await request('/agents').catch(() => ({ agents: [] }))\n  const busy = (id) => agents.filter((a) => a.projectId === id && a.state !== 'done' && Date.now() - a.lastAt < 10 * 60_000)\n  for (const p of projects) {\n    const here = busy(p.id)\n    const who = here.length ? `  \xB7  agora: ${here.map((a) => (a.session === SESSION ? `${a.agent} (esta sess\xE3o)` : a.agent)).join(', ')}` : ''\n    console.log(`${p.name}  \xB7  ${p.pages} p\xE1g., ${p.sections} se\xE7\xF5es  \xB7  ${p.id}${p.role === 'editor' ? '  (compartilhado)' : ''}${who}`)\n  }\n}\n\nasync function cmdAgents() {\n  const { agents } = await request('/agents')\n  if (flags.json) return console.log(JSON.stringify(agents, null, 2))\n  const recent = agents.filter((a) => Date.now() - a.lastAt < 3 * 60 * 60_000)\n  if (!recent.length) return console.log('Nenhum agente trabalhou nas \xFAltimas 3 horas.')\n  for (const a of recent) {\n    const last = a.steps[a.steps.length - 1]\n    console.log(`${a.session === SESSION ? '\u25B8 ' : '  '}${agentLine(a)}${a.session === SESSION ? '  \u2190 esta sess\xE3o' : ''}`)\n    if (last) console.log(`    \xFAltimo: ${last.text}`)\n  }\n}\n\n/**\n * Liga esta sess\xE3o ao projeto e espera ele abrir: na tela de quem j\xE1 o tem\n * aberto, ou em segundo plano. A tela do usu\xE1rio n\xE3o muda (a n\xE3o ser com --show).\n */\nasync function bindAndOpen(project, { show = false, created = false } = {}) {\n  writeBinding(project)\n  target = { id: project.id, name: project.name, from: 'session' }\n  for (const other of await othersIn(project.id)) console.log(`Aten\xE7\xE3o: ${agentLine(other)}. Combine com o usu\xE1rio quem mexe em qu\xEA; o push recusa mudan\xE7a sobre leitura antiga.`)\n  if (show) {\n    const { tab } = await request('/call', { method: 'POST', body: JSON.stringify({ method: 'open', params: { projectId: project.id }, tab: one(flags.tab), agent: AGENT, session: SESSION }) })\n    process.stdout.write(`${created ? `Projeto ${project.name} criado (${project.id}). ` : ''}Abrindo ${project.name} na tela do usu\xE1rio\u2026`)\n    await waitOpen(tab, project.id)\n  } else {\n    process.stdout.write(`${created ? `Projeto ${project.name} criado (${project.id}). ` : ''}Abrindo ${project.name}\u2026`)\n    const status = await call('status')\n    console.log(status.where === 'background' ? ' pronto, em segundo plano (a tela do usu\xE1rio n\xE3o mudou).' : ' pronto, na tela do usu\xE1rio (ele acompanha no canvas).')\n  }\n  console.log(`Esta sess\xE3o (${AGENT}) trabalha em ${project.name}: os pr\xF3ximos comandos v\xE3o para ele. O usu\xE1rio acompanha em /agentes.`)\n}\n\n/** Terminou: o projeto em segundo plano salva e fecha agora (sozinho, fecharia depois de alguns minutos parado). */\nasync function cmdClose() {\n  if (!target) fail('Esta sess\xE3o n\xE3o est\xE1 em nenhum projeto.')\n  const { released, where } = await request('/release', { method: 'POST', body: JSON.stringify({ project: target.id }) })\n  if (released) console.log(`\u2714 ${target.name} salvou e fechou em segundo plano. A sess\xE3o continua nele: o pr\xF3ximo comando abre de novo.`)\n  else console.log(where === 'canvas' ? `${target.name} est\xE1 aberto na tela do usu\xE1rio: fica como est\xE1.` : `${target.name} n\xE3o estava aberto em segundo plano.`)\n}\n\nasync function cmdOpen() {\n  const ref = positional.join(' ')\n  if (!ref) fail('Diga o nome ou o id do projeto')\n  await bindAndOpen(await findProject(ref), { show: !!flags.show })\n}\n\n/** Cria o projeto na conta (nome e briefing, como o bot\xE3o Novo projeto) e liga esta sess\xE3o a ele. */\nasync function cmdNew() {\n  const name = positional.join(' ').trim()\n  if (!name) fail('Diga o nome do projeto')\n  const { projects } = await call('projects')\n  if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) fail(`J\xE1 existe um projeto \"${name}\". Use: open ${name}`)\n  const file = one(flags['context-file'])\n  const context = file ? readFileSync(file, 'utf8') : (one(flags.context) ?? '')\n  const { project } = await call('create', { name, context, open: false })\n  await bindAndOpen(project, { show: !!flags.show, created: true })\n}\n\nasync function waitOpen(tab, projectId) {\n  for (let i = 0; i < 60; i++) {\n    await new Promise((r) => setTimeout(r, 1000))\n    const { tabs } = await request('/status').catch(() => ({ tabs: [] }))\n    if (tabs.some((t) => t.tabId === tab.tabId && t.projectId === projectId && t.ready)) {\n      console.log(' pronto.')\n      return\n    }\n  }\n  fail('O projeto n\xE3o abriu em 60 s. Confira o preview (login, internet).')\n}\n\nasync function cmdPull() {\n  await readyStatus()\n  await pullPages(list(flags.page))\n}\n\n/** Baixa as p\xE1ginas (por nome ou id; nenhuma = todas) para .space/<projeto>/. */\nasync function pullPages(pageRefs) {\n  const data = await call('pull', { pages: pageRefs })\n  const dir = projectDir(data.project)\n  const client = clientOf(data.project.name)\n\n  const lines = [\n    `# ${data.project.name}`,\n    '',\n    `- Projeto no Space: \\`${data.project.id}\\` (${data.project.role === 'editor' ? 'compartilhado comigo' : 'dono'})`,\n    client && `- No repo: marca \\`${client.brand}\\` (DESIGN.md e COPY.md), builder \\`${client.builder}\\`, regras em AGENTS.md \u203A ${client.scope}`,\n    `- Marca no Space: ${data.brand.name ?? 'nenhuma'}${data.brand.enabled ? '' : ' (desligada)'} \u2014 texto em \\`marca.md\\``,\n    `- Lido em ${new Date().toLocaleString('pt-BR')}`,\n    '',\n    '## P\xE1ginas',\n    ...data.pages.map((p) => `- ${p.name} \u2014 ${p.sections.length} se\xE7\xF5es${p.wordpress ? ` \xB7 publica em ${p.wordpress.link ?? p.wordpress.siteUrl}` : ''}`),\n    '',\n    '## Briefing do projeto',\n    '',\n    data.project.context?.trim() || '_(vazio no Space)_',\n    '',\n  ].filter((l) => l !== undefined && l !== null && l !== false)\n  writeJson(path.join(dir, 'status.json'), { ...data, content: undefined, brandSource: undefined })\n  mkdirSync(dir, { recursive: true })\n  writeFileSync(path.join(dir, 'projeto.md'), lines.join('\\n'))\n  writeFileSync(path.join(dir, 'marca.md'), shortenDataUrls(data.brandSource || '(sem marca no Space)\\n'))\n\n  console.log(`Projeto ${data.project.name} \u2192 ${rel(dir)}/`)\n  for (const page of data.content) {\n    const pageDir = path.join(dir, slug(page.name))\n    // Os arquivos de uma leitura antiga saem; se\xE7\xF5es novas ainda n\xE3o gravadas (sem id) ficam\n    if (existsSync(pageDir)) {\n      for (const file of readdirSync(pageDir)) {\n        const full = path.join(pageDir, file)\n        if (file === '_base.json') rmSync(full)\n        else if (file.endsWith('.json')) {\n          try {\n            if (readJson(full).id) rmSync(full)\n          } catch {\n            // Arquivo que n\xE3o \xE9 se\xE7\xE3o: fica\n          }\n        }\n      }\n    }\n    const base = {}\n    for (const s of page.sections) {\n      const { elementorJson, title, ...rest } = s.data\n      let elements\n      try {\n        elements = JSON.parse(elementorJson)\n      } catch {\n        elements = elementorJson\n      }\n      const section = { id: s.id, page: page.name, position: s.index + 1, title, data: rest, elements }\n      const file = path.join(pageDir, `${pad(s.index + 1)}-${slug(title)}.json`)\n      writeJson(file, section)\n      base[s.id] = { hash: s.hash, local: localHash(section), file: path.basename(file) }\n    }\n    writeJson(path.join(pageDir, '_base.json'), { pageId: page.id, page: page.name, pulledAt: Date.now(), sections: base })\n    console.log(`  \u25B8 ${page.name}: ${page.sections.length} se\xE7\xF5es em ${rel(pageDir)}/`)\n    for (const s of page.sections) console.log(`     ${pad(s.index + 1)}-${slug(s.data.title)}.json  \xB7  ${s.data.title}  (${Math.round(s.size / 1024)} KB)`)\n  }\n}\n\n/** Arquivos de se\xE7\xE3o pedidos: arquivos soltos ou todos os .json de uma pasta. */\nfunction sectionFiles(refs) {\n  const files = []\n  for (const ref of refs) {\n    const full = path.resolve(ref)\n    if (!existsSync(full)) fail(`Arquivo n\xE3o encontrado: ${ref}`)\n    if (statSync(full).isDirectory()) {\n      for (const f of readdirSync(full).sort()) if (f.endsWith('.json') && !f.startsWith('_')) files.push(path.join(full, f))\n    } else files.push(full)\n  }\n  return files\n}\n\nconst baseFor = (file) => {\n  const baseFile = path.join(path.dirname(file), '_base.json')\n  return existsSync(baseFile) ? { baseFile, base: readJson(baseFile) } : { baseFile, base: null }\n}\n\nconst elementorJsonOf = (section, file) => {\n  const elements = typeof section.elements === 'string' ? JSON.parse(section.elements) : section.elements\n  const list = Array.isArray(elements) ? elements : elements?.content ?? elements?.elements ?? [elements]\n  if (!Array.isArray(list) || !list.length || typeof list[0] !== 'object') fail(`${rel(file)}: \"elements\" precisa ser a lista de elementos do Elementor`)\n  return JSON.stringify(list)\n}\n\nasync function cmdPush() {\n  const label = one(flags.label)\n  if (!label) fail('Diga o que mudou com --label \"\u2026\" (aparece no painel do agente no canvas)')\n  const files = sectionFiles(positional)\n  if (!files.length) fail('Diga quais arquivos de se\xE7\xE3o gravar')\n  const status = await readyStatus()\n  // Arquivo de outro projeto (.space/<projeto>/\u2026) nunca vai para este: com v\xE1rios agentes, \xE9 o erro mais f\xE1cil de cometer\n  const mine = slug(status.project.name)\n  for (const file of files) {\n    const [folder] = path.relative(WORK, file).split(path.sep)\n    if (folder && folder !== '..' && folder !== mine && !path.isAbsolute(folder) && existsSync(path.join(WORK, folder, 'projeto.md'))) {\n      fail(`${rel(file)} \xE9 do projeto da pasta \"${folder}\", mas esta sess\xE3o est\xE1 em ${status.project.name}. Troque com: open <projeto>`)\n    }\n  }\n\n  const ops = []\n  const expect = {}\n  const plan = []\n  // V\xE1rias novas \"depois da mesma se\xE7\xE3o\" entram em fila, na ordem dos arquivos\n  const lastAfter = new Map()\n  for (const file of files) {\n    const section = readJson(file)\n    if (!section.title) fail(`${rel(file)}: falta \"title\"`)\n    const elementorJson = elementorJsonOf(section, file)\n    const { base } = baseFor(file)\n    if (section.id) {\n      const known = base?.sections?.[section.id]\n      if (known && known.local === localHash(section) && !flags.all) continue\n      if (known) expect[section.id] = known.hash\n      else if (!flags.force) fail(`${rel(file)}: se\xE7\xE3o ${section.id.slice(0, 8)} sem leitura registrada em _base.json; fa\xE7a pull antes (ou --force)`)\n      ops.push({ op: 'update', id: section.id, title: section.title, elementorJson, data: section.data })\n      plan.push({ file, section, kind: 'muda' })\n    } else {\n      const place = section.place ?? {}\n      const page = resolvePage(status, place.page ?? section.page ?? base?.pageId)\n      const anchor = (ref) => (ref ? resolveSection(status, ref, page.id).id : undefined)\n      const ref = `new:${plan.length}`\n      const afterId = anchor(place.after)\n      const after = afterId && lastAfter.get(afterId)\n      if (afterId) lastAfter.set(afterId, ref)\n      ops.push({ op: 'insert', ref, page: page.id, index: place.index, after: after ?? afterId, before: anchor(place.before), data: { ...(section.data ?? {}), title: section.title, elementorJson } })\n      plan.push({ file, section, kind: 'nova', ref, pageId: page.id })\n    }\n  }\n  if (!ops.length) return console.log('Nada mudou nos arquivos desde a leitura. (Use --all para gravar mesmo assim.)')\n\n  const result = await call('apply', { label, ops, expect, force: !!flags.force, focus: !flags['no-focus'] })\n\n  // Os arquivos passam a valer como a vers\xE3o do canvas: novas ganham id, todas ganham o hash novo\n  for (const item of plan) {\n    const id = item.kind === 'nova' ? result.created[item.ref] : item.section.id\n    const section = { ...item.section, id }\n    delete section.place\n    writeJson(item.file, section)\n    const { baseFile, base } = baseFor(item.file)\n    const next = base ?? { pageId: item.pageId, sections: {} }\n    next.sections[id] = { hash: result.hashes[id], local: localHash(section), file: path.basename(item.file) }\n    writeJson(baseFile, next)\n    console.log(`\u2714 ${item.kind === 'nova' ? 'nova' : 'alterada'}: ${section.title}  (${id.slice(0, 8)})`)\n  }\n  console.log(`No canvas: \"${label}\" \u2014 ${undoHint(status)}`)\n}\n\nasync function cmdRemove() {\n  const label = one(flags.label)\n  if (!label) fail('Diga o porqu\xEA com --label \"\u2026\"')\n  const status = await readyStatus()\n  const sections = positional.map((ref) => resolveSection(status, ref, one(flags.page)))\n  await call('apply', { label, ops: sections.map((s) => ({ op: 'remove', id: s.id })), expect: Object.fromEntries(sections.map((s) => [s.id, s.hash])), force: !!flags.force })\n  console.log(`\u2714 Sa\xEDram: ${sections.map((s) => s.title).join(', ')}. ${undoHint(status)}`)\n}\n\nasync function cmdMove() {\n  const label = one(flags.label)\n  if (!label) fail('Diga o porqu\xEA com --label \"\u2026\"')\n  const status = await readyStatus()\n  const section = resolveSection(status, positional[0])\n  const page = flags.page ? resolvePage(status, one(flags.page)) : section.page\n  const anchor = (ref) => (ref ? resolveSection(status, ref, page.id).id : undefined)\n  await call('apply', {\n    label,\n    ops: [{ op: 'move', id: section.id, page: page?.id, index: flags.index !== undefined ? Number(one(flags.index)) - 1 : undefined, after: anchor(one(flags.after)), before: anchor(one(flags.before)) }],\n  })\n  console.log(`\u2714 ${section.title} mudou de lugar. ${undoHint(status)}`)\n}\n\nasync function cmdWork() {\n  if (flags.done) {\n    await call('work', { done: true })\n    return console.log('\u2714 O canvas parou de mostrar onde estou mexendo.')\n  }\n  const text = positional.join(' ')\n  let sections\n  let page\n  if (flags.section || flags.page) {\n    const status = await readyStatus()\n    sections = list(flags.section).map((ref) => resolveSection(status, ref, one(flags.page)).id)\n    if (!sections.length) page = resolvePage(status, one(flags.page)).id\n  }\n  await call('work', { text, sections, page, element: one(flags.element) })\n  console.log(`\u2714 No canvas: ${text || 'Trabalhando'}`)\n}\n\nasync function cmdPlan() {\n  if (!positional.length) fail('Diga as se\xE7\xF5es do plano: space plan \"Hero\" \"Servi\xE7os\" \"Contato\" --new \"Sobre\"')\n  const status = await readyStatus()\n  const newPage = one(flags.new)\n  const page = newPage ? undefined : resolvePage(status, one(flags.page))\n  const after = flags.after && page ? resolveSection(status, one(flags.after), page.id).id : undefined\n  const result = await call('plan', { titles: positional, newPage, page: page?.id, after, label: one(flags.label) })\n  console.log(`\u2714 Plano no canvas (${result.sections.length} se\xE7\xF5es em esqueleto). Arquivos para construir:`)\n  await pullPages([result.pageId])\n  console.log('Construa uma se\xE7\xE3o por vez: troque \"elements\" no arquivo e grave com push. Cada uma sai do borrado ao gravar.')\n}\n\nasync function cmdPageRemove() {\n  const label = one(flags.label)\n  if (!label) fail('Diga o porqu\xEA com --label \"\u2026\"')\n  const status = await readyStatus()\n  const page = resolvePage(status, positional.join(' '))\n  await call('apply', { label, ops: [{ op: 'removePage', page: page.id }] })\n  console.log(`\u2714 P\xE1gina ${page.name} saiu do canvas. ${undoHint(status)}`)\n}\n\nasync function cmdPageAdd() {\n  const name = positional.join(' ')\n  if (!name) fail('Diga o nome da p\xE1gina')\n  await readyStatus()\n  const result = await call('apply', { label: one(flags.label) ?? `P\xE1gina nova: ${name}`, ops: [{ op: 'addPage', ref: 'page', name }] })\n  console.log(`\u2714 P\xE1gina ${name} criada (${result.pages.page}).`)\n}\n\nconst devOrigin = () => {\n  try {\n    return new URL(JSON.parse(readFileSync(STATE_FILE, 'utf8')).url).origin\n  } catch {\n    return 'http://localhost'\n  }\n}\n\nasync function cmdBuild() {\n  const entry = positional[0]\n  if (!entry) fail('Diga o arquivo .ts que monta a se\xE7\xE3o')\n  const { build } = await import(pathToFileURL(path.join(ROOT, 'node_modules/esbuild/lib/main.js')).href)\n  const outDir = mkdtempSync(path.join(os.tmpdir(), 'space-build-'))\n  const bundle = path.join(outDir, 'section.mjs')\n  try {\n    await build({\n      entryPoints: [path.resolve(entry)],\n      bundle: true,\n      platform: 'node',\n      format: 'esm',\n      outfile: bundle,\n      alias: { '@': path.join(ROOT, 'src') },\n      loader: { '.svg': 'text', '.css': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl' },\n      // Alguns m\xF3dulos do app leem window.location ao carregar: a origem \xE9 a do servidor de dev,\n      // para as imagens de public/ abrirem j\xE1 na aba (o projeto troca a porta ao abrir)\n      banner: { js: `globalThis.window ??= { location: { origin: ${JSON.stringify(devOrigin())} } }; globalThis.location ??= globalThis.window.location;` },\n      logLevel: 'error',\n    })\n    const mod = await import(pathToFileURL(bundle).href)\n    let value = mod.default ?? mod.section\n    if (typeof value === 'function') value = await value()\n    if (!value) fail(`${entry} n\xE3o exporta nada (use export default)`)\n    const section = Array.isArray(value) || value.elType ? { elements: [].concat(value) } : value\n    const out = path.resolve(one(flags.out) ?? entry.replace(/\\.[tj]sx?$/, '.json'))\n    const place = section.place ?? (flags.after || flags.before || flags.index ? { after: one(flags.after), before: one(flags.before), index: flags.index ? Number(one(flags.index)) - 1 : undefined } : undefined)\n    const file = {\n      title: section.title ?? path.basename(entry).replace(/\\.[tj]sx?$/, ''),\n      page: section.page ?? one(flags.page),\n      ...(place ? { place } : {}),\n      data: section.data ?? {},\n      elements: section.elements,\n    }\n    writeJson(out, file)\n    console.log(`\u2714 Se\xE7\xE3o \"${file.title}\" montada em ${rel(out)}. Grave com: node scripts/space/space.mjs push ${rel(out)} --label \"\u2026\"`)\n  } finally {\n    rmSync(outDir, { recursive: true, force: true })\n  }\n}\n\nasync function cmdBrand() {\n  const status = await readyStatus()\n  const file = positional[0]\n  const params = {}\n  if (file) {\n    if (!existsSync(file)) fail(`Arquivo n\xE3o encontrado: ${file}`)\n    params.source = readFileSync(file, 'utf8')\n    params.enabled = true\n  }\n  if (flags.on) params.enabled = true\n  if (flags.off) params.enabled = false\n\n  if (params.source !== undefined) {\n    // A marca n\xE3o entra no Ctrl+Z do canvas: a anterior fica guardada para voltar com \"brand <arquivo>\"\n    const before = await call('brand', {})\n    const backup = path.join(projectDir(status.project), 'marca-anterior.md')\n    mkdirSync(path.dirname(backup), { recursive: true })\n    writeFileSync(backup, before.source ?? '')\n    console.log(`Marca anterior (${before.name ?? 'nenhuma'}) guardada em ${rel(backup)}`)\n  }\n  const result = await call('brand', params)\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  console.log(`${params.source !== undefined || params.enabled !== undefined ? '\u2714 ' : ''}Marca: ${result.name ?? 'nenhuma'} \xB7 ${result.enabled ? 'ligada' : 'desligada'}${result.format ? ` \xB7 formato ${result.format}` : ''}`)\n  for (const w of result.warnings) console.log(`  aviso: ${w}`)\n  for (const n of result.notes) console.log(`  nota: ${n}`)\n}\n\nasync function cmdSay() {\n  const text = positional.join(' ')\n  if (!text) fail('Diga o texto')\n  let sections\n  if (flags.section) {\n    const status = await readyStatus()\n    sections = list(flags.section).map((ref) => resolveSection(status, ref, one(flags.page)).id)\n  }\n  await call('say', { text, kind: one(flags.kind), sections })\n  console.log(`\u2714 No painel, como ${AGENT}.`)\n}\n\nasync function cmdFocus() {\n  const status = await readyStatus()\n  if (flags.page && !positional.length) await call('focus', { page: resolvePage(status, one(flags.page)).id })\n  else await call('focus', { id: resolveSection(status, positional[0], one(flags.page)).id })\n  console.log('\u2714 Canvas no lugar.')\n}\n\n// ---------- ciclo com o cliente: briefing, aprova\xE7\xE3o, convite, WordPress ----------\n\nconst when = (time) => new Date(time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })\nconst DECISION = { approved: 'aprovou', changes: 'pediu ajuste' }\nconst SHARE_STATE = { none: 'sem link', waiting: 'esperando a resposta do cliente', approved: 'APROVADA', changes: 'AJUSTE PEDIDO' }\nconst LOCAL_WARNING = 'aviso: o app est\xE1 em localhost, ent\xE3o os links s\xF3 abrem neste computador. Para o cliente abrir, o app precisa estar publicado (VITE_PUBLIC_APP_URL).'\n\n/** Valor de uma op\xE7\xE3o que precisa de texto (`--slug=` limpa). */\nconst textFlag = (name) => {\n  // one() descarta a op\xE7\xE3o sem valor; aqui ela \xE9 erro\n  if ([].concat(flags[name] ?? []).includes(true)) fail(`Diga o valor de --${name} (ou --${name}= para deixar vazio)`)\n  return one(flags[name])\n}\n\nasync function cmdBrief() {\n  await readyStatus()\n  const file = one(flags.file)\n  if (file && !existsSync(file)) fail(`Arquivo n\xE3o encontrado: ${file}`)\n  const context = file ? readFileSync(file, 'utf8') : textFlag('set')\n  const result = await call('brief', context === undefined ? {} : { context })\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  if (context !== undefined) console.log(`\u2714 Briefing de ${result.name} gravado (${result.context.length} caracteres).\\n`)\n  console.log(result.context.trim() || `${result.name} ainda n\xE3o tem briefing. Grave com: brief --set \"<texto>\" ou brief --file <arquivo>`)\n}\n\nfunction printShares(result) {\n  for (const s of result.pages) {\n    if (!s.link) {\n      console.log(`\u25B8 ${s.page}: sem link de aprova\xE7\xE3o (crie com: approval send --page \"${s.page}\")`)\n      continue\n    }\n    console.log(`\u25B8 ${s.page}: ${SHARE_STATE[s.state] ?? s.state} \xB7 vers\xE3o ${s.version}, mandada em ${when(s.sharedAt)}`)\n    console.log(`   ${s.link}`)\n    if (s.outdated) console.log('   a p\xE1gina mudou depois dessa vers\xE3o: o cliente ainda v\xEA a anterior (approval send para mandar a de agora)')\n    for (const r of s.responses) {\n      const current = r.version === s.version\n      console.log(`   ${current ? '\u2022' : '\u25E6'} v${r.version}: ${r.name?.trim() || 'Cliente'} ${DECISION[r.decision] ?? r.decision} em ${when(r.createdAt)}${r.note?.trim() ? ` \u2014 \"${r.note.trim()}\"` : ''}${current ? '' : ' (vers\xE3o anterior)'}`)\n    }\n  }\n  if (result.local) console.log(`\\n${LOCAL_WARNING}`)\n}\n\nasync function cmdApproval() {\n  const status = await readyStatus()\n  const action = positional[0]\n  if (action && !['send', 'revoke'].includes(action)) fail(`A\xE7\xE3o desconhecida: ${action}. Use approval, approval send ou approval revoke`)\n  const pageRef = one(flags.page)\n  if (action && !pageRef) fail(`Diga a p\xE1gina: approval ${action} --page <nome>`)\n  const page = pageRef ? resolvePage(status, pageRef) : undefined\n\n  if (action) {\n    const result = await call('approval', { action, page: page.id, note: one(flags.label) })\n    if (flags.json) return console.log(JSON.stringify(result, null, 2))\n    const share = result.pages[0]\n    console.log(action === 'send' ? `\u2714 ${share.page} mandada para aprova\xE7\xE3o (vers\xE3o ${share.version}). Link do cliente:\\n${share.link}` : `\u2714 Link de aprova\xE7\xE3o de ${page.name} desativado.`)\n    if (result.local) console.log(`\\n${LOCAL_WARNING}`)\n    return\n  }\n\n  const wait = flags.wait === true ? true : one(flags.wait)\n  if (wait === undefined) {\n    const result = await call('approval', { page: page?.id })\n    if (flags.json) return console.log(JSON.stringify(result, null, 2))\n    return printShares(result)\n  }\n\n  // Espera o cliente responder \xE0 vers\xE3o que est\xE1 no link\n  if (!page) fail('Diga a p\xE1gina para esperar: approval --page <nome> --wait <minutos>')\n  const minutes = wait === true ? 30 : Number(wait)\n  if (!(minutes > 0)) fail('--wait \xE9 em minutos, por exemplo --wait 30')\n  const until = Date.now() + minutes * 60_000\n  let announced = false\n  for (;;) {\n    const result = await call('approval', { page: page.id })\n    const share = result.pages[0]\n    if (!share.link) fail(`${page.name} n\xE3o tem link de aprova\xE7\xE3o. Mande com: approval send --page \"${page.name}\"`)\n    const answer = share.responses.find((r) => r.version === share.version)\n    if (answer) {\n      if (flags.json) return console.log(JSON.stringify(result, null, 2))\n      return printShares(result)\n    }\n    if (Date.now() >= until) {\n      console.error(`O cliente n\xE3o respondeu \xE0 vers\xE3o ${share.version} de ${page.name} em ${minutes} min. Link: ${share.link}`)\n      quit(2)\n    }\n    if (!announced) {\n      console.log(`Esperando o cliente responder \xE0 vers\xE3o ${share.version} de ${page.name} (at\xE9 ${minutes} min, conferindo a cada 20 s)\u2026`)\n      announced = true\n    }\n    await new Promise((r) => setTimeout(r, 20_000))\n  }\n}\n\nasync function cmdInvite() {\n  await readyStatus()\n  // Sem a\xE7\xE3o, s\xF3 lista: criar um convite \xE9 sempre pedido com \"create\"\n  const action = positional[0] ?? 'list'\n  if (!['list', 'create', 'cancel'].includes(action)) fail(`A\xE7\xE3o desconhecida: invite ${action}. Use invite, invite create ou invite cancel <id>`)\n  const cancel = positional[1]\n  if (action === 'cancel' && !cancel) fail('Diga o id do convite: invite cancel <id> (veja os ids com: invite)')\n  const label = textFlag('label')\n  const result = await call('invite', { action, label, id: cancel })\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  if (result.created) {\n    console.log(`\u2714 Convite criado (vale para uma pessoa, at\xE9 ${when(result.created.expiresAt)}). Quem abrir entra com a pr\xF3pria conta e passa a editar o projeto junto:\\n${result.created.url}\\n`)\n  }\n  if (action === 'cancel') console.log(`\u2714 Convite ${cancel} cancelado.\\n`)\n  console.log('Pessoas no projeto:')\n  for (const p of result.people) console.log(`   ${p.email} \xB7 ${p.role === 'owner' ? 'dono' : 'edita junto'} \xB7 desde ${when(p.joinedAt)}`)\n  if (result.invites.length) {\n    console.log('Convites abertos:')\n    for (const i of result.invites) console.log(`   ${i.label} \xB7 ${i.expiresAt < Date.now() ? 'vencido' : `vale at\xE9 ${when(i.expiresAt)}`} \xB7 ${i.url} \xB7 id ${i.id}`)\n  }\n  if (result.local) console.log(`\\n${LOCAL_WARNING}`)\n}\n\nconst printConnection = (c) => {\n  if (!c) return console.log('WordPress: n\xE3o conectado. Conecte com: wp connect <endere\xE7o do site>')\n  const can = [c.can.editPages && 'editar p\xE1ginas', c.can.publishPages && 'publicar', c.can.uploadFiles && 'enviar m\xEDdia', c.can.unfilteredHtml && 'HTML sem filtro', c.can.manageOptions && 'configura\xE7\xF5es'].filter(Boolean)\n  console.log(`WordPress: ${c.site} (${c.siteUrl}) \xB7 usu\xE1rio ${c.user} [${c.roles.join(', ') || 'sem papel'}] \xB7 pode: ${can.join(', ') || 'nada'} \xB7 conferido em ${when(c.checkedAt)}`)\n  if (c.can.unfilteredHtml === false) console.log('   aviso: sem HTML sem filtro, o WordPress tira os scripts dos widgets HTML ao gravar (o GSAP das se\xE7\xF5es n\xE3o roda).')\n}\n\nasync function cmdWp() {\n  await readyStatus()\n  const action = positional[0] ?? 'status'\n  if (!['status', 'connect', 'pages', 'import'].includes(action)) fail(`A\xE7\xE3o desconhecida: wp ${action}. Use wp, wp connect, wp pages ou wp import`)\n\n  if (action === 'connect') {\n    const site = positional[1]\n    if (!site) fail('Diga o endere\xE7o do site: wp connect <site>')\n    const user = textFlag('user')\n    const password = textFlag('password')\n    if (!!user !== !!password) fail('Para gravar a conex\xE3o, passe --user e --password juntos')\n    const result = await call('wordpress', { action, site, user, password })\n    if (flags.json) return console.log(JSON.stringify(result, null, 2))\n    if (result.connection) {\n      console.log('\u2714 Conectado.')\n      return printConnection(result.connection)\n    }\n    console.log(`${result.site} (${result.siteUrl}) aceita conex\xE3o. Quem administra o site abre este link logado no WordPress e aprova:\\n${result.authorize}\\n`)\n    console.log('O WordPress mostra uma senha de aplica\xE7\xE3o. Com ela e o usu\xE1rio de quem aprovou, grave a conex\xE3o:')\n    console.log(`   wp connect ${site} --user <login> --password \"<senha>\"`)\n    console.log(`(Tamb\xE9m d\xE1 para criar a senha \xE0 m\xE3o no perfil: ${result.profile})`)\n    return\n  }\n\n  if (action === 'pages') {\n    const result = await call('wordpress', { action })\n    if (flags.json) return console.log(JSON.stringify(result, null, 2))\n    if (result.noElementorData) console.log('aviso: o Elementor do site n\xE3o mostra o conte\xFAdo das p\xE1ginas pela API (precisa da vers\xE3o 3.28 ou mais nova).')\n    if (!result.pages.length) return console.log('O site n\xE3o tem p\xE1ginas.')\n    for (const p of result.pages) console.log(`   ${p.id} \xB7 ${p.title} \xB7 ${p.status}${p.elementor ? '' : ' \xB7 sem Elementor'}${p.canvasPage ? ` \xB7 no canvas: ${p.canvasPage}` : ''} \xB7 ${p.link}`)\n    return\n  }\n\n  if (action === 'import') {\n    const ids = positional.slice(1).map(Number)\n    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) fail('Diga os ids das p\xE1ginas do site: wp import <id>\u2026 (veja os ids com: wp pages)')\n    const result = await call('wordpress', { action, ids })\n    if (flags.json) return console.log(JSON.stringify(result, null, 2))\n    for (const p of result.imported) console.log(`\u2714 ${p.page} (post ${p.postId}): ${p.sections} se\xE7\xF5es no canvas`)\n    for (const f of result.failed) console.log(`\u2716 post ${f.postId}: ${f.error}`)\n    if (result.imported.length) console.log(`\\nAs se\xE7\xF5es importadas ficam marcadas [do site]: n\xE3o recebem a marca do Space. ${result.kit ? 'O Kit do site (cores e fontes globais) veio junto.' : 'O Kit do site n\xE3o veio: as cores globais podem aparecer diferentes.'}`)\n    if (result.failed.length) quit(1)\n    return\n  }\n\n  const result = await call('wordpress', {})\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  printConnection(result.connection)\n  for (const p of result.pages) {\n    const wp = p.wordpress\n    console.log(`\u25B8 ${p.page}: ${wp ? `${wp.status === 'publish' ? 'publicada' : wp.status} em ${wp.link ?? wp.siteUrl} (post ${wp.postId}), sincronizada em ${when(wp.syncedAt)}` : 'ainda n\xE3o est\xE1 no site'}`)\n  }\n}\n\nconst DETAIL_FLAGS = { title: 'title', slug: 'slug', 'seo-title': 'seoTitle', description: 'description', keyword: 'focusKeyword' }\nconst DETAIL_NAMES = { title: 'T\xEDtulo', slug: 'Endere\xE7o', seoTitle: 'T\xEDtulo SEO', description: 'Meta descri\xE7\xE3o', focusKeyword: 'Palavra-chave' }\n\nasync function cmdDetails() {\n  const status = await readyStatus()\n  const page = resolvePage(status, one(flags.page))\n  const fields = {}\n  for (const [flag, key] of Object.entries(DETAIL_FLAGS)) {\n    const value = textFlag(flag)\n    if (value !== undefined) fields[key] = value\n  }\n  const result = await call('details', { page: page.id, fields })\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  if (Object.keys(fields).length) console.log(`\u2714 Detalhes de ${result.page} gravados.\\n`)\n  console.log(`\u25B8 ${result.page}`)\n  for (const [key, name] of Object.entries(DETAIL_NAMES)) console.log(`   ${name}: ${result.details[key] ?? '(padr\xE3o do WordPress)'}`)\n  console.log(`   Imagem destacada: ${result.featured ?? 'nenhuma escolhida'}`)\n  if (result.wordpress) console.log(`   No site: ${result.wordpress.link} (post ${result.wordpress.postId})`)\n}\n\nconst LAYOUTS = { canvas: 'elementor_canvas', tema: 'elementor_header_footer' }\n\nasync function cmdPublish() {\n  const status = await readyStatus()\n  if (!flags.page) fail('Diga a p\xE1gina: publish --page <nome> --yes')\n  const page = resolvePage(status, one(flags.page))\n  const layout = one(flags.layout)\n  if (layout !== undefined && !LAYOUTS[layout]) fail('--layout \xE9 canvas (tela cheia do Elementor) ou tema (com o cabe\xE7alho e o rodap\xE9 do tema)')\n\n  if (!flags.yes) {\n    const [wp, approval] = await Promise.all([call('wordpress', {}), call('approval', { page: page.id })])\n    if (!wp.connection) fail('O projeto n\xE3o tem WordPress conectado. Conecte com: wp connect <endere\xE7o do site>')\n    const linked = page.wordpress && page.wordpress.siteUrl === wp.connection.siteUrl ? page.wordpress : null\n    const share = approval.pages[0]\n    console.log(`Publicar ${page.name} em ${wp.connection.site} (${wp.connection.siteUrl}), como ${wp.connection.user}:`)\n    console.log(`   ${linked ? `atualiza a p\xE1gina que j\xE1 est\xE1 no site, ${linked.link} (post ${linked.postId}), com backup da vers\xE3o de l\xE1` : 'cria uma p\xE1gina nova no site'}`)\n    console.log(`   situa\xE7\xE3o: ${flags.live ? 'PUBLICADA, vis\xEDvel para todo mundo' : linked ? `fica como est\xE1 no site (${linked.status})` : 'rascunho (s\xF3 quem entra no WordPress v\xEA)'}`)\n    console.log(`   layout: ${layout ?? 'canvas'}${layout === 'tema' ? ' (cabe\xE7alho e rodap\xE9 do tema)' : ' (Tela do Elementor: sem o cabe\xE7alho, o t\xEDtulo e o rodap\xE9 do tema)'}${flags.overwrite ? ' \xB7 passa por cima de mudan\xE7as feitas no site' : ''}`)\n    console.log(`   aprova\xE7\xE3o: ${share.link ? `${SHARE_STATE[share.state] ?? share.state} (vers\xE3o ${share.version}${share.outdated ? ', e a p\xE1gina mudou depois dela' : ''})` : 'sem link de aprova\xE7\xE3o'}`)\n    console.error('\\nNada foi publicado. Confirme com o usu\xE1rio (ou veja o cliente aprovar a vers\xE3o atual) e rode de novo com --yes.')\n    quit(1)\n  }\n\n  console.log(`Publicando ${page.name}\u2026`)\n  // Sem --layout vale a Tela do Elementor tamb\xE9m na p\xE1gina que j\xE1 est\xE1 no site: o tema n\xE3o p\xF5e o t\xEDtulo e o cabe\xE7alho dele por cima\n  const result = await call('publish', { page: page.id, status: flags.live ? 'publish' : undefined, template: LAYOUTS[layout ?? 'canvas'], overwrite: !!flags.overwrite })\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  console.log(`\u2714 ${result.created ? 'Criada' : 'Atualizada'} em ${result.site}: ${result.status === 'publish' ? 'publicada' : result.status === 'draft' ? 'rascunho' : result.status}`)\n  console.log(`   P\xE1gina: ${result.link}`)\n  console.log(`   Editar no Elementor: ${result.editUrl}`)\n  console.log(`   Imagens enviadas para a m\xEDdia do site: ${result.uploaded}`)\n  if (result.failedImages.length) console.log(`   ${result.failedImages.length} imagens n\xE3o subiram e seguem pelo endere\xE7o de origem:\\n${result.failedImages.map((u) => `      ${u}`).join('\\n')}`)\n  console.log(`   Cache de CSS do Elementor: ${result.cacheCleared ? 'limpo' : 'n\xE3o limpou (a p\xE1gina pode aparecer com o estilo antigo at\xE9 o Elementor regenerar o CSS)'}`)\n  console.log(`   Imagem destacada: ${{ saved: 'gravada', unchanged: 'sem mudan\xE7a', unsupported: 'o tema n\xE3o usa em p\xE1ginas', failed: 'n\xE3o subiu' }[result.featured] ?? result.featured}`)\n  console.log(`   SEO: ${result.seo === 'saved' ? 'gravado' : result.seo === 'failed' ? `n\xE3o gravou (${result.seoError})` : 'sem campos de SEO, ou o site n\xE3o deixa gravar'}`)\n  const applied = result.layout?.applied\n  if (applied !== undefined) console.log(`   Layout no site: ${applied === 'elementor_canvas' ? 'Tela do Elementor' : applied === 'elementor_header_footer' ? 'com o tema' : applied ? applied : 'modelo padr\xE3o do tema (com o t\xEDtulo dele)'}${result.layout.wanted && applied !== result.layout.wanted ? ` \xB7 o site N\xC3O aceitou ${result.layout.wanted}${result.layout.error ? `: ${result.layout.error}` : ''}` : ''}`)\n}\n\nasync function cmdRestore() {\n  const status = await readyStatus()\n  if (!flags.page) fail('Diga a p\xE1gina: restore --page <nome> --yes')\n  const page = resolvePage(status, one(flags.page))\n  if (!page.wordpress) fail(`${page.name} n\xE3o est\xE1 ligada a uma p\xE1gina do WordPress`)\n  if (!flags.yes) {\n    console.log(`Voltar ${page.name} no site (${page.wordpress.link}, post ${page.wordpress.postId}) para o conte\xFAdo que tinha antes da \xFAltima publica\xE7\xE3o feita daqui.`)\n    console.error('\\nNada mudou. Confirme com o usu\xE1rio e rode de novo com --yes.')\n    quit(1)\n  }\n  const result = await call('restore', { page: page.id })\n  if (flags.json) return console.log(JSON.stringify(result, null, 2))\n  console.log(`\u2714 ${result.page} voltou \xE0 vers\xE3o de ${when(result.restoredFrom)} em ${result.site}. Restam ${result.remaining} vers\xF5es guardadas.${result.cacheCleared ? '' : ' O cache de CSS do Elementor n\xE3o limpou.'}`)\n}\n\n// ---------- fotos (Edge headless pelo CDP) ----------\n\nconst DEVICES = { desktop: { width: 1440, height: 900, slice: 1800 }, tablet: { width: 768, height: 1024, slice: 2048 }, mobile: { width: 375, height: 812, slice: 1624 } }\nconst BROWSERS = [\n  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',\n  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',\n  'C:/Program Files/Google/Chrome/Application/chrome.exe',\n  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',\n  '/usr/bin/google-chrome',\n]\n\nasync function cdp(wsUrl) {\n  const ws = new WebSocket(wsUrl)\n  await new Promise((resolve, reject) => {\n    ws.onopen = resolve\n    ws.onerror = () => reject(new Error('CDP n\xE3o abriu'))\n  })\n  let next = 0\n  const waiting = new Map()\n  const listeners = new Map()\n  ws.onmessage = ({ data }) => {\n    const message = JSON.parse(data)\n    if (message.id && waiting.has(message.id)) {\n      const { resolve, reject } = waiting.get(message.id)\n      waiting.delete(message.id)\n      message.error ? reject(new Error(message.error.message)) : resolve(message.result)\n    } else if (message.method) listeners.get(message.method)?.forEach((fn) => fn(message.params))\n  }\n  return {\n    send: (method, params = {}) =>\n      new Promise((resolve, reject) => {\n        const id = ++next\n        waiting.set(id, { resolve, reject })\n        ws.send(JSON.stringify({ id, method, params }))\n      }),\n    once: (method) => new Promise((resolve) => listeners.set(method, [...(listeners.get(method) ?? []), resolve])),\n    close: () => ws.close(),\n  }\n}\n\n/** Abre o Edge (ou o Chrome) headless, entrega a aba pelo CDP e fecha tudo no fim. */\nasync function withBrowser(work) {\n  const browser = BROWSERS.find((b) => existsSync(b))\n  if (!browser) fail('N\xE3o achei o Edge nem o Chrome para abrir a p\xE1gina')\n  const port = 9400 + Math.floor(Math.random() * 400)\n  const profile = mkdtempSync(path.join(os.tmpdir(), 'space-shot-'))\n  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', 'about:blank']\n  const child = spawn(browser, args, { stdio: 'ignore' })\n  try {\n    let targets\n    for (let i = 0; i < 50 && !targets; i++) {\n      await new Promise((r) => setTimeout(r, 200))\n      targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null)\n    }\n    const page = targets?.find((t) => t.type === 'page')\n    if (!page) throw new Error('O navegador headless n\xE3o abriu')\n    const tab = await cdp(page.webSocketDebuggerUrl)\n    try {\n      return await work(tab)\n    } finally {\n      tab.close()\n    }\n  } finally {\n    child.kill()\n    await new Promise((r) => setTimeout(r, 300))\n    rmSync(profile, { recursive: true, force: true, maxRetries: 3 })\n  }\n}\n\nconst capture = (url, device, outBase) =>\n  withBrowser(async (tab) => {\n    const { width, height, slice } = DEVICES[device]\n    await tab.send('Page.enable')\n    await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: device === 'mobile' })\n    // Sem movimento: a foto mostra a composi\xE7\xE3o final (as hist\xF3rias com GSAP respeitam isso)\n    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })\n    const loaded = tab.once('Page.loadEventFired')\n    await tab.send('Page.navigate', { url })\n    await Promise.race([loaded, new Promise((r) => setTimeout(r, 20_000))])\n    await tab.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })\n    await new Promise((r) => setTimeout(r, 800))\n    const metrics = await tab.send('Page.getLayoutMetrics')\n    const total = Math.min(Math.ceil((metrics.cssContentSize ?? metrics.contentSize).height), 20_000)\n    const files = []\n    for (let y = 0, n = 1; y < total; y += slice, n++) {\n      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(slice, total - y), scale: 1 } })\n      const file = total > slice ? `${outBase}-${n}.png` : `${outBase}.png`\n      writeFileSync(file, Buffer.from(data, 'base64'))\n      files.push(file)\n    }\n    return { files, total }\n  })\n\n// ---------- v\xEDdeo (rel\xF3gio virtual + ffmpeg) ----------\n\nconst VIDEO = {\n  desktop: { width: 1440, height: 900, scale: 1 },\n  mobile: { width: 390, height: 844, scale: 2 },\n}\nconst FPS = 30\n/** Rolagem: px por segundo, em m\xE9dia, e as pausas no topo (abertura e entrada do hero) e no fim. */\nconst SCROLL_SPEED = 420\nconst HOLD_TOP = 2.5\nconst HOLD_END = 1.5\n/** Momentos da folha de confer\xEAncia, em fra\xE7\xE3o do v\xEDdeo. */\nconst SHEET_AT = [0, 0.15, 0.3, 0.5, 0.75, 0.98]\nconst smooth = (t) => t * t * (3 - 2 * t)\n\n/** Espera fontes e imagens carregarem (no tempo real; o rel\xF3gio da p\xE1gina continua no 0). */\nconst WAIT_ASSETS = `Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.complete ? 0 : new Promise((done) => { img.addEventListener('load', done); img.addEventListener('error', done) }))]).then(() => true)`\n\n/**\n * A p\xE1gina rolando do topo ao fim, com as anima\xE7\xF5es, gravada quadro a quadro.\n * O rel\xF3gio da p\xE1gina (rAF, timers, anima\xE7\xF5es CSS) s\xF3 anda quando o gravador\n * manda: cada quadro sai no tempo certo, por mais que a captura demore.\n */\nconst recordVideo = (url, device, out, { holdTop = HOLD_TOP, speed = SCROLL_SPEED } = {}) =>\n  withBrowser(async (tab) => {\n    const { width, height, scale } = VIDEO[device]\n    await tab.send('Page.enable')\n    await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: device === 'mobile' })\n    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })\n    await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(path.join(ROOT, 'scripts/space/vt.js'), 'utf8') })\n    const evaluate = async (expression) => (await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value\n    const loaded = tab.once('Page.loadEventFired')\n    await tab.send('Page.navigate', { url })\n    await Promise.race([loaded, new Promise((r) => setTimeout(r, 30_000))])\n    await Promise.race([evaluate(WAIT_ASSETS), new Promise((r) => setTimeout(r, 20_000))])\n    await new Promise((r) => setTimeout(r, 1500))\n\n    const scrollable = await evaluate('Math.max(0, document.documentElement.scrollHeight - innerHeight)')\n    const travel = Math.max(3, scrollable / speed)\n    const duration = holdTop + (scrollable ? travel : 0) + HOLD_END\n    const frames = Math.round(duration * FPS)\n    const ff = spawn('ffmpeg', [\n      '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',\n      '-vf', `scale=${width * scale}:${height * scale}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,\n      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',\n      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',\n      '-r', String(FPS), '-movflags', '+faststart', '-an', out,\n    ], { stdio: ['pipe', 'inherit', 'inherit'] })\n    const closed = new Promise((resolve, reject) => {\n      ff.on('error', () => reject(new Error('N\xE3o achei o ffmpeg (instale com: winget install ffmpeg)')))\n      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`O ffmpeg parou com o c\xF3digo ${code}`))))\n    })\n\n    const started = Date.now()\n    for (let i = 0; i < frames; i++) {\n      const t = i / FPS\n      const progress = scrollable ? smooth(Math.min(1, Math.max(0, (t - holdTop) / travel))) : 0\n      // Rola, avisa a p\xE1gina, anda o rel\xF3gio um quadro e espera o navegador desenhar\n      const top = Math.round(progress * scrollable)\n      await evaluate(`scrollTo({ top: ${top}, behavior: 'instant' }); dispatchEvent(new Event('scroll')); window.__vt.advance(${(t * 1000).toFixed(2)}); window.__vt.realFrame().then(() => true)`)\n      const { data } = await tab.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })\n      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r))\n      if (i % 90 === 0) process.stdout.write(`\\r  quadro ${i}/${frames} \xB7 ${Math.round((Date.now() - started) / 1000)} s   `)\n    }\n    ff.stdin.end()\n    await closed\n    process.stdout.write('\\r')\n    return { duration, frames }\n  })\n\nasync function cmdVideo() {\n  const status = await readyStatus()\n  const { url, token } = bridge()\n  const page = resolvePage(status, one(flags.page))\n  const deviceFlag = one(flags.device) ?? 'desktop'\n  const devices = deviceFlag === 'all' ? ['desktop', 'mobile'] : [deviceFlag]\n  for (const d of devices) if (!VIDEO[d]) fail(`Tela desconhecida para v\xEDdeo: ${d} (desktop, mobile ou all)`)\n  const dir = path.join(projectDir(status.project), 'videos')\n  mkdirSync(dir, { recursive: true })\n  for (const device of devices) {\n    const query = new URLSearchParams({ token, device, motion: 'play', page: page.id })\n    if (flags.tab) query.set('tab', one(flags.tab))\n    else if (target) query.set('project', target.id)\n    const out = path.resolve(devices.length === 1 && one(flags.out) ? one(flags.out) : path.join(dir, `${slug(page.name)}-${device}.mp4`))\n    console.log(`Gravando ${page.name} (${device})\u2026`)\n    const holdTop = flags.pause !== undefined ? Number(one(flags.pause)) : undefined\n    const speed = flags.speed !== undefined ? Number(one(flags.speed)) : undefined\n    if ((holdTop !== undefined && !(holdTop >= 0)) || (speed !== undefined && !(speed > 0))) fail('--pause \xE9 em segundos (0 ou mais) e --speed em px por segundo')\n    const { duration, frames } = await recordVideo(`${url}/__space/render?${query}`, device, out, { holdTop, speed })\n    const sheet = out.replace(/\\.mp4$/i, '') + '-quadros.png'\n    await contactSheet(out, frames, sheet)\n    const size = (statSync(out).size / 1024 / 1024).toFixed(1)\n    console.log(`\u2714 ${device}: ${rel(out)} (${duration.toFixed(1)} s, ${size} MB) \xB7 confer\xEAncia: ${rel(sheet)}`)\n  }\n}\n\n/** Seis quadros do v\xEDdeo numa imagem s\xF3, para conferir abertura, meio e fim sem assistir. */\nfunction contactSheet(video, frames, out) {\n  const picks = SHEET_AT.map((f) => `eq(n\\\\,${Math.min(frames - 1, Math.round(f * (frames - 1)))})`).join('+')\n  return new Promise((resolve, reject) => {\n    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', `select='${picks}',scale=480:-2,tile=3x2:padding=6:color=white`, '-frames:v', '1', '-fps_mode', 'passthrough', out], { stdio: 'inherit' })\n    ff.on('error', reject)\n    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`A folha de quadros falhou (ffmpeg ${code})`))))\n  })\n}\n\nasync function cmdShot() {\n  const status = await readyStatus()\n  const { url, token } = bridge()\n  const pageRef = one(flags.page)\n  const sections = list(flags.section).map((ref) => resolveSection(status, ref, pageRef))\n  const page = sections.length ? null : resolvePage(status, pageRef)\n  const deviceFlag = one(flags.device) ?? 'desktop'\n  const devices = deviceFlag === 'all' ? ['desktop', 'mobile'] : [deviceFlag]\n  for (const d of devices) if (!DEVICES[d]) fail(`Tela desconhecida: ${d} (desktop, tablet, mobile ou all)`)\n\n  const dir = path.join(projectDir(status.project), 'fotos')\n  mkdirSync(dir, { recursive: true })\n  const name = page ? slug(page.name) : sections.map((s) => slug(s.title)).join('+').slice(0, 60)\n  for (const device of devices) {\n    const query = new URLSearchParams({ token, device, ...(page ? { page: page.id } : { sections: sections.map((s) => s.id).join(',') }) })\n    if (flags.tab) query.set('tab', one(flags.tab))\n    else if (target) query.set('project', target.id)\n    const { files, total } = await capture(`${url}/__space/render?${query}`, device, path.join(dir, `${name}-${device}`))\n    console.log(`\u2714 ${device} (${total}px de altura): ${files.map(rel).join(', ')}`)\n  }\n}\n\n// ---------- entrada ----------\n\nconst COMMANDS = {\n  status: cmdStatus,\n  projects: cmdProjects,\n  open: cmdOpen,\n  new: cmdNew,\n  pull: cmdPull,\n  push: cmdPush,\n  remove: cmdRemove,\n  move: cmdMove,\n  'page-add': cmdPageAdd,\n  'page-remove': cmdPageRemove,\n  work: cmdWork,\n  plan: cmdPlan,\n  build: cmdBuild,\n  say: cmdSay,\n  brand: cmdBrand,\n  focus: cmdFocus,\n  brief: cmdBrief,\n  approval: cmdApproval,\n  invite: cmdInvite,\n  wp: cmdWp,\n  details: cmdDetails,\n  publish: cmdPublish,\n  restore: cmdRestore,\n  shot: cmdShot,\n  agents: cmdAgents,\n  close: cmdClose,\n  video: cmdVideo,\n}\n\nif (!command || command === 'help' || flags.help) {\n  console.log(HELP)\n} else if (!COMMANDS[command]) {\n  console.error(`\u2716 Comando desconhecido: ${command}\\n\\n${HELP}`)\n  process.exitCode = 1\n} else {\n  // Comandos da conta n\xE3o precisam de projeto; os outros v\xE3o para o projeto da sess\xE3o\n  const needsProject = !['projects', 'agents', 'open', 'new', 'build'].includes(command)\n  ;(needsProject ? resolveTarget() : Promise.resolve()).then(() => COMMANDS[command]()).catch((error) => {\n    if (!(error instanceof Exit)) console.error(`\u2716 ${error?.message ?? String(error)}`)\n    process.exitCode = error instanceof Exit ? error.code : 1\n    // Algo ainda aberto (navegador, socket) n\xE3o segura o processo\n    setTimeout(() => process.exit(process.exitCode), 100).unref()\n  })\n}\n");
write("AGENTS.md", AGENTS_MD);
write("CLAUDE.md", "@AGENTS.md\n");
var stateFile = path3.join(folder, ".space", "conector.json");
var VALID = /^[A-Z2-9]{6}$/;
var given = (arg("codigo") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
var code = VALID.test(given) ? given : "";
if (!code) {
  try {
    code = JSON.parse(readFileSync3(stateFile, "utf8")).code ?? "";
  } catch {
  }
}
if (!VALID.test(code)) code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
write(".space/conector.json", `${JSON.stringify({ code, savedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`);
var wrong = 0;
var lockedUntil = 0;
var normalize = (value) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
function checkCode(given2) {
  if (Date.now() < lockedUntil) return "locked";
  if (normalize(given2) === code) return "ok";
  if (!given2) return "wrong";
  if (++wrong >= MAX_WRONG) {
    wrong = 0;
    lockedUntil = Date.now() + LOCK_FOR;
    console.warn(`
  \u26A0 ${MAX_WRONG} tentativas com c\xF3digo errado. Parei de aceitar por ${LOCK_FOR / 6e4} minutos.
`);
  }
  return "wrong";
}
var handlers = /* @__PURE__ */ new Map();
var clients = /* @__PURE__ */ new Map();
var routes = [];
var httpServer = http.createServer((req, res) => void handle(req, res));
var fakeServer = {
  config: { root: folder },
  ws: {
    on: (event, fn) => handlers.set(event, [...handlers.get(event) ?? [], fn]),
    send: (event, data) => {
      for (const client of clients.values()) client.send(event, data);
    }
  },
  middlewares: { use: (prefix, fn) => routes.push([prefix, fn]) },
  httpServer
};
var mount = (plugin) => plugin.configureServer(fakeServer);
mount(spaceBridge());
mount(spaceChat({ guide: GUIDE }));
var cors = (req) => ({
  "access-control-allow-origin": req.headers.origin ?? "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  // O navegador pede licença para um site falar com o próprio computador
  "access-control-allow-private-network": "true",
  vary: "Origin"
});
var json = (req, res, status, body) => {
  res.writeHead(status, { ...cors(req), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
var readBody2 = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) reject(new Error("Mensagem grande demais"));
    else chunks.push(chunk);
  });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});
async function handle(req, res) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  for (const [prefix, route] of routes) {
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      req.url = (req.url ?? "/").slice(prefix.length) || "/";
      return route(req, res);
    }
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req));
    return res.end();
  }
  const access = checkCode(url.searchParams.get("code"));
  if (access !== "ok") return json(req, res, access === "locked" ? 429 : 403, { error: access === "locked" ? "Muitas tentativas: espere uns minutos" : "C\xF3digo errado" });
  if (req.method === "GET" && url.pathname === "/ping") return json(req, res, 200, { ok: true, version: "202610061456", agents: await checkAgents() });
  if (req.method === "GET" && url.pathname === "/link") {
    res.writeHead(200, { ...cors(req), "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive" });
    const client = {
      id: randomUUID3(),
      open: true,
      socket: {
        get readyState() {
          return client.open ? 1 : 3;
        }
      },
      send: (event, data) => client.open && res.write(`data: ${JSON.stringify({ event, data })}

`)
    };
    clients.set(client.id, client);
    if (clients.size === 1) console.log("  \u2714 Navegador conectado. Pode usar o chat no canvas.");
    res.write(`data: ${JSON.stringify({ type: "connected", client: client.id, version: "202610061456" })}

`);
    const keepAlive = setInterval(() => res.write(": ping\n\n"), 15e3);
    req.on("close", () => {
      client.open = false;
      clearInterval(keepAlive);
      clients.delete(client.id);
      if (!clients.size) console.log("  \xB7 O navegador saiu (aba fechada ou recarregando).");
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/link/send") {
    const client = clients.get(url.searchParams.get("client") ?? "");
    if (!client) return json(req, res, 410, { error: "Conex\xE3o fechada: reconecte" });
    try {
      const { event, data } = JSON.parse(await readBody2(req));
      for (const fn of handlers.get(event) ?? []) fn(data, client);
      res.writeHead(204, cors(req));
      return res.end();
    } catch (error) {
      return json(req, res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  json(req, res, 404, { error: "Rota desconhecida" });
}
var wanted = Number(arg("porta")) || DEFAULT_PORT;
function listen(port, tries) {
  httpServer.once("error", (error) => {
    if (error.code === "EADDRINUSE" && tries > 1) return listen(port + 1, tries - 1);
    console.error(`N\xE3o consegui abrir o conector: ${error.message}`);
    process.exit(1);
  });
  httpServer.listen(port, "127.0.0.1", () => void ready(port));
}
async function ready(port) {
  const pairing = port === DEFAULT_PORT ? code : `${code}:${port}`;
  const agents = await checkAgents();
  const lines = agents.map((a) => `    ${a.available ? "\u2714" : "\u2716"} ${CHAT_AGENTS[a.id].name}${a.available ? ` ${a.version ?? ""}` : ` (${a.reason ?? "n\xE3o encontrado"})`}`);
  console.log(
    [
      "",
      "  Superelements \xB7 conector dos agentes",
      "",
      `  C\xF3digo:  ${pairing.slice(0, 3)}-${pairing.slice(3)}`,
      given ? "  A aba do Superelements que baixou este arquivo liga sozinha em alguns segundos." : "  Cole no chat do canvas, no navegador. Ele fica guardado: da pr\xF3xima vez, \xE9 s\xF3 abrir o conector.",
      "",
      "  Agentes nesta m\xE1quina:",
      ...lines,
      "",
      `  Pasta de trabalho: ${folder}`,
      "  Deixe esta janela aberta enquanto usa o chat. Ctrl+C fecha.",
      ""
    ].join("\n")
  );
  if (!agents.some((a) => a.available)) console.log("  Nenhum agente encontrado: instale o Claude Code (https://claude.com/claude-code) ou o Codex e abra o conector de novo.\n");
}
var close = () => {
  httpServer.close();
  httpServer.closeAllConnections?.();
  setTimeout(() => process.exit(0), 300);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
if (!existsSync3(folder)) mkdirSync3(folder, { recursive: true });
listen(wanted, PORT_TRIES);
