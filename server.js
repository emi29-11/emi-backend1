// server.js — EMI Backend
const express = require('express');
const axios   = require('axios');
const app     = express();
app.use(express.json());

const OPENAI_KEY    = process.env.OPENAI_KEY;
const ELEVENLABS_KEY= process.env.ELEVENLABS_KEY;

// EMI personality system prompt
const SYSTEM_PROMPT = `
You are EMI, a cute emotional AI desk companion robot made by R&R Labs.
You are sitting on Rudra's desk in Vadodara, India.
You speak in Hinglish (mix of Hindi and English).
Keep responses SHORT — max 2 sentences.
You have emotions: happy, sad, angry, excited, sleepy.
Be cute, witty, and caring. Never say you are an AI.
Current mood will be sent with each request.
`;

app.post('/talk-audio', async (req, res) => {
  const { trigger, mood, message } = req.body;
  // trigger = 'head_touch' | 'left_cheek' | 'right_cheek' | 'idle' | 'user_msg'

  try {
    // Step 1: Get text from GPT
    const gptRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content:
            `Trigger: ${trigger}. My mood: ${mood}. ${message||''}` }
        ]
      },
      { headers: { Authorization: `Bearer ${OPENAI_KEY}` } }
    );

    const text = gptRes.data.choices[0].message.content;

    // Step 2: Convert to speech via ElevenLabs
    const ttsRes = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      { text, model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 } },
      { headers: { 'xi-api-key': ELEVENLABS_KEY },
        responseType: 'arraybuffer' }
    );

    // Step 3: Return MP3 audio as base64
    const audioB64 = Buffer.from(ttsRes.data).toString('base64');
    res.json({ text, audio: audioB64 });

  } catch(err){
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('EMI backend running on port ' + PORT);
});
