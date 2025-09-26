# **AWS Polly TTS App**

# **Project Overview**

This project is a Text-to-Speech (TTS) web application built with AWS Polly, Node.js/Express, and a simple HTML frontend. Users can type text, choose the voice (e.g., Matthew, Neural), and download the generated audio file. The app is containerized with Docker for portability and can be deployed securely on AWS EC2 or ECS with IAM roles.

# **Features**

- Convert text to voice using AWS Polly.
- Use Neural voices (natural-sounding).
- Simple web UI with a text box and download button.
- Containerized for easy deployment.

# **Tech Stack**

- Backend: Node.js, Express, AWS SDK for JavaScript
- Frontend: HTML, CSS, basic JavaScript
- Cloud Service: AWS Polly (Text-to-Speech)
- Deployment: Docker (EC2 or ECS Fargate)
- IAM: Instance Role (EC2) or Task Role (ECS)

# Setup (Local Devlopment)

## Prerequisites

- Node.js & npm
- Docker (if running in container)
- IAM role with policy

# Create Work Directory

```bash
mkdir polly
cd polly
mkdir public
npm init -y
```

## Install Dependencies

`npm install express cors body-parser dotenv @aws-sdk/client-polly`

## Run Locally

`node server.js`

# Structure

```bash
polly/
├── public/
│   └── index.html     # Frontend
├── server.js          # Express server
├── package.json
├── package-lock.json
└── Dockerfile         # Container setup
```

# Code Snippets

## server.js (Backend)

```jsx
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
```

