const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
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
    console.error('Models Error:', err.response?.data || err.message); // Logging
    res.status(status).json({ error: body });
  }
});

// POST /api/generate -> fallback models + better error
app.post('/api/generate', async (req, res) => {
  let { model = 'models/gemini-1.5-flash-latest', prompt = '', temperature = 0.3, maxOutputTokens = 300 } = req.body || {}; // Default to stable model
  
  // Fallback if model invalid
  const fallbackModels = ['models/gemini-1.5-flash-latest', 'models/gemini-1.5-pro-latest', 'models/gemini-pro'];
  
  for (let currentModel of [model, ...fallbackModels]) {
    try {
      console.log(`Trying model: ${currentModel}`); // Logging
      // Try generateContent first (stable)
      const url = `${BASE}/${currentModel}:generateContent?key=${GEMINI_KEY}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens }
      };
      const r = await axios.post(url, body, { timeout: 30000 }); // 30s timeout
      console.log('Success with model:', currentModel);
      return res.json(r.data);
    } catch (err) {
      console.error(`Failed model ${currentModel}:`, err.response?.status, err.response?.data?.error?.message || err.message);
      if (err.response?.status !== 404) break; // If not model error, stop fallback
    }
  }
  
  // Final error
  res.status(404).json({ error: { message: 'Model not found or access denied. Available models: check /api/models. Key issue?' } });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});