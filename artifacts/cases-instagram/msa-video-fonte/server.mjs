import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const pub = 'C:/Users/Saipos/ShipStudio/superelements-io/public'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' }
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const file = url.startsWith('/reel/') ? path.join(here, url.slice(6)) : path.join(pub, url)
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(data)
  })
}).listen(5199, '127.0.0.1', () => console.log('on 5199'))