## public/index.html (Frontend)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Polly TTS — Matthew (en-US, Neural)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        /* ----- VARIABLES ----- */
        :root {
            --primary-bg: #FEF3E2;
            --secondary-bg: #FAB12F;
            --accent: #FA812F;
            --cta: #DD0303;
            --text-primary: #2D3748;
            --text-secondary: #4A5568;
            --text-muted: #718096;
            --border-radius: 12px;
            --shadow-sm: 0 4px 6px rgba(0, 0, 0, 0.05);
            --shadow-md: 0 8px 15px rgba(0, 0, 0, 0.07);
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ----- RESET & BASE STYLES ----- */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--primary-bg);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            animation: fadeIn 0.8s ease-out forwards;
        }

        /* ----- LAYOUT & CONTAINERS ----- */
        .container {
            width: 100%;
            max-width: 900px;
            margin: 0 auto;
            padding: 30px;
            background: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-md);
            opacity: 0;
            transform: translateY(20px);
            animation: slideUp 0.8s ease-out 0.2s forwards;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            opacity: 0;
            animation: fadeIn 0.8s ease-out 0.4s forwards;
        }

        /* ----- TYPOGRAPHY ----- */
        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }

        .subtitle {
            font-size: 1.1rem;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .voice-info {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            background: rgba(250, 177, 47, 0.1);
            color: var(--accent);
            border-radius: 20px;
            font-weight: 500;
            margin-top: 12px;
            animation: fadeIn 0.8s ease-out 0.6s forwards;
            opacity: 0;
        }

        .voice-info i {
            margin-right: 8px;
        }

        /* ----- INPUT & CONTROLS ----- */
        .input-container {
            margin-bottom: 25px;
            opacity: 0;
            animation: fadeIn 0.8s ease-out 0.8s forwards;
        }

        textarea {
            width: 100%;
            min-height: 150px;
            padding: 16px;
            border: 2px solid rgba(250, 177, 47, 0.3);
            border-radius: var(--border-radius);
            font-size: 1rem;
            font-family: inherit;
            background: white;
            color: var(--text-primary);
            resize: vertical;
            transition: var(--transition);
            box-shadow: var(--shadow-sm);
        }

        textarea:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(250, 129, 47, 0.15);
        }

        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
            opacity: 0;
            animation: fadeIn 0.8s ease-out 1s forwards;
        }

        .format-selector {
            flex: 1;
            min-width: 200px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--text-secondary);
        }

        select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid rgba(250, 177, 47, 0.3);
            border-radius: var(--border-radius);
            font-size: 1rem;
            font-family: inherit;
            background: white;
            color: var(--text-primary);
            cursor: pointer;
            transition: var(--transition);
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23FA812F'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 16px center;
            background-size: 16px;
        }

        select:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(250, 129, 47, 0.15);
        }

        .action-buttons {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-self: flex-end;
        }

        /* ----- BUTTONS ----- */
        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 24px;
            border: none;
            border-radius: var(--border-radius);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            gap: 8px;
        }

        .btn-primary {
            background: var(--cta);
            color: white;
            box-shadow: 0 4px 6px rgba(221, 3, 3, 0.2);
        }

        .btn-primary:hover {
            background: #C10202;
            box-shadow: 0 6px 12px rgba(221, 3, 3, 0.25);
        }

        .btn-primary:active {
            /* No transform */
        }

        .btn-primary:disabled {
            background: #FCA5A5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .download-btn {
            display: inline-flex;
            background: var(--secondary-bg);
            color: var(--text-primary);
            box-shadow: 0 4px 6px rgba(250, 177, 47, 0.2);
            text-decoration: none;
            padding: 12px 24px;
            border-radius: var(--border-radius);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            gap: 8px;
            align-items: center;
            justify-content: center;
        }

        .download-btn:hover {
            background: #E5A02D;
            box-shadow: 0 6px 12px rgba(250, 177, 47, 0.25);
        }

        .download-btn:active {
            /* No transform */
        }

        .download-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* ----- AUDIO PLAYER ----- */
        .audio-container {
            margin-top: 25px;
            opacity: 0;
            transform: translateY(10px);
            transition: var(--transition);
        }

        .audio-container.show {
            opacity: 1;
            transform: translateY(0);
        }

        audio {
            width: 100%;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-sm);
        }

        .pulse-once {
            animation: pulse 0.6s ease-in-out 1;
        }

        /* ----- ANIMATIONS ----- */
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
            100% {
                transform: scale(1);
            }
        }

        /* Remove automatic pulsing */
        .btn-primary:not(:disabled) {
            /* animation: pulse 2s infinite; */
        }

        /* ----- RESPONSIVE DESIGN ----- */
        @media (max-width: 768px) {
            body {
                padding: 15px;
            }

            .container {
                padding: 20px;
            }

            h1 {
                font-size: 2rem;
            }

            .controls {
                flex-direction: column;
                align-items: stretch;
                justify-content: stretch;
            }

            .format-selector, .action-buttons {
                width: 100%;
            }

            .action-buttons {
                flex-direction: column;
                align-self: stretch;
            }

            button, .download-btn {
                width: 100%;
            }
        }

        @media (max-width: 480px) {
            h1 {
                font-size: 1.75rem;
            }

            .subtitle {
                font-size: 1rem;
            }

            .container {
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>Polly TTS — Matthew (en-US)</h1>
            <p class="subtitle">Convert your text to natural-sounding speech with AWS Polly's neural technology</p>
            <div class="voice-info">
                <i class="fas fa-microphone-alt"></i>
                <span>Matthew Voice (en-US) — Neural Engine</span>
            </div>
        </header>

        <div class="input-container">
            <textarea id="text" placeholder="Type or paste your text here...">Hello, this is Matthew — an AWS Polly neural voice in US English.</textarea>
        </div>

        <div class="controls">
            <div class="format-selector">
                <label for="format">Output Format</label>
                <select id="format">
                    <option value="mp3">MP3 (Recommended)</option>
                    <option value="ogg_vorbis">OGG Vorbis</option>
                </select>
            </div>

            <div class="action-buttons">
                <button id="convert" class="btn-primary">
                    <i class="fas fa-sync-alt"></i>
                    Convert & Play
                </button>
                <a id="download" class="download-btn" style="display: none;">
                    <i class="fas fa-download"></i>
                    Download Audio
                </a>
            </div>
        </div>

        <div class="audio-container" id="audio-container">
            <audio id="player" controls></audio>
        </div>
    </div>

    <script>
        // Wait for DOM to be fully loaded
        document.addEventListener('DOMContentLoaded', function() {
            const convertBtn = document.getElementById('convert');
            const downloadBtn = document.getElementById('download');
            const audioContainer = document.getElementById('audio-container');
            const downloadLink = document.getElementById('download');

            async function synthesize() {
                const text = document.getElementById('text').value;
                const format = document.getElementById('format').value;

                if (!text || !text.trim()) {
                    alert('Please enter some text to convert');
                    return;
                }

                const btn = document.getElementById('convert');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting...';
                btn.classList.add('pulse-once');
                setTimeout(() => {
                    btn.classList.remove('pulse-once');
                }, 2000);

                try {
                    const res = await fetch('/synthesize', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ text, format })
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => null);
                        throw new Error(err && err.error ? err.error : 'Synthesis failed');
                    }

                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);

                    const player = document.getElementById('player');
                    player.src = url;

                    // Show audio player with animation
                    audioContainer.classList.add('show');

                    // Try to play automatically
                    player.play().catch(() => {
                        console.log('Autoplay was prevented');
                    });

                    // Set up download link
                    downloadLink.href = url;
                    downloadLink.download = `speech.${format === 'ogg_vorbis' ? 'ogg' : 'mp3'}`;
                    downloadLink.style.display = 'inline-flex';

                    // Add animation to download button
                    downloadLink.style.animation = 'pulse 2s infinite';
                    setTimeout(() => {
                        downloadLink.style.animation = '';
                    }, 2000);

                } catch (e) {
                    alert('Error: ' + (e.message || e));
                    console.error(e);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Convert & Play';
                }
            }

            // Add event listeners
            convertBtn.addEventListener('click', synthesize);

            // Add animation to textarea on focus
            const textarea = document.getElementById('text');
            textarea.addEventListener('focus', function() {
                this.style.boxShadow = '0 0 0 3px rgba(250, 129, 47, 0.2)';
            });

            textarea.addEventListener('blur', function() {
                this.style.boxShadow = 'var(--shadow-sm)';
            });
        });
    </script>
</body>
</html>
```

# Containerization

## package.json

```json
{
  "name": "polly-matthew",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "@aws-sdk/client-polly": "^3.896.0",
    "body-parser": "^2.2.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.2",
    "express": "^5.1.0"
  }
}
```

## Dockerfile

```docker
FROM node:20-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache --virtual .gyp python3 make g++ || true
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .
RUN apk del .gyp || true
ENV PORT=3000
EXPOSE 3000
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node","server.js"]
```

## Build & Run

```bash
docker build -t polly-tts .
OR PULL THE IMAGE
docker pull harshkhalkar/aws-polly-app:v1
docker run -d -p <port>:3000 <image-name>
```

# Deployment Option

## EC2

- Attach IAM Instance Role with Polly policy.
- Run Docker Container or Without.

## ECS Fargate

- Push image to ECR.
- Create ECS Task Defination with Polly IAM Task Role.
