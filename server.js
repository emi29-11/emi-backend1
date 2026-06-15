// server.js — EMI Backend
const express = require('express');
const axios   = require('axios');
const app     = express();
app.use(express.json());

const GROQ_KEY       = process.env.GROQ_KEY;
const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY;

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

app.post('/talk-audio', async (req, res) => {
  const { trigger, mood, message } = req.body;

  try {
    // Step 1: Get text from Groq (free, OpenAI-compatible)
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

    // Step 2: Convert to speech via ElevenLabs
    const ttsRes = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      { text, model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 } },
      { headers: { 'xi-api-key': ELEVENLABS_KEY },
        responseType: 'arraybuffer' }
    );

    // Step 3: Send raw MP3 bytes directly (ESP32 streams this)
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(ttsRes.data));

  } } catch (err) {
    if (err.response && err.response.data) {
      console.error('ERROR FROM API:', Buffer.from(err.response.data).toString());
    } else {
      console.error('ERROR:', err.message);
    }
    res.status(500).send('error');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('EMI backend running on port ' + PORT);
});
