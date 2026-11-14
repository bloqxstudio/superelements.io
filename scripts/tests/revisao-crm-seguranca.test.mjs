import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dnsGuard, ipv6Groups, isIpLiteral, isPublicHost } from '../../supabase/functions/_shared/siteScan.ts'
import { memoryHit } from '../../supabase/functions/_shared/rateLimit.ts'

// Revisão de 2026-11-13: o diagnóstico de site não pode abrir a rede interna (faixas reservadas, IPv6 local)

test('isPublicHost barra as faixas IPv4 reservadas', () => {
  for (const ip of ['0.1.2.3', '10.0.0.1', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255'])
    assert.equal(isPublicHost(ip), false, ip)
  for (const ip of ['8.8.8.8', '1.1.1.1', '100.63.255.255', '100.128.0.1', '172.15.0.1', '172.32.0.1', '198.17.255.255', '198.20.0.1', '223.255.255.255', '200.147.67.142'])
    assert.equal(isPublicHost(ip), true, ip)
})

test('isPublicHost barra IPv6 local, mapeado e reservado', () => {
  for (const ip of ['::', '::1', '[::1]', '::ffff:127.0.0.1', '::ffff:7f00:1', '::127.0.0.1', '64:ff9b::10.0.0.1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%en0', 'fec0::1', 'ff02::1', '2001:db8::1', '2002:c0a8:101::1', '100::1'])
    assert.equal(isPublicHost(ip), false, ip)
  for (const ip of ['2606:4700:4700::1111', '[2001:4860:4860::8888]', '2804:14c::1'])
    assert.equal(isPublicHost(ip), true, ip)
})

test('isPublicHost: nomes locais e números que não são IP', () => {
  for (const host of ['localhost', 'LOCALHOST.', 'api.localhost', 'nas.local', 'db.internal', '999.1.1.1', '1.2.3', ''])
    assert.equal(isPublicHost(host), false, host)
  for (const host of ['exemplo.com.br', 'www.sinfy.com.br'])
    assert.equal(isPublicHost(host), true, host)
})

test('ipv6Groups expande :: e o IPv4 no fim', () => {
  assert.deepEqual(ipv6Groups('::1'), [0, 0, 0, 0, 0, 0, 0, 1])
  assert.deepEqual(ipv6Groups('::ffff:1.2.3.4'), [0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304])
  assert.deepEqual(ipv6Groups('2001:db8::'), [0x2001, 0xdb8, 0, 0, 0, 0, 0, 0])
  assert.equal(ipv6Groups('1::2::3'), null)
  assert.equal(ipv6Groups('12345::1'), null)
  assert.equal(isIpLiteral('[::1]'), true)
  assert.equal(isIpLiteral('exemplo.com'), false)
})

test('dnsGuard confere IP escrito direto e falha fechada sem resposta do DNS', async () => {
  const table = { 'publico.com': ['8.8.8.8'], 'interno.com': ['8.8.8.8', '10.0.0.5'], 'v6.com': ['fe80::1'] }
  const guard = dnsGuard(async (host, type) => (type === 'A' ? (table[host] ?? []).filter((ip) => !ip.includes(':')) : (table[host] ?? []).filter((ip) => ip.includes(':'))))
  assert.equal(await guard('publico.com'), true)
  assert.equal(await guard('interno.com'), false)
  assert.equal(await guard('v6.com'), false)
  assert.equal(await guard('127.0.0.1'), false)
  assert.equal(await guard('[::1]'), false)
  assert.equal(await guard('8.8.4.4'), true)
  await assert.rejects(guard('sumiu.com'), (error) => error.code === 'ENOTFOUND')
  const failing = dnsGuard(async () => {
    throw new Error('NXDOMAIN')
  })
  await assert.rejects(failing('quebrado.com'), (error) => error.code === 'ENOTFOUND')
})

test('memoryHit limita por chave numa janela', () => {
  const store = new Map()
  const t0 = 1_000_000
  assert.equal(memoryHit('a', 2, 60, t0, store), true)
  assert.equal(memoryHit('a', 2, 60, t0 + 1, store), true)
  assert.equal(memoryHit('a', 2, 60, t0 + 2, store), false)
  assert.equal(memoryHit('b', 2, 60, t0 + 2, store), true)
  assert.equal(memoryHit('a', 2, 60, t0 + 61_000, store), true)
})
