import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PUBLIC_ORIGIN = 'https://ss-homestay-roomstay-kb.ai.studio';
const OG_IMAGE_PATH = '/ss-homestay-logo-v5.jpg';

function sanitizeHost(rawHost: string): string {
  return rawHost.replace(/[^a-zA-Z0-9.:-]/g, '');
}

function getRequestOrigin(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
    req.headers.host ||
    '';
  const host = sanitizeHost(String(rawHost).split(',')[0].trim());

  if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    const envUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
    if (envUrl && /^https?:\/\//i.test(envUrl)) {
      return envUrl;
    }
    return DEFAULT_PUBLIC_ORIGIN;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoRaw = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || 'https';
  const proto = protoRaw.split(',')[0].trim().toLowerCase() === 'http' ? 'http' : 'https';
  return `${proto}://${host}`;
}

function injectDynamicOpenGraph(html: string, origin: string): string {
  const safeOrigin = origin.replace(/\/+$/, '');
  return html.replaceAll(DEFAULT_PUBLIC_ORIGIN, safeOrigin);
}

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', true);

  // Health & OpenGraph verification endpoint
  app.get('/api/og-check', (req: Request, res: Response) => {
    const origin = getRequestOrigin(req);
    res.json({
      ok: true,
      origin,
      ogUrl: `${origin}/`,
      ogImage: `${origin}${OG_IMAGE_PATH}`,
      title: 'SS Homestay & Roomstay — Kota Bharu, Kelantan',
      description:
        'Penginapan selesa dengan Private Pool, 3 bilik tidur air-cond & Roomstay di Kg Padang Enggang, Kota Bharu, Kelantan. Semak kalendar & tempah terus.',
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use(async (req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        let html = fs.readFileSync(templatePath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        const origin = getRequestOrigin(req);
        html = injectDynamicOpenGraph(html, origin);

        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');

    // Serve static assets (logo, favicon, manifest, JS/CSS bundles) directly without auth
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1d',
      })
    );

    // Dynamically inject live HTTPS origin into OpenGraph meta tags for WhatsApp/social crawlers
    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      const origin = getRequestOrigin(req);
      let html = fs.readFileSync(indexHtmlPath, 'utf-8');
      html = injectDynamicOpenGraph(html, origin);
      res
        .status(200)
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        })
        .send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SS Homestay server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
