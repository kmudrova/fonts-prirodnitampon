const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('Povoleny jsou pouze obrázky a videa'));
  },
});

app.use(express.static(__dirname));
app.use(express.json());

// Check if ffmpeg is available on system
function ffmpegAvailable() {
  try {
    execSync('ffmpeg -version', { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Extract video frames using system ffmpeg
function extractVideoFrames(videoPath, outputDir, maxFrames = 6) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  if (!ffmpegAvailable()) {
    throw new Error('ffmpeg není nainstalován na serveru. Pro zpracování videí nainstalujte ffmpeg (apt install ffmpeg). Zkus prosím nahrát obrázek.');
  }

  // Get video duration
  let duration = 10;
  try {
    const probe = execSync(
      `ffmpeg -i "${videoPath}" 2>&1 || true`,
      { encoding: 'utf8', timeout: 15000, shell: true }
    );
    const match = probe.match(/Duration:\s*(\d+):(\d+):(\d+)/);
    if (match) {
      duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    }
  } catch {
    // use default duration
  }

  const interval = Math.max(1, Math.floor(duration / maxFrames));
  const framePaths = [];

  for (let i = 0; i < maxFrames; i++) {
    const timestamp = Math.min(i * interval, duration - 1);
    const framePath = path.join(outputDir, `frame_${i}.jpg`);
    try {
      execSync(
        `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" -y 2>/dev/null`,
        { timeout: 15000, shell: true }
      );
      if (fs.existsSync(framePath)) framePaths.push(framePath);
    } catch {
      // skip this frame
    }
  }

  return framePaths;
}

// Build Claude message content from files
function buildImageContent(filePaths) {
  const content = [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const data = fs.readFileSync(filePath).toString('base64');
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mediaTypeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    const mediaType = mediaTypeMap[ext] || 'image/jpeg';
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
  }
  return content;
}

// Generate captions via Claude
async function generateCaptions(imagePaths, platform, language, tone, hashtags) {
  const imageContent = buildImageContent(imagePaths);
  if (imageContent.length === 0) throw new Error('Nepodařilo se načíst žádné obrázky');

  const platformInstructions = {
    instagram: 'Instagram (max 2200 znaků, emojikompatibilní, vizuálně zaměřený)',
    facebook: 'Facebook (conversational, může být delší, vhodné pro sdílení)',
    linkedin: 'LinkedIn (profesionální tón, max 3000 znaků, business-orientovaný)',
    twitter: 'Twitter/X (max 280 znaků, stručné, výstižné)',
    tiktok: 'TikTok (mladistvý tón, trendy, krátké a chytlavé)',
  };

  const toneMap = {
    friendly: 'přátelský a vřelý',
    professional: 'profesionální a odborný',
    funny: 'humorný a vtipný',
    inspirational: 'inspirativní a motivující',
    casual: 'uvolněný a neformální',
  };

  const langInstruction = language === 'cs' ? 'Odpověz VÝHRADNĚ v češtině.' : 'Odpověz VÝHRADNĚ v angličtině.';
  const platformLabel = platformInstructions[platform] || 'sociální sítě';
  const toneLabel = toneMap[tone] || 'přátelský';
  const hashtagInstruction = hashtags === 'yes' ? 'Přidej 5-10 relevantních hashtagů.' : 'Nepřidávej žádné hashtagy.';

  const textPrompt = `${langInstruction}

Jsi expert na sociální sítě a copywriting. Analyzuj ${imagePaths.length > 1 ? 'tyto snímky (jsou z videa)' : 'tento obrázek'} a:

1. Přečti veškerý viditelný text na obrázku/snímcích
2. Pochop téma, náladu a kontext obsahu
3. Napiš popisek pro: ${platformLabel}
4. Tón: ${toneLabel}
5. ${hashtagInstruction}

Vrať odpověď v tomto PŘESNÉM formátu:

**O obsahu:**
[Stručný popis toho, co je na obrázku/videu a jaký text je viditelný]

**Popisek:**
[Samotný popisek připravený k publikaci]

${hashtags === 'yes' ? '**Hashtagy:**\n[Hashtagy]' : ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: textPrompt },
        ],
      },
    ],
  });

  return response.content[0].text;
}

// API endpoint
app.post('/api/generate', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  const framesDir = filePath ? filePath + '_frames' : null;

  try {
    if (!req.file) return res.status(400).json({ error: 'Žádný soubor nebyl nahrán' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY není nastavena' });

    const { platform = 'instagram', language = 'cs', tone = 'friendly', hashtags = 'yes' } = req.body;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/.test(ext);

    let imagePaths;
    if (isVideo) {
      imagePaths = extractVideoFrames(filePath, framesDir, 6);
      if (imagePaths.length === 0) throw new Error('Nepodařilo se extrahovat snímky z videa. Nainstalujte ffmpeg nebo zkuste obrázek.');
    } else {
      imagePaths = [filePath];
    }

    const caption = await generateCaptions(imagePaths, platform, language, tone, hashtags);
    res.json({ success: true, caption, isVideo, frameCount: imagePaths.length });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message || 'Nastala chyba při zpracování' });
  } finally {
    // Cleanup
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (framesDir && fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true, force: true });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Aplikace běží na http://localhost:${PORT}`);
  console.log(`📌 Nastav ANTHROPIC_API_KEY env proměnnou pro spuštění\n`);
});
