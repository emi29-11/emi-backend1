// server.js — EMI Backend
const express = require('express');
const axios   = require('axios');
const { spawn } = require('child_process');
const app     = express();
app.use(express.json());

const GROQ_KEY = process.env.GROQ_KEY;

const SYSTEM_PROMPT = `
You are EMI, a cute emotional AI desk companion robot made by R&R Labs.
You are sitting on Rudra's desk in Vadodara, India.
You speak in Hinglish (mix of Hindi and English).
Keep responses SHORT — max 2 sentences.
You have emotions: happy, sad, angry, excited, sleepy.
Be cute, witty, and caring. Never say you are an AI.
Current mood will be sent with each request.
`;

app.get('/', (req, res) => {
  res.send('EMI backend is running ✅');
});

// Convert MP3 buffer to WAV buffer (16-bit PCM, mono, 22050Hz) using ffmpeg
function mp3ToWav(mp3Buffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-f', 'wav',
      '-ar', '22050',
      '-ac', '1',
      '-acodec', 'pcm_s16le',
      'pipe:1'
    ]);

    const chunks = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {}); // suppress ffmpeg logs
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error('ffmpeg exited with code ' + code));
    });
    ffmpeg.on('error', reject);

    ffmpeg.stdin.write(mp3Buffer);
    ffmpeg.stdin.end();
  });
}

async function generateAndSendAudio(trigger, mood, message, res) {
  try {
    const gptRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 60,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content:
            `Trigger: ${trigger}. My mood: ${mood}. ${message || ''}` }
        ]
      },
      { headers: { Authorization: `Bearer ${GROQ_KEY}` } }
    );

    const text = gptRes.data.choices[0].message.content;
    console.log('EMI says:', text);

    const ttsText = text.substring(0, 200);

    const ttsRes = await axios.get(
      'https://translate.google.com/translate_tts',
      {
        params: { ie: 'UTF-8', q: ttsText, tl: 'hi', client: 'tw-ob' },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        responseType: 'arraybuffer'
      }
    );

    const mp3Buffer = Buffer.from(ttsRes.data);
    const wavBuffer = await mp3ToWav(mp3Buffer);

    res.set('Content-Type', 'audio/wav');
    res.send(wavBuffer);

  } catch (err) {
    console.error('ERROR:', err.message);
    res.status(500).send('error');
  }
}

app.get('/talk-audio', async (req, res) => {
  const trigger = req.query.trigger || 'idle';
  const mood    = req.query.mood || 'normal';
  const message = req.query.message || '';
  await generateAndSendAudio(trigger, mood, message, res);
});

app.post('/talk-audio', async (req, res) => {
  const { trigger, mood, message } = req.body;
  await generateAndSendAudio(trigger, mood, message, res);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('EMI backend running on port ' + PORT);
});
