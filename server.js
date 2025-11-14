// server.js — FINAL WORKING VERSION
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Optional: serve static files

// Environment
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('GEMINI_API_KEY is missing in .env file!');
  process.exit(1);
}

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

// POST /api/generate — Generate text with safety handling
app.post('/api/generate', async (req, res) => {
  const { 
    model = 'gemini-pro', 
    prompt = '', 
    temperature = 0.4, 
    maxOutputTokens = 300 
  } = req.body;

  if (!prompt.trim()) {
    return res.status(400).json({ error: { message: 'Prompt is required' } });
  }

  try {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature, 
        maxOutputTokens,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    console.log(`Generating with model: ${model}`);
    const response = await axios.post(url, body, { 
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    const candidate = response.data.candidates?.[0];

    if (!candidate) {
      return res.json({ outputText: 'দুঃখিত, উত্তর তৈরি হয়নি। আবার চেষ্টা করুন।' });
    }

    const text = candidate.content?.parts?.[0]?.text;

    if (text) {
      res.json({ outputText: text.trim() });
    } else {
      const reason = candidate.finishReason;
      if (reason === 'SAFETY') {
        res.json({ outputText: 'দুঃখিত, এই প্রশ্নের উত্তর দেওয়া যাচ্ছে না (নিরাপত্তা নীতি)। অন্যভাবে জিজ্ঞাসা করুন।' });
      } else {
        res.json({ outputText: `উত্তর তৈরি হয়নি। কারণ: ${reason || 'অজানা'}` });
      }
    }

  } catch (error) {
    console.error('Generate Error:', error.response?.data || error.message);

    const status = error.response?.status || 500;
    const apiMsg = error.response?.data?.error?.message || error.message;

    if (status === 404) {
      res.status(404).json({
        error: { message: `Model "${model}" not found. Use 'gemini-pro'.` }
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
    <h2>Ghughumari AI Proxy Server</h2>
    <p>Status: Running</p>
    <p>Endpoints:</p>
    <ul>
      <li>GET <a href="/api/models" target="_blank">/api/models</a></li>
      <li>POST /api/generate</li>
    </ul>
    <p><strong>Model:</strong> gemini-pro</p>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Live URL: ${process.env.RENDER_EXTERNAL_URL || 'https://ghughumari.onrender.com'}`);
});