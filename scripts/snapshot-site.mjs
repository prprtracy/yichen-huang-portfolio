import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://yichen-huang-portfolio.tracyhuang1016.chatgpt.site";
const root = process.cwd();
const queue = ["/", "/kronos-audio.html", "/styles.css", "/script.js"];
const visited = new Set();

function localPath(url) {
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") return path.join(root, "index.html");
  const clean = path.posix.normalize(pathname).replace(/^\/+/, "");
  if (clean.startsWith("..")) throw new Error(`Unsafe path: ${pathname}`);
  return path.join(root, clean);
}

function discover(text, currentUrl) {
  const patterns = [
    /(?:src|href)\s*=\s*["']([^"'#]+)["']/gi,
    /url\(\s*["']?([^)"']+)["']?\s*\)/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1].trim();
      if (!raw || /^(?:data:|mailto:|tel:|javascript:)/i.test(raw)) continue;
      try {
        const resolved = new URL(raw, currentUrl);
        if (resolved.origin !== ORIGIN || resolved.pathname.startsWith("/cdn-cgi/")) continue;
        resolved.hash = "";
        resolved.search = "";
        if (!visited.has(resolved.pathname)) queue.push(resolved.pathname);
      } catch {
        // Ignore malformed or intentionally non-URL values.
      }
    }
  }
}

while (queue.length) {
  const pathname = queue.shift();
  const url = new URL(pathname, ORIGIN);
  url.hash = "";
  url.search = "";
  if (visited.has(url.pathname) || url.pathname.startsWith("/cdn-cgi/")) continue;
  visited.add(url.pathname);

  const response = await fetch(url, {
    headers: { "user-agent": "Yichen-Portfolio-Snapshot/1.0" }
  });
  if (!response.ok) {
    console.warn(`Skipped ${url.pathname}: HTTP ${response.status}`);
    continue;
  }

  const type = response.headers.get("content-type") || "";
  const destination = localPath(url);
  await mkdir(path.dirname(destination), { recursive: true });

  if (/text|javascript|json|xml|svg/i.test(type) || /\.(?:html|css|js|json|svg)$/i.test(url.pathname)) {
    let text = await response.text();
    if (/html/i.test(type) || /\.html$/i.test(url.pathname) || url.pathname === "/") {
      text = text.replace(/<script[^>]+src=["'][^"']*\/cdn-cgi\/[^"']*["'][^>]*><\/script>/gi, "");
    }
    await writeFile(destination, text, "utf8");
    if (/html|css/i.test(type) || /\.(?:html|css)$/i.test(url.pathname) || url.pathname === "/") {
      discover(text, url);
    }
  } else {
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(destination, bytes);
  }

  console.log(`Saved ${url.pathname} -> ${path.relative(root, destination)}`);
}

console.log(`Snapshot complete: ${visited.size} files`);
