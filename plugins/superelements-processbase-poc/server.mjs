import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const pluginRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(pluginRoot, "../..");
const designPath = resolve(repoRoot, "brands/processbase/DESIGN.md");
const copyPath = resolve(repoRoot, "brands/processbase/COPY.md");
const draftRoot = resolve(process.env.PROCESSBASE_DRAFT_DIR ?? resolve(pluginRoot, "drafts"));
const port = Number(process.env.PORT ?? 8787);
const mcpPath = "/mcp";

const pageSections = [
  "Navbar",
  "Hero",
  "Método Base",
  "O que muda",
  "Como funciona",
  "O que fica com você",
  "Especialista",
  "Dúvidas",
  "Contato",
  "Rodapé",
];

const normalize = (value) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const slugify = (value) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "pagina";

const elementorId = () => randomBytes(4).toString("hex");

async function loadKnowledge() {
  const [design, copy] = await Promise.all([
    readFile(designPath, "utf8"),
    readFile(copyPath, "utf8"),
  ]);
  return { design, copy };
}

function textResult(message, structuredContent) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent,
  };
}

function searchDocument(source, sourceName, query, limit) {
  const terms = normalize(query).split(/\s+/).filter((term) => term.length > 1);
  return source
    .split(/\r?\n/)
    .map((text, index) => ({ source: sourceName, line: index + 1, text: text.trim() }))
    .filter((entry) => entry.text && terms.some((term) => normalize(entry.text).includes(term)))
    .slice(0, limit);
}

function widget(widgetType, settings) {
  return { id: elementorId(), elType: "widget", widgetType, settings, elements: [] };
}

function container(elements, settings = {}) {
  return {
    id: elementorId(),
    elType: "container",
    isInner: false,
    settings: {
      content_width: "boxed",
      boxed_width: { unit: "px", size: 1044, sizes: [] },
      padding: { unit: "px", top: "72", right: "32", bottom: "72", left: "32", isLinked: false },
      ...settings,
    },
    elements,
  };
}

function createElementorDraft({ title, goal, sections }) {
  const chosenSections = sections?.length ? sections : ["Hero", "Benefícios", "Como funciona", "Contato"];
  const content = chosenSections.map((section, index) => {
    const isHero = index === 0;
    const children = [
      widget("heading", {
        title: isHero ? title : section,
        header_size: isHero ? "h1" : "h2",
        title_color: isHero ? "#FFFFFF" : "#171A2C",
        typography_font_family: "Inter",
        typography_font_weight: "400",
      }),
      widget("text-editor", {
        editor: isHero
          ? goal
          : `Conteúdo de ${section} a desenvolver com a base aprovada da ProcessBase.`,
        text_color: isHero ? "#FFFFFF" : "#5E6472",
        typography_font_family: "Inter",
      }),
    ];

    if (isHero) {
      children.push(
        widget("button", {
          text: "Agendar diagnóstico",
          link: { url: "#contato", is_external: "", nofollow: "", custom_attributes: "" },
          button_text_color: "#FFFFFF",
          background_color: "#FF5900",
          typography_font_family: "Inter",
          typography_font_weight: "600",
        }),
      );
    }

    return container(children, {
      css_classes: `processbase-poc-${slugify(section)}`,
      background_background: "classic",
      background_color: isHero ? "#171A2C" : index % 2 ? "#FFFFFF" : "#F2F3F5",
      overflow: "hidden",
    });
  });

  return {
    version: "0.4",
    title,
    type: "page",
    page_settings: [],
    content,
    _poc: {
      project: "processbase",
      goal,
      publishable: false,
      notice: "Rascunho local. Não foi enviado ao WordPress.",
    },
  };
}

