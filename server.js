const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from project root so the HTML can be loaded from the same origin as the proxy
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. Create a .env file from .env.example and add your key.');
}

const BASE = 'https://generativelanguage.googleapis.com/v1/models';

// GET /api/models -> proxy ListModels
app.get('/api/models', async (req, res) => {
  try {
    const url = `${BASE}?key=${GEMINI_KEY}`;
    const r = await axios.get(url, { timeout: 20000 });
    res.json(r.data);
  } catch (err) {
    const status = err.response ? err.response.status : 500;
    const body = err.response ? err.response.data : { message: err.message };
    res.status(status).json({ error: body });
  }
});

// POST /api/generate -> proxy generateMessage (chat) first, fallback to generateContent
app.post('/api/generate', async (req, res) => {
  const { model = 'models/gemini-2.5-pro', prompt = '', temperature = 0.3, maxOutputTokens = 300 } = req.body || {};
  try {
    // Try generateMessage (chat-style)
    const url = `${BASE}/${model}:generateMessage?key=${GEMINI_KEY}`;
    const body = {
      messages: [
        { author: 'user', content: [{ type: 'text', text: prompt }] }
      ],
      temperature,
      maxOutputTokens
    };
    const r = await axios.post(url, body, { timeout: 20000 });
    return res.json(r.data);
  } catch (err) {
    // If generateMessage failed for compatibility, try generateContent
    const is404 = err.response && err.response.status === 404;
    const errText = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    if (!is404 && !(String(errText).toLowerCase().includes('generatecontent') || String(errText).toLowerCase().includes('not supported'))) {
      return res.status(err.response ? err.response.status : 500).json({ error: errText });
    }

    try {
      const url2 = `${BASE}/${model}:generateContent?key=${GEMINI_KEY}`;
      const body2 = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens }
      };
      const r2 = await axios.post(url2, body2, { timeout: 20000 });
      return res.json(r2.data);
    } catch (err2) {
      const bodyErr = err2.response && err2.response.data ? err2.response.data : { message: err2.message };
      return res.status(err2.response ? err2.response.status : 500).json({ error: bodyErr });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
