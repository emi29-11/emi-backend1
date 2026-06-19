// server.js — EMI Backend
const express = require('express');
const axios   = require('axios');
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

// Shared logic used by both GET and POST
async function generateAndSendAudio(trigger, mood, message, res) {
  try {
    // Step 1: Get text from Groq
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

    // Step 2: Convert to speech via Google Translate TTS
    const ttsText = text.substring(0, 200);

    const ttsRes = await axios.get(
      'https://translate.google.com/translate_tts',
      {
        params: {
          ie: 'UTF-8',
          q: ttsText,
          tl: 'hi',
          client: 'tw-ob'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        responseType: 'arraybuffer'
      }
    );

    // Step 3: Send raw MP3 bytes directly
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(ttsRes.data));

  } catch (err) {
    if (err.response && err.response.data) {
      console.error('ERROR FROM API:', Buffer.from(err.response.data).toString());
    } else {
      console.error('ERROR:', err.message);
    }
    res.status(500).send('error');
  }
}

// NEW: GET route — used by ESP32 (AudioFileSourceHTTPStream only does GET)
app.get('/talk-audio', async (req, res) => {
  const trigger = req.query.trigger || 'idle';
  const mood    = req.query.mood || 'normal';
  const message = req.query.message || '';
  await generateAndSendAudio(trigger, mood, message, res);
});

// OLD: POST route — kept for Postman/manual testing
app.post('/talk-audio', async (req, res) => {
  const { trigger, mood, message } = req.body;
  await generateAndSendAudio(trigger, mood, message, res);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('EMI backend running on port ' + PORT);
});
