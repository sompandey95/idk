import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve("dist");
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : path.join(directory, entry.name),
    ),
  );
  return nested.flat();
}
const assets = (await files(root))
  .filter((file) => !file.endsWith("sw.js"))
  .map((file) => "/" + path.relative(root, file).replaceAll("\\", "/"));
const fingerprint = createHash("sha256");
for (const asset of assets)
  fingerprint.update(await readFile(path.join(root, asset.slice(1))));
const name = `synapse-v2-${fingerprint.digest("hex").slice(0, 12)}`;
await writeFile(
  path.join(root, "sw.js"),
  `
const CACHE = ${JSON.stringify(name)};
const ASSETS = ${JSON.stringify(["/", ...assets])};
const PUBLIC_PATHS = new Set(ASSETS);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('synapse-v2-') && key !== CACHE).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error('Navigation failed');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html', {ignoreVary: true}))));
  } else {
    if (!PUBLIC_PATHS.has(url.pathname)) return;
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname, {ignoreVary: true})).then(cached => cached || fetch(event.request)));
  }
});
`,
);
console.log(`Offline shell: ${assets.length} assets precached (${name}).`);
