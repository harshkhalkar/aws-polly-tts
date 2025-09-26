// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { PollyClient, SynthesizeSpeechCommand, DescribeVoicesCommand } = require('@aws-sdk/client-polly');

const PORT = process.env.PORT || 3000;
const REGION = process.env.AWS_REGION || 'us-east-1';

const polly = new PollyClient({ region: REGION });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Optional: expose a small /voices endpoint if you want to inspect voices in browser console.
// We'll still return voices but the synthesize endpoint will always use Matthew + neural.
app.get('/voices', async (req, res) => {
  try {
    const data = await polly.send(new DescribeVoicesCommand({ LanguageCode: 'en-US' }));
    res.json(data.Voices || []);
  } catch (err) {
    console.error('DescribeVoices error', err);
    res.status(500).json({ error: err.message || 'DescribeVoices failed' });
  }
});

// Synthesize endpoint - ALWAYS uses Matthew (en-US) with Neural engine
app.post('/synthesize', async (req, res) => {
  const { text, format = 'mp3', textType = 'text' } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required in request body' });
  }

  // Allowed formats: 'mp3', 'ogg_vorbis' (we avoid raw pcm for browser)
  const outFormat = format === 'ogg_vorbis' ? 'ogg_vorbis' : 'mp3';
  const mime = outFormat === 'mp3' ? 'audio/mpeg' : 'audio/ogg';

  const params = {
    Text: text,
    VoiceId: 'Matthew',           // FORCE Matthew (male, en-US)
    LanguageCode: 'en-US',        // explicit US English
    OutputFormat: outFormat,      // 'mp3' or 'ogg_vorbis'
    Engine: 'neural',             // FORCE neural (natural) voice
    TextType: textType            // 'text' or 'ssml'
  };

  try {
    const cmd = new SynthesizeSpeechCommand(params);
    const data = await polly.send(cmd);

    // data.AudioStream is an async iterable - buffer it
    const chunks = [];
    for await (const chunk of data.AudioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    const extension = outFormat === 'ogg_vorbis' ? 'ogg' : 'mp3';
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="speech.${extension}"`,
      'Content-Length': audioBuffer.length
    });

    res.send(audioBuffer);
  } catch (err) {
    console.error('SynthesizeSpeech error', err);
    // If AWS SDK returns structured error, attempt to return useful message
    const msg = err && err.message ? err.message : 'SynthesizeSpeech failed';
    res.status(500).json({ error: msg });
  }
});

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
