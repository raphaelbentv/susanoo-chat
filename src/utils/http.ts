import type { ServerResponse, IncomingMessage } from 'http';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
} as const;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export function send(
  res: ServerResponse,
  code: number,
  body: string | Buffer,
  type = 'text/plain; charset=utf-8'
): void {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(body);
}

export function json(res: ServerResponse, code: number, data: unknown): void {
  send(res, code, JSON.stringify(data), MIME['.json']);
}

export function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('too_large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export interface ParsedUrl {
  pathname: string;
  params: Record<string, string>;
}

export function parseUrl(url: string): ParsedUrl {
  const qIndex = url.indexOf('?');
  const pathname = qIndex >= 0 ? url.slice(0, qIndex) : url;
  const params: Record<string, string> = {};

  if (qIndex >= 0) {
    for (const pair of url.slice(qIndex + 1).split('&')) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }
  }

  return { pathname, params };
}

export function getMimeType(ext: string): string {
  const key = ext.toLowerCase() as keyof typeof MIME;
  return MIME[key] || 'application/octet-stream';
}
