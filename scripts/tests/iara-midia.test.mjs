// As ações da Iara levam arquivos desta máquina e voltam para a aba do chat (2026-11-08): o servidor MCP lê o
// "caminho" de uma foto ou vídeo e manda o arquivo em base64, marca o pedido como longo e diz qual aba preferir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const MCP = path.resolve('scripts/iara/iara-mcp.mjs')

async function withBridge(fn) {
  const got = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      got.push(JSON.parse(body))
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ result: { feito: [] } }))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(url, got)
  } finally {
    server.close()
  }
}

function callTool(url, name, args, env = {}) {
  const child = spawn(process.execPath, [MCP], { env: { ...process.env, SPACE_BRIDGE_URL: url, SPACE_BRIDGE_TOKEN: 't', ...env }, stdio: ['pipe', 'pipe', 'inherit'] })
  return new Promise((resolve, reject) => {
    let out = ''
    child.stdout.on('data', (c) => {
      out += c
      const line = out.split('\n').find((l) => l.includes('"id":1'))
      if (line) {
        child.kill()
        resolve(JSON.parse(line))
      }
    })
    child.on('error', reject)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })}\n`)
  })
}

test('caminho de um vídeo vira arquivo em base64, pedido longo e a aba do chat', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'iara-midia-'))
  const file = path.join(dir, 'painel-mt03.mp4')
  writeFileSync(file, Buffer.from([0, 1, 2, 3, 4, 5]))
  await withBridge(async (url, got) => {
    const reply = await callTool(url, 'video_midias', { midias: [{ caminho: file, cenas: [2] }] }, { SPACE_TAB: 'aba-1234-abcd' })
    assert.ok(!reply.result.isError, JSON.stringify(reply))
    const body = got[0]
    assert.equal(body.method, 'iara')
    assert.equal(body.prefer, 'aba-1234-abcd')
    assert.equal(body.params.long, true)
    const m = body.params.args.midias[0]
    assert.equal(m.caminho, undefined)
    assert.deepEqual(m.cenas, [2])
    assert.equal(m.arquivo.nome, 'painel-mt03.mp4')
    assert.equal(m.arquivo.tipo, 'video/mp4')
    assert.deepEqual([...Buffer.from(m.arquivo.data, 'base64')], [0, 1, 2, 3, 4, 5])
  })
})

test('sem arquivo: pedido normal, sem "long"', async () => {
  await withBridge(async (url, got) => {
    await callTool(url, 'video_midias', {})
    assert.equal(got[0].params.long, undefined)
    assert.equal(got[0].prefer, undefined)
  })
})

test('recusa o que não é imagem nem vídeo e arquivo que não existe', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'iara-midia-'))
  const txt = path.join(dir, 'segredo.txt')
  writeFileSync(txt, 'x')
  await withBridge(async (url, got) => {
    const a = await callTool(url, 'video_midias', { midias: [{ caminho: txt }] })
    assert.equal(a.result.isError, true)
    assert.match(a.result.content[0].text, /não é imagem nem vídeo/)
    const b = await callTool(url, 'video_midias', { midias: [{ caminho: path.join(dir, 'nao.mp4') }] })
    assert.equal(b.result.isError, true)
    assert.match(b.result.content[0].text, /não encontrado/)
    assert.equal(got.length, 0)
  })
})
