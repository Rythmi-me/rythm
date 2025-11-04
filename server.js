// server.js - With Real Web Search Capability
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

// ✅ Serve frontend files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 API KEYS - Use environment variables (Render-safe)
const SERPER_API_KEY = process.env.SERPER_API_KEY || ''; // Get from https://serper.dev
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''; // Your Groq key

// Files for different memory types
const PERMANENT_MEMORY_FILE = 'permanent_memory.json';
const SESSION_MEMORY_FILE = 'session_memory.json';

// Single secret code and AI Name
const SECRET_CODE = '.myth';
const AI_NAME = 'Rythm';

// Load memories
let permanentMemory = loadMemory(PERMANENT_MEMORY_FILE);
let sessionMemory = loadMemory(SESSION_MEMORY_FILE);

// ========== CORE HELPER FUNCTIONS ==========

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

function containsSecretCode(message) {
    return message.includes(SECRET_CODE);
}

function extractMemoryContent(message) {
    return message.replace(SECRET_CODE, '').trim();
}

function filterAIResponse(response) {
    return response.replace(/\.myth/g, '');
}

function cleanQueryForWikipedia(query) {
    return query
        .replace(/current|latest|today|now|2024|2025|who is|what is/gi, '')
        .replace(/\?/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ========== ENHANCED LIVE DATA FUNCTIONS ==========

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
            Promise.any(sources.filter(source => source !== null)),
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

// 🆕 REAL WEB SEARCH using Serper API
async function tryRealWebSearch(query) {
    try {
        console.log('🌐 Trying real web search...');
        
        if (!SERPER_API_KEY) {
            console.log('❌ Serper API key not configured');
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
        if (data.organic && data.organic.length > 0) {
            const results = data.organic.slice(0, 3);
            const searchInfo = results.map(r =>
                `• ${r.title}\n  🔗 ${r.link}\n  ${r.snippet || 'No description'}`
            ).join('\n\n');
            
            return {
                status: 'found',
                source: 'Web Search',
                content: `WEB SEARCH RESULTS for "${query}":\n\n${searchInfo}\n\nThese are real Google search results.`,
                confidence: 'high',
                hasWebResults: true
            };
        }
        return null;
    } catch (error) {
        console.log('❌ Real web search failed:', error.message);
        return null;
    }
}

// PEOPLE-SPECIFIC SEARCH
async function tryPeopleSearch(query) {
    try {
        console.log('👤 Trying people search...');
        if (isPersonQuery(query)) {
            const peopleQuery = `${query} linkedin OR instagram OR facebook OR profile OR bio`;
            return await tryRealWebSearch(peopleQuery);
        }
        return null;
    } catch {
        return null;
    }
}

// ALTERNATIVE WEB SEARCH (no API key)
async function tryAlternativeWebSearch(query) {
    try {
        console.log('🔍 Trying alternative web search...');
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&t=chatbot`);
        if (!response.ok) return null;
        const data = await response.json();
        
        const info = [];
        if (data.AbstractText) info.push(`Summary: ${data.AbstractText}`);
        if (data.Answer) info.push(`Answer: ${data.Answer}`);
        if (info.length > 0) {
            return { status: 'found', source: 'Enhanced Search', content: info.join('\n\n'), confidence: 'medium' };
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

// Wikipedia API
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

// DuckDuckGo knowledge
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

// ========== EXPRESS SETUP ==========
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// SYSTEM PROMPT
const SYSTEM_PROMPT = `You are ${AI_NAME}, a helpful AI assistant with real web search capability.`;

// ========== ROUTES ==========

// Enhanced chat endpoint
app.post('/chat', async (req, res) => {
    const { message, clearHistory = false } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    console.log('📨 Received message:', message);

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

    const systemMessage = SYSTEM_PROMPT + (liveData && liveData.status === 'found'
        ? `\n\nLIVE DATA FROM ${liveData.source}:\n${liveData.content}`
        : '');

    const messages = [
        { role: 'system', content: systemMessage },
        ...sessionMemory.slice(-10),
        { role: 'user', content: processedMessage }
    ];

    const requestData = JSON.stringify({
        messages: messages,
        model: 'llama-3.1-8b-instant',
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

// Clear memory routes
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
        secretCode: SECRET_CODE,
        aiName: AI_NAME,
        hasWebSearch: true
    });
});

// Test route
app.get('/test', (req, res) => {
    res.json({ message: '✅ Server is working!' });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 AI Name: ${AI_NAME}`);
    console.log(`🔐 Secret Code: ${SECRET_CODE}`);
});
