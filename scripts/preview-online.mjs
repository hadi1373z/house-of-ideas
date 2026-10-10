import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import onlineWorker from '../worker/online.js';
import {openOnlineSqlite} from './online-sqlite-adapter.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let index = 0; index < args.length; index += 2) {
  if (!['--port', '--data'].includes(args[index]) || !args[index + 1] || options[args[index]]) throw Error('Use --port <0–65535> --data <absolute temporary QA directory>.');
  options[args[index]] = args[index + 1];
}
const port = Number(options['--port'] ?? 4322), data = options['--data'];
if (!Number.isInteger(port) || port < 0 || port > 65535 || !data || !path.isAbsolute(data)) throw Error('Use a valid port and an absolute temporary QA data directory.');
const dataDir = path.resolve(data), personalDir = path.resolve(root, 'data');
if (dataDir.toLowerCase() === personalDir.toLowerCase() || dataDir.toLowerCase().startsWith(personalDir.toLowerCase() + path.sep)) throw Error('Keep online QA fixtures outside the personal data directory.');
await fs.mkdir(dataDir, {recursive: true});
const marker = path.join(dataDir, '.online-qa-fixture');
try {
  await fs.writeFile(marker, 'Loopback-only House of Ideas online QA data. No production identity or inference key.\n', {flag: 'wx'});
} catch (error) {
  if (error.code !== 'EEXIST' || !(await fs.readFile(marker, 'utf8')).startsWith('Loopback-only House of Ideas online QA data.')) throw Error('Use a dedicated online QA directory.');
}
const webRoot = await fs.realpath(path.join(root, 'web'));
const {DB, close} = await openOnlineSqlite({file: path.join(dataDir, 'online-qa.sqlite')});
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream'};
const assets = {async fetch(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405});
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Invalid path', {status: 400}); }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part === '.' || part === '..')) return new Response('Invalid path', {status: 403});
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  let file;
  try { file = await fs.realpath(path.resolve(webRoot, relative)); } catch { return new Response('Not found', {status: 404}); }
  if (!file.startsWith(webRoot + path.sep) || !(await fs.stat(file)).isFile()) return new Response('Not found', {status: 404});
  const type = mime[path.extname(file).toLowerCase()];
  if (!type) return new Response('Not found', {status: 404});
  let bytes = await fs.readFile(file);
  if (file === path.join(webRoot, 'index.html')) bytes = Buffer.from(bytes.toString('utf8').replace(/<body(?:\s[^>]*)?>/i, '<body data-mode="hosted" data-qa="true">').replace(/<title>[^<]*<\/title>/i, '<title>Online QA · House of Ideas</title>'));
  return new Response(request.method === 'HEAD' ? null : bytes, {headers: {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-House-QA': 'loopback-fixture'}});
}};
let origin;
const server = http.createServer(async (incoming, outgoing) => {
  try {
    if (incoming.headers.host !== new URL(origin).host) { outgoing.writeHead(403); outgoing.end('Use the loopback QA address.'); return; }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    // This deliberate local fixture is never production authentication. The
    // helper is bound to 127.0.0.1 and never packaged or deployed with the Site.
    headers.set('oai-authenticated-user-id', 'online-qa');
    const controller = new AbortController();
    incoming.once('aborted', () => controller.abort());
    const body = ['GET', 'HEAD'].includes(incoming.method) ? undefined : Readable.toWeb(incoming);
    const request = new Request(new URL(incoming.url, origin), {method: incoming.method, headers, signal: controller.signal, ...(body ? {body, duplex: 'half'} : {})});
    const response = await onlineWorker.fetch(request, {DB, ASSETS: assets, HOUSE_SOURCE_VERSION: 'loopback-online-qa'});
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && incoming.method !== 'HEAD') Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(503, {'Content-Type': 'application/json'});
    outgoing.end(JSON.stringify({error: 'The isolated online QA preview could not complete this request.'}));
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
origin = `http://127.0.0.1:${server.address().port}`;
console.log(`Online QA URL ${origin}`);
console.log('Loopback fixture identity: online-qa. Real GPT is disabled; no API key is read.');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  if (stopping) return; stopping = true;
  await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }); close(); process.exit(0);
});
