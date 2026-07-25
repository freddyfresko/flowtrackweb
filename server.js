import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080', 10);
const app = express();

app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1h',
  setHeaders(res, path) {
    if (path.includes('sw.js') || path.includes('manifest.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback: si Express 5 no matcheó un archivo estático, sirve index.html
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
