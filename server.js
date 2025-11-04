// server.js - Rythm AI with Real Web Search (Final Stable Version)
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // ✅ Ensure fetch works in Node
const app = express();

// ✅ Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 API KEYS (Set these in Render Environment Variables or here for local testing)
const SERPER_API_KEY = process.env.SERPER_API_KEY || 'your_serper_api_key_here'; // from https://serper.dev
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'your_groq_api_key_here'; // from https://console.groq.com

// 🔒 Files for Memory
const PERMANENT_MEMORY_FILE = 'permanent_memory.json';
const SESSION_MEMORY_FILE = 'session_memory.json';

// 🧠 Config
const SECRET_CODE = '.myth';
const AI_NAME = 'Rythm';

// 🧩 Load memories
let permanentMemory = loadMemory(PERMANENT_MEMORY_FILE);
let sessionMemory = loadMemory(SESSION_MEMORY_FILE);

// ========== MEMORY HANDLING ==========
function loadMemory(filename) {
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error loading ${filename}:`, e);
  }
  return [];
}

function saveMemory(data, filename) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Error saving ${filename}:`, e);
  }
}

// ========== TEXT CLEANERS ==========
function containsSecretCode(message) {
  return message.includes(SECRET_CODE);
}

function extractMemoryContent(message) {
  return message.replace(SECRET_CODE, '').trim();
}

function filterAIResponse(response) {
  return response.replace(/\.myth/g, '');
}

// ========== CLEAN QUERY ==========
function cleanQueryForWikipedia(query) {
  return query
    .replace(/current|latest|today|now|2024|2025|who is|what is/gi, '')
    .replace(/\?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ========== REAL-TIME DATA HANDLING ==========
async function getLiveData(query) {
  try {
    console.log('🔍 Searching for live data...');

    const sources = [
      tryRealWebSearch(query),
      tryWikipediaAPI(query),
      tryAlternativeWebSearch(query)
    ];

    const result = await Promise.race([
      Promise.any(sources.filter(Boolean)),
      new Promise(resolve => setTimeout(() => resolve({ status: 'not_found' }), 10000))
    ]);

    if (result && result.status !== 'not_found') {
      console.log('✅ Live data found from:', result.source);
      return result;
    }

    console.log('❌ No live data found');
    return { status: 'not_found', query: query };
  } catch (error) {
    console.error('Live data error:', error);
    return { status: 'not_found', query: query };
  }
}

// 🧠 SERPER API SEARCH (Google Results)
async function tryRealWebSearch(query) {
  try {
    console.log('🌐 Using Serper API...');
    if (!SERPER_API_KEY) {
      console.log('❌ Missing Serper API Key');
      return null;
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num: 5 })
    });

    if (!response.ok) throw new Error(`Serper API error: ${response.status}`);
    const data = await response.json();

    if (data.organic && data.organic.length > 0) {
      const results = data.organic.slice(0, 3);
      const info = results
        .map(r => `• ${r.title}\n🔗 ${r.link}\n${r.snippet || ''}`)
        .join('\n\n');

      return {
        status: 'found',
        source: 'Web Search',
        content: `According to web search results:\n\n${info}\n\nThese are real live Google search results.`,
        hasWebResults: true
      };
    }
    return null;
  } catch (e) {
    console.log('Serper search failed:', e.message);
    return null;
  }
}

// 🧩 Alternative Search - DuckDuckGo
async function tryAlternativeWebSearch(query) {
  try {
    console.log('🔍 DuckDuckGo backup...');
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await res.json();

    if (data.AbstractText) {
      return { status: 'found', source: 'DuckDuckGo', content: data.AbstractText };
    }
    return null;
  } catch {
    return null;
  }
}

// 🧩 Wikipedia API
async function tryWikipediaAPI(query) {
  try {
    const cleanQuery = cleanQueryForWikipedia(query);
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.extract && data.extract.length > 50) {
        return { status: 'found', source: 'Wikipedia', content: data.extract };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ========== EXPRESS CONFIG ==========
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const SYSTEM_PROMPT = `You are ${AI_NAME}, a smart assistant with live web search capability.
When live data is found, use it directly.
If not, use your general knowledge but mention that you couldn’t find live updates.`;

// ========== MAIN CHAT ROUTE ==========
app.post('/chat', async (req, res) => {
  const { message, clearHistory = false } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  if (clearHistory) {
    sessionMemory = [];
    saveMemory(sessionMemory, SESSION_MEMORY_FILE);
  }

  const processed = extractMemoryContent(message);
  const liveData = await getLiveData(processed);

  let systemMessage = SYSTEM_PROMPT;
  if (liveData?.status === 'found') {
    systemMessage += `\n\nLIVE DATA SOURCE (${liveData.source}):\n${liveData.content}`;
  }

  const messages = [
    { role: 'system', content: systemMessage },
    ...sessionMemory.slice(-10),
    { role: 'user', content: processed }
  ];

  const requestData = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages,
    temperature: 0.7,
    max_tokens: 500
  });

  const options = {
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  const request = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => (data += chunk));
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const response = parsed.choices?.[0]?.message?.content || 'No response';
        const cleanResponse = filterAIResponse(response);

        sessionMemory.push({ role: 'user', content: message }, { role: 'assistant', content: cleanResponse });
        saveMemory(sessionMemory, SESSION_MEMORY_FILE);

        res.json({ response: cleanResponse, aiName: AI_NAME, source: liveData?.source || 'offline' });
      } catch {
        res.status(500).json({ error: 'Parsing error' });
      }
    });
  });

  request.on('error', err => res.status(500).json({ error: err.message }));
  request.write(requestData);
  request.end();
});

// ========== TEST ROUTES ==========
app.get('/test', (req, res) => res.json({ message: '✅ Rythm Server Running!' }));
app.post('/clear-session', (req, res) => {
  sessionMemory = [];
  saveMemory(sessionMemory, SESSION_MEMORY_FILE);
  res.json({ message: 'Session cleared' });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Rythm AI running on port ${PORT}`);
  console.log(`🌍 Live Search Active: ${!!SERPER_API_KEY}`);
});