function createProcessBaseServer() {
  const server = new McpServer(
    { name: "superelements-processbase-poc", version: "0.1.0" },
    {
      instructions:
        "POC local da ProcessBase. Consulte o projeto ou a base antes de criar páginas. Crie somente rascunhos locais. Esta POC não autentica usuários e nunca publica no WordPress.",
    },
  );

  server.registerTool(
    "get_processbase_project",
    {
      title: "Abrir projeto ProcessBase",
      description: "Mostra a página, a marca e as capacidades disponíveis nesta POC da ProcessBase.",
      inputSchema: {},
      outputSchema: {
        project: z.object({ id: z.string(), name: z.string(), mode: z.string() }),
        brand: z.object({ colors: z.array(z.string()), fonts: z.array(z.string()) }),
        pages: z.array(z.object({ id: z.string(), title: z.string(), status: z.string(), sections: z.array(z.string()) })),
        features: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async () =>
      textResult("Projeto ProcessBase aberto em modo POC local, sem conexão com o WordPress.", {
        project: { id: "processbase", name: "ProcessBase", mode: "local-poc" },
        brand: {
          colors: ["#171A2C", "#1E2237", "#FF5900", "#829AAF", "#FFFFFF", "#F2F3F5"],
          fonts: ["Inter"],
        },
        pages: [{ id: "home", title: "Home", status: "fonte-local", sections: pageSections }],
        features: [
          "consulta à base local DESIGN.md e COPY.md",
          "busca textual com fonte e linha",
          "criação de rascunho Elementor nativo em JSON",
          "nenhuma publicação no WordPress",
        ],
      }),
  );

  server.registerTool(
    "search_processbase_knowledge",
    {
      title: "Buscar na base da ProcessBase",
      description: "Busca regras de marca e copy nos arquivos locais oficiais da ProcessBase antes de escrever ou editar uma página.",
      inputSchema: { query: z.string().min(2), limit: z.number().int().min(1).max(12).optional() },
      outputSchema: {
        results: z.array(z.object({ source: z.string(), line: z.number(), text: z.string() })),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ query, limit = 8 }) => {
      const { design, copy } = await loadKnowledge();
      const results = [
        ...searchDocument(design, "brands/processbase/DESIGN.md", query, limit),
        ...searchDocument(copy, "brands/processbase/COPY.md", query, limit),
      ].slice(0, limit);
      return textResult(
        results.length ? `Encontrei ${results.length} trecho(s) na base da ProcessBase.` : "Nenhum trecho encontrado.",
        { results },
      );
    },
  );

  server.registerTool(
    "create_processbase_page_draft",
    {
      title: "Criar rascunho Elementor",
      description: "Cria um arquivo JSON Elementor local para a ProcessBase. Não acessa nem publica no WordPress.",
      inputSchema: {
        title: z.string().min(3).max(100),
        goal: z.string().min(10).max(500),
        sections: z.array(z.string().min(2).max(80)).min(1).max(8).optional(),
      },
      outputSchema: {
        draft: z.object({ id: z.string(), title: z.string(), path: z.string(), sectionCount: z.number(), status: z.string() }),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ title, goal, sections }) => {
      const draft = createElementorDraft({ title: title.trim(), goal: goal.trim(), sections });
      const id = `${Date.now()}-${slugify(title)}`;
      const path = resolve(draftRoot, `${id}.elementor.json`);
      await mkdir(draftRoot, { recursive: true });
      await writeFile(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
      return textResult(`Rascunho “${title}” criado localmente. Nada foi enviado ao WordPress.`, {
        draft: { id, title, path, sectionCount: draft.content.length, status: "local-draft" },
      });
    },
  );

  return server;
}

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === mcpPath) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ name: "superelements-processbase-poc", status: "ok", mcp: mcpPath }));
    return;
  }

  if (["POST", "GET", "DELETE"].includes(req.method ?? "") && url.pathname === mcpPath) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createProcessBaseServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, "127.0.0.1", () => {
  console.log(`Superelements ProcessBase POC: http://127.0.0.1:${port}${mcpPath}`);
});
