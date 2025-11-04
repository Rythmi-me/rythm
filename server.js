// =============================================
// 🚀 Rythm AI - with Real Web Search (Serper + Groq)
// =============================================
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

// ✅ Serve frontend files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 API KEYS (Render-safe via environment variables)
const SERPER_API_KEY = process.env.SERPER_API_KEY || ''; // Get from https://serper.dev
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''; // Your Groq key

// 🧠 Memory files
const PERMANENT_MEMORY_FILE = 'permanent_memory.json';
const SESSION_MEMORY_FILE = 'session_memory.json';

// 💬 AI Identity
const SECRET_CODE = '.myth';
const AI_NAME = 'Rythm';

// ======== Memory Handling =========
function loadMemory(filename) {
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8');
      console.log(`📂 Loaded ${filename}`);
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error);
  }
  return [];
}

function saveMemory(data, filename) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${filename}`);
  } catch (error) {
    console.error(`❌ Error saving ${filename}:`, error);
  }
}

let permanentMemory = loadMemory(PERMANENT_MEMORY_FILE);
let sessionMemory = loadMemory(SESSION_MEMORY_FILE);

function containsSecretCode(message) {
  return message.includes(SECRET_CODE);
}

function extractMemoryContent(message) {
  return message.replace(SECRET_CODE, '').trim();
}

function filterAIResponse(response) {
  return response.replace(/\.myth/g, '');
}

// ========= Helper =========
function cleanQueryForWikipedia(query) {
  return query
    .replace(/current|latest|today|now|2024|2025|who is|what is/gi, '')
    .replace(/\?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================
// 🔍 LIVE SEARCH FUNCTIONS
// =============================================

async function getLiveData(query) {
  try {
    console.log('🔍 Searching for live data...');
    const sources = [
      tryPeopleSearch(query),
      tryRealWebSearch(query),
      tryAlternativeWebSearch(query),
      tryWikipediaAPI(query),
      tryEnhancedDuckDuckGo(query)
    ];

    const result = await Promise.race([
      Promise.any(sources.filter(s => s !== null)),
      new Promise(resolve => setTimeout(() => resolve({ status: 'not_found' }), 12000))
    ]);

    if (result && result.status !== 'not_found') {
      console.log('✅ Live data found from:', result.source);
      return result;
    }

    console.log('❌ No live data found');
    return { status: 'not_found', query: query };
  } catch (error) {
    console.error('❌ Live data error:', error);
    return { status: 'not_found', query: query };
  }
}

// ✅ FIXED: REAL WEB SEARCH (Serper API)
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 })
    });

    if (!response.ok) throw new Error(`Serper API error: ${response.status}`);
    const data = await response.json();

    const results = [
      ...(data.organic || []),
      ...(data.news || []),
      ...(data.shopping || []),
      ...(data.videos || []),
    ].slice(0, 5);

    if (results.length === 0) {
      console.log('⚠️ No results found in Serper data');
      return null;
    }

    const searchInfo = results.map((r, i) => `
