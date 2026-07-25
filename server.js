import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080', 10);

// Inyectar env vars en dist/index.html al arrancar
const indexPath = join(__dirname, 'dist', 'index.html');
const originalHtml = readFileSync(indexPath, 'utf-8');
const configScript = `<script>window.__SUPABASE_CONFIG__=${JSON.stringify({
  supabaseUrl: process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
})}</script>`;

if (!originalHtml.includes('window.__SUPABASE_CONFIG__')) {
  writeFileSync(indexPath, originalHtml.replace('</head>', configScript + '</head>'));
}

const app = express();
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1h',
  setHeaders(res, path) {
    if (path.includes('sw.js') || path.includes('manifest.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('.')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`FlowTrack PWA serving on port ${PORT}`);
});
