import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 8_000;
const DNS_TIMEOUT_MS = 3_000;
const MAX_REDIRECTS = 3;

export class CollectionError extends Error {
  constructor(
    public readonly code: "INVALID_URL" | "UNSAFE_URL" | "UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED_CONTENT",
    message: string,
  ) {
    super(message);
  }
}

export type CollectedPage = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  elapsedMs: number;
};

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isUnsafeAddress(address: string): boolean {
  const type = isIP(address);
  if (type === 4) return isPrivateIpv4(address);
  if (type !== 6) return true;
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

export function normalizePublicUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 500) {
    throw new CollectionError("INVALID_URL", "Enter a valid public website address.");
  }
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new CollectionError("INVALID_URL", "Enter a valid public website address.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new CollectionError("INVALID_URL", "Only public HTTP and HTTPS websites can be analyzed.");
  }
  if (!url.hostname || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") || url.hostname === "metadata.google.internal") {
    throw new CollectionError("UNSAFE_URL", "This address cannot be analyzed.");
  }
  return url;
}

async function assertPublicDestination(url: URL): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const lookupPromise = lookup(url.hostname, { all: true, verbatim: true });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new CollectionError("TIMEOUT", "The website domain did not resolve in time.")), DNS_TIMEOUT_MS);
    });
    const addresses = await Promise.race([lookupPromise, timeoutPromise]);
    if (addresses.length === 0 || addresses.some((entry) => isUnsafeAddress(entry.address))) {
      throw new CollectionError("UNSAFE_URL", "This address cannot be analyzed.");
    }
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    throw new CollectionError("UNAVAILABLE", "The website domain could not be resolved.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new CollectionError("UNSUPPORTED_CONTENT", "The website response is too large to analyze safely.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      received += next.value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new CollectionError("UNSUPPORTED_CONTENT", "The website response is too large to analyze safely.");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(result);
}

export async function fetchPublicHtml(input: string | URL): Promise<CollectedPage> {
  let currentUrl = typeof input === "string" ? normalizePublicUrl(input) : input;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicDestination(currentUrl);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new CollectionError("TIMEOUT", "The website did not respond in time."));
      }, REQUEST_TIMEOUT_MS);
    });
    const startedAt = performance.now();
    try {
      const response = await Promise.race([
        fetch(currentUrl, {
          headers: { "User-Agent": "DBTI-Research-Scanner/1.0 (+https://dbti.example)" },
          redirect: "manual",
          signal: controller.signal,
        }),
        deadline,
      ]);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const destination = response.headers.get("location");
        if (!destination) throw new CollectionError("UNAVAILABLE", "The website returned an invalid redirect.");
        currentUrl = new URL(destination, currentUrl);
        continue;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        throw new CollectionError("UNSUPPORTED_CONTENT", "The website did not return an HTML page.");
      }
      const html = await Promise.race([readLimitedBody(response), deadline]);
      const elapsedMs = Math.round(performance.now() - startedAt);
      return {
        requestedUrl: typeof input === "string" ? input : input.toString(),
        finalUrl: currentUrl.toString(),
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        html,
        elapsedMs,
      };
    } catch (error) {
      if (error instanceof CollectionError) throw error;
      if ((error as { name?: string }).name === "AbortError") {
        throw new CollectionError("TIMEOUT", "The website did not respond in time.");
      }
      throw new CollectionError("UNAVAILABLE", "The website could not be reached during this scan.");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw new CollectionError("UNAVAILABLE", "The website redirected too many times.");
}

function resolveLink(value: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(value, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const expression = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(html))) {
    const link = resolveLink(match[1], baseUrl);
    if (link) links.add(link);
  }
  return Array.from(links);
}

export function selectKeyPages(homeUrl: string, links: string[]): string[] {
  const home = new URL(homeUrl);
  const candidates = links
    .filter((link) => {
      const parsed = new URL(link);
      return parsed.hostname === home.hostname && /(?:about|contact|privacy|terms|legal|policy)/i.test(parsed.pathname);
    })
    .sort((a, b) => {
      const priority = (value: string) => /privacy/i.test(value) ? 0 : /terms|legal/i.test(value) ? 1 : /contact/i.test(value) ? 2 : 3;
      return priority(a) - priority(b);
    });
  const fallback = ["/privacy", "/terms", "/contact", "/about"].map((path) => new URL(path, home).toString());
  return Array.from(new Set([...candidates, ...fallback])).filter((url) => url !== homeUrl).slice(0, 4);
}