${i + 1}. ${r.title}
🔗 ${r.link}
${r.snippet || 'No description available.'}`).join('\n\n');

    return {
      status: 'found',
      source: 'Web Search',
      content: `According to live Google search results:\n\n${searchInfo}\n\nThese are real-time results fetched using Serper API.`,
      confidence: 'high',
      hasWebResults: true
    };
  } catch (error) {
    console.log('❌ Serper API fetch failed:', error.message);
    return null;
  }
}

// 🧍 Person-specific queries
async function tryPeopleSearch(query) {
  try {
    console.log('👤 Trying people search...');
    if (isPersonQuery(query)) {
      const peopleQuery = `${query} linkedin OR instagram OR biography OR profile`;
      return await tryRealWebSearch(peopleQuery);
    }
    return null;
  } catch {
    return null;
  }
}

function isPersonQuery(query) {
  const words = query.split(' ').filter(w => w.length > 2);
  return words.length >= 2 && words.length <= 4;
}

// 🦆 DuckDuckGo alternative API
async function tryAlternativeWebSearch(query) {
  try {
    console.log('🦆 DuckDuckGo backup...');
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    if (!response.ok) return null;
    const data = await response.json();

    if (data.AbstractText) {
      return {
        status: 'found',
        source: 'DuckDuckGo',
        content: data.AbstractText,
        confidence: 'medium'
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 📘 Wikipedia API
async function tryWikipediaAPI(query) {
  try {
    const cleanQuery = cleanQueryForWikipedia(query);
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`);
    if (response.status === 200) {
      const data = await response.json();
      if (data.extract && data.extract.length > 50) {
        return { status: 'found', source: 'Wikipedia', content: data.extract, confidence: 'high' };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// 🦆 Knowledge Graph backup
async function tryEnhancedDuckDuckGo(query) {
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.AbstractText) {
      return { status: 'found', source: 'Knowledge Graph', content: data.AbstractText, confidence: 'medium' };
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================
// 🧠 EXPRESS ROUTES
// =============================================
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const SYSTEM_PROMPT = `You are ${AI_NAME}, a smart AI assistant with real-time web search capability. Provide short, factual, clear responses based on reliable data.`;

// 💬 Chat endpoint
app.post('/chat', async (req, res) => {
  const { message, clearHistory = false } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  console.log('📨 Message:', message);
  if (clearHistory) {
    sessionMemory = [];
    saveMemory(sessionMemory, SESSION_MEMORY_FILE);
  }

  const isPermanent = containsSecretCode(message);
  const processedMessage = extractMemoryContent(message);

  let liveData = null;
  if (processedMessage.length > 5) {
    liveData = await getLiveData(processedMessage);
  }

  // ✅ IMPROVED: Make Groq use live data
  let systemMessage = SYSTEM_PROMPT;
  if (liveData && liveData.status === 'found' && liveData.content) {
    systemMessage += `\n\nHere are the latest verified web search results:\n${liveData.content}\n\nUse these results to give the user the most current and factual answer possible. Do NOT say "as of my knowledge cutoff" — this data is current.`;
  }

  const messages = [
    { role: 'system', content: systemMessage },
    ...sessionMemory.slice(-10),
    { role: 'user', content: processedMessage }
  ];

  const requestData = JSON.stringify({
    messages: messages,
    model: 'llama-3.1-8b-instant',
    temperature: 0.7,
    max_tokens: 600
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
    },
    timeout: 15000
  };

  const request = https.request(options, (apiResponse) => {
    let responseData = '';
    apiResponse.on('data', (chunk) => (responseData += chunk));
    apiResponse.on('end', () => {
      try {
        const parsedData = JSON.parse(responseData);
        if (parsedData.choices && parsedData.choices[0]?.message?.content) {
          let botResponse = parsedData.choices[0].message.content;
          botResponse = filterAIResponse(botResponse);

          sessionMemory.push({ role: 'user', content: message }, { role: 'assistant', content: botResponse });
          if (sessionMemory.length > 40) sessionMemory = sessionMemory.slice(-40);
          saveMemory(sessionMemory, SESSION_MEMORY_FILE);

          res.json({ response: botResponse, aiName: AI_NAME });
        } else {
          res.status(500).json({ error: 'Unexpected API response' });
        }
      } catch {
        res.status(500).json({ error: 'Failed to parse API response' });
      }
    });
  });

  request.on('error', (err) => res.status(500).json({ error: err.message }));
  request.write(requestData);
  request.end();
});

// 🧹 Clear memory routes
app.post('/clear-session', (req, res) => {
  sessionMemory = [];
  saveMemory(sessionMemory, SESSION_MEMORY_FILE);
  res.json({ message: 'Session memory cleared' });
});

app.post('/clear-permanent', (req, res) => {
  permanentMemory = [];
  saveMemory(permanentMemory, PERMANENT_MEMORY_FILE);
  res.json({ message: 'Permanent memory cleared' });
});

app.get('/memory-info', (req, res) => {
  res.json({
    sessionSize: sessionMemory.length,
    permanentSize: permanentMemory.length,
    aiName: AI_NAME,
    hasWebSearch: true
  });
});

// 🧪 Test route
app.get('/test', (req, res) => {
  res.json({ message: '✅ Server is working fine!' });
});

// =============================================
// 🚀 START SERVER
// =============================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Rythm AI running on port ${PORT}`);
  console.log(`🌍 Live Search Active: ${!!SERPER_API_KEY}`);
});
