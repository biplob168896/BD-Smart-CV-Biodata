import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getErrorStatusAndMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('not configured')) {
    return { status: 400, message: raw };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'API key permission denied. Please check your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('400') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'Invalid Gemini API key. Please check Settings > Secrets.',
    };
  }
  return { status: 500, message: raw || 'Failed to generate AI response.' };
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post('/api/ai/objective', async (req: Request, res: Response) => {
  try {
    const {
      targetRole,
      presetMode,
      experienceLevel,
      language,
      currentDraft,
      skills,
      educationSummary,
    } = req.body as {
      targetRole?: string;
      presetMode?: string;
      experienceLevel?: string;
      language?: 'en' | 'bn';
      currentDraft?: string;
      skills?: string[];
      educationSummary?: string;
    };

    const ai = getGeminiClient();
    const isBangla = language === 'bn';

    const prompt = `
Write or refine a crisp, realistic, high-impact Career Objective / Professional Summary for a candidate in the Bangladesh job market.
- Target Role: ${targetRole || 'Not specified'}
- Sector / Preset Mode: ${presetMode || 'Corporate / General'}
- Experience Level: ${experienceLevel || 'Mid-level or Fresher'}
- Key Skills: ${(skills || []).slice(0, 8).join(', ') || 'General professional skills'}
- Education: ${educationSummary || 'Graduate'}
- Existing Draft (improve if provided): ${currentDraft || 'None'}
- Output Language: ${isBangla ? 'Formal Professional Bengali (বাংলা)' : 'Formal Professional English'}

Requirements:
- Return ONLY the 3 to 4 sentence career objective/summary paragraph (no quotes, no markdown headings, no introductory commentary).
- Keep it specific to Bangladeshi hiring standards (concise, formal, measurable where possible, avoiding clichés like "dynamic and hardworking individual").
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a senior career strategist specializing in Bangladesh Government, Bank, Corporate/MNC, NGO, and RMG recruitment. Output only the requested text cleanly.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = (response.text ?? '').trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned an empty response.' });
      return;
    }
    res.json({ text });
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    res.status(status).json({ error: message });
  }
});

app.post('/api/ai/enhance-bullet', async (req: Request, res: Response) => {
  try {
    const { jobTitle, company, bullets, language, presetMode } = req.body as {
      jobTitle?: string;
      company?: string;
      bullets?: string;
      language?: 'en' | 'bn';
      presetMode?: string;
    };

    if (!bullets || !bullets.trim()) {
      res.status(400).json({ error: 'Please enter at least one responsibility line to enhance.' });
      return;
    }

    const ai = getGeminiClient();
    const isBangla = language === 'bn';

    const prompt = `
Transform the following work experience responsibilities into crisp, action-verb-driven, measurable achievement bullet points suitable for ${presetMode || 'Bangladesh corporate & ATS'} hiring.
- Role: ${jobTitle || 'Professional'}
- Organization: ${company || 'Organization'}
- Output Language: ${isBangla ? 'Formal Bengali (বাংলা)' : 'Formal English'}

Input Responsibilities:
${bullets}

Rules:
- Start every bullet with a strong action verb (e.g., Spearheaded, Streamlined, Automated, Coordinated, Achieved — or strong Bengali equivalents).
- Preserve truthful facts; where metrics are implied, keep realistic placeholders like [X%] only if no numbers were given, or sharpen existing numbers.
- Output 3 to 5 plain lines separated by newline characters, each starting with "• ". Do not include markdown bolding or extra preamble.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an ATS resume optimization specialist for the Bangladeshi job market. Return only clean bullet lines.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = (response.text ?? '').trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned an empty response.' });
      return;
    }
    res.json({ text });
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    res.status(status).json({ error: message });
  }
});

app.post('/api/ai/cover-letter', async (req: Request, res: Response) => {
  try {
    const { cvSummary, jobCircular, recipientOrg, targetPosition, language } = req.body as {
      cvSummary: string;
      jobCircular?: string;
      recipientOrg?: string;
      targetPosition?: string;
      language?: 'en' | 'bn';
    };

    const ai = getGeminiClient();
    const isBangla = language === 'bn';

    const prompt = `
Write a complete, formal Bangladeshi Job Application / Cover Letter tailored to the candidate profile and job circular below.
- Target Position: ${targetPosition || 'As per Job Circular'}
- Recipient Organization: ${recipientOrg || 'The Hiring Authority'}
- Output Language: ${isBangla ? 'Formal Bangladeshi Official Bengali (বাংলা আবেদনপত্র)' : 'Formal Bangladeshi Business English'}

Candidate Profile Summary:
${cvSummary}

Job Circular / Requirements:
${jobCircular || 'Standard professional application matching the candidate profile.'}

Format Requirements:
- Include standard Bangladeshi formal letter structure: Date, To (The Head of HR / Selection Committee / Authority), Subject line, Salutation, 3 concise body paragraphs connecting candidate qualifications & achievements to the role, formal closing, and signature block with candidate name and phone.
- Return plain formatted text ready to print or copy. No markdown code fences.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You draft formal Bangladeshi job applications and executive cover letters with precise etiquette and clear alignment to job circulars.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = (response.text ?? '').trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned an empty response.' });
      return;
    }
    res.json({ text });
  } catch (err) {
    const { status, message } = getErrorStatusAndMessage(err);
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  const PORT = 3000;
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
