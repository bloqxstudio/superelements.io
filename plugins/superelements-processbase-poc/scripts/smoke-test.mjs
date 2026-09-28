import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const draftDir = await mkdtemp(join(tmpdir(), "processbase-poc-"));
const port = 18787;
const child = spawn(process.execPath, [resolve(root, "server.mjs")], {
  cwd: root,
  env: { ...process.env, PORT: String(port), PROCESSBASE_DRAFT_DIR: draftDir },
  stdio: ["ignore", "pipe", "pipe"],
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("MCP server did not start");
};

try {
  await waitForServer();
  const client = new Client({ name: "processbase-poc-smoke", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  await client.connect(transport);

  const { tools } = await client.listTools();
  if (tools.length !== 3) throw new Error(`Expected 3 tools, received ${tools.length}`);

  const project = await client.callTool({ name: "get_processbase_project", arguments: {} });
  if (project.isError) throw new Error("Project tool returned an error");

  const search = await client.callTool({
    name: "search_processbase_knowledge",
    arguments: { query: "Agendar diagnóstico", limit: 3 },
  });
  if (search.isError || !search.structuredContent?.results?.length) throw new Error("Knowledge search returned no result");

  const created = await client.callTool({
    name: "create_processbase_page_draft",
    arguments: {
      title: "Diagnóstico ProcessBase",
      goal: "Apresentar o diagnóstico e levar o visitante ao agendamento.",
      sections: ["Hero", "O que muda", "Como funciona", "Contato"],
    },
  });
  if (created.isError) throw new Error("Draft tool returned an error");

  const path = created.structuredContent?.draft?.path;
  const draft = JSON.parse(await readFile(path, "utf8"));
  if (draft.content?.length !== 4 || draft._poc?.publishable !== false) {
    throw new Error("Draft payload is invalid");
  }

  await client.close();
  console.log("POC smoke test passed: 3 tools, knowledge search and local Elementor draft.");
} finally {
  child.kill();
  await rm(draftDir, { recursive: true, force: true });
}
