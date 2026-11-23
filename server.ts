import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  handleCoverLetter,
  handleEnhanceBullet,
  handleHealth,
  handleObjective,
  handleSignatureConvert,
  handleSignatureGenerate,
} from './server/aiService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  const result = handleHealth();
  res.status(result.status).json(result.body);
});

app.post('/api/ai/objective', async (req: Request, res: Response) => {
  const result = await handleObjective(req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/ai/enhance-bullet', async (req: Request, res: Response) => {
  const result = await handleEnhanceBullet(req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/ai/cover-letter', async (req: Request, res: Response) => {
  const result = await handleCoverLetter(req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/ai/signature-generate', async (req: Request, res: Response) => {
  const result = await handleSignatureGenerate(req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/ai/signature-convert', async (req: Request, res: Response) => {
  const result = await handleSignatureConvert(req.body);
  res.status(result.status).json(result.body);
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use('/videos', express.static(path.resolve(__dirname, 'public/videos')));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
