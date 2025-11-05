// script.js - Enhanced with Code Formatting and Copy Buttons
class Chatbot {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.clearBtn = document.getElementById('clear-btn');
        
        // 🔹 Auto-detect base URL (Render or Local)
        this.baseURL = window.location.origin;
        
        this.init();
    }

    init() {
        this.sendBtn.onclick = () => this.sendMessage();
        this.userInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        // Auto-resize textarea
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 100) + 'px';
        });

        // Clear chat
        if (this.clearBtn) {
            this.clearBtn.onclick = () => this.clearChat();
        }

        this.userInput.focus();
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.setInputState(false);
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.baseURL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const data = await response.json();

            // 🔹 Merge live data + AI response
            let finalResponse = '';
            if (data.liveData && data.response) {
                finalResponse = `📊 **Live Data Update:**\n${data.liveData}\n\n🤖 **AI Insight:**\n${data.response}`;
            } else if (data.liveData) {
                finalResponse = `📊 **Live Data:**\n${data.liveData}`;
            } else {
                finalResponse = data.response || "No response received.";
            }

            this.addMessage(finalResponse, 'bot');

            if (data.aiName) this.updateAiName(data.aiName);

        } catch (err) {
            console.error('Error:', err);
            this.addMessage("⚠️ I'm having trouble connecting right now. Please try again.", 'bot');
        } finally {
            this.hideTypingIndicator();
            this.setInputState(true);
            this.userInput.focus();
        }
    }

    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = sender === 'user' ? 'You' : 'RY';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = this.formatCodeBlocks(content);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);

        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage && sender === 'user') welcomeMessage.remove();
        const codeHint = this.chatMessages.querySelector('.secret-code-hint');
        if (codeHint && sender === 'user') codeHint.remove();

        this.initializeCopyButtons();
        this.scrollToBottom();
    }

    formatCodeBlocks(text) {
        if (!text) return '';
        let formattedText = text;
        formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) =>
            this.createCodeBlock(code.trim(), lang || 'text')
        );
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        formattedText = formattedText.replace(/\n/g, '<br>');
        return formattedText;
    }

    createCodeBlock(code, lang = 'text') {
        const names = {
            js: 'JavaScript', py: 'Python', html: 'HTML', css: 'CSS', java: 'Java',
            cpp: 'C++', c: 'C', php: 'PHP', sql: 'SQL', json: 'JSON', xml: 'XML',
            bash: 'Bash', shell: 'Shell', text: 'Code'
        };
        const langName = names[lang] || lang;
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${langName}</span>
                    <button class="copy-btn" onclick="chatbot.copyCode(this)">Copy</button>
                </div>
                <pre>${this.escapeHtml(code)}</pre>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    initializeCopyButtons() {
        const blocks = this.chatMessages.querySelectorAll('.code-block');
        blocks.forEach(block => {
            const copyBtn = block.querySelector('.copy-btn');
            const code = block.querySelector('pre').textContent;
            copyBtn.onclick = () => {
                this.copyToClipboard(code);
                this.showCopyFeedback(copyBtn);
            };
        });
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }

    showCopyFeedback(btn) {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
        }, 2000);
    }

    copyCode(button) {
        const code = button.closest('.code-block').querySelector('pre').textContent;
        this.copyToClipboard(code);
        this.showCopyFeedback(button);
    }

    async clearChat() {
        try {
            await fetch(`${this.baseURL}/clear-session`, { method: 'POST' });
            this.chatMessages.innerHTML = '';
            this.addMessage("Chat history cleared. Starting fresh conversation.", 'bot');
        } catch {
            this.addMessage("Failed to clear chat. Please try again.", 'bot');
        }
    }

    updateAiName(name) {
        const header = document.querySelector('.chat-header h1');
        if (header && header.textContent !== name) header.textContent = name;
    }

    showTypingIndicator() {
        this.typingIndicator.classList.add('visible');
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.classList.remove('visible');
    }

    setInputState(enabled) {
        this.userInput.disabled = !enabled;
        this.sendBtn.disabled = !enabled;
        this.sendBtn.style.opacity = enabled ? '1' : '0.6';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// Initialize chatbot
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
    chatbot = new Chatbot();
});
