// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Optional: serve static files (if HTML in same folder)

// Environment
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('GEMINI_API_KEY is missing! Add it to .env file.');
  process.exit(1);
}

// Base URL for Gemini API
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1/models';

// GET /api/models — List available models
app.get('/api/models', async (req, res) => {
  try {
    const url = `${GEMINI_BASE}?key=${GEMINI_KEY}`;
    const response = await axios.get(url, { timeout: 20000 });
    res.json(response.data);
  } catch (error) {
    console.error('Models API Error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const msg = error.response?.data?.error?.message || 'Failed to fetch models';
    res.status(status).json({ error: { message: msg } });
  }
});

// POST /api/generate — Generate text using Gemini
app.post('/api/generate', async (req, res) => {
  let { 
    model = 'gemini-pro', 
    prompt = '', 
    temperature = 0.4, 
    maxOutputTokens = 300 
  } = req.body;

  // Force gemini-pro (free & accessible to all)
  model = 'gemini-pro';

  if (!prompt.trim()) {
    return res.status(400).json({ error: { message: 'Prompt is required' } });
  }

  try {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`;
    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
        topP: 0.8,
        topK: 40
      }
    };

    console.log(`Generating with model: ${model}`);
    const response = await axios.post(url, body, { 
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const text = candidates[0].content.parts[0].text;
    res.json({ outputText: text });

  } catch (error) {
    console.error('Generate Error:', error.response?.data || error.message);

    const status = error.response?.status || 500;
    const apiMsg = error.response?.data?.error?.message || error.message;

    if (status === 404) {
      res.status(404).json({
        error: {
          message: `Model "${model}" not found or not accessible. Use 'gemini-pro'. Check your API key or model access.`
        }
      });
    } else if (status === 403) {
      res.status(403).json({
        error: { message: 'API key invalid or quota exceeded.' }
      });
    } else {
      res.status(status).json({
        error: { message: apiMsg }
      });
    }
  }
});

// Health check
app.get('/', (req, res) => {
  res.send(`
    <h2>Ghughumari Proxy Server</h2>
    <p>Status: Running</p>
    <p>Endpoints:</p>
    <ul>
      <li>GET /api/models</li>
      <li>POST /api/generate</li>
    </ul>
    <p><a href="/api/models" target="_blank">Test /api/models</a></p>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Proxy URL: ${process.env.RENDER_EXTERNAL_URL || 'https://ghughumari.onrender.com'}`);
});