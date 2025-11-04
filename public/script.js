// script.js - Enhanced with Code Formatting and Copy Buttons
class Chatbot {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.clearBtn = document.getElementById('clear-btn');
        
        this.init();
    }

    init() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 100) + 'px';
        });

        // Clear chat history
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearChat());
        }

        // Focus on input when page loads
        this.userInput.focus();
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        
        // Disable input while processing
        this.setInputState(false);
        
        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch('/chat', {

                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Process the response to format code blocks
            const formattedResponse = this.formatCodeBlocks(data.response);
            this.addMessage(formattedResponse, 'bot');

            // Update AI name if provided
            if (data.aiName) {
                this.updateAiName(data.aiName);
            }

        } catch (error) {
            console.error('Error:', error);
            this.addMessage(
                "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.", 
                'bot'
            );
        } finally {
            this.hideTypingIndicator();
            this.setInputState(true);
            this.userInput.focus();
        }
    }

    // Enhanced message formatting with code support
    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = sender === 'user' ? 'You' : 'RY';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // If content is already processed HTML, use it directly
        if (typeof content === 'string' && content.includes('<div class="code-block">')) {
            messageContent.innerHTML = content;
        } else {
            messageContent.innerHTML = this.formatCodeBlocks(content);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        
        // Remove welcome message after first user message
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage && sender === 'user') {
            welcomeMessage.remove();
        }

        // Remove secret code hint after first user message
        const codeHint = this.chatMessages.querySelector('.secret-code-hint');
        if (codeHint && sender === 'user') {
            codeHint.remove();
        }
        
        // Initialize copy buttons for any new code blocks
        this.initializeCopyButtons();
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    // Format code blocks in the response
    formatCodeBlocks(text) {
        if (!text) return '';
        
        // Convert markdown-style code blocks to HTML
        let formattedText = text;
        
        // Handle ```code``` blocks
        formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = language || 'text';
            return this.createCodeBlock(code.trim(), lang);
        });
        
        // Handle `inline code`
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        // Handle basic indentation preservation
        formattedText = formattedText.replace(/\n/g, '<br>');
        formattedText = formattedText.replace(/    /g, '&nbsp;&nbsp;&nbsp;&nbsp;');
        formattedText = formattedText.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
        
        return formattedText;
    }

    // Create a formatted code block with copy button
    createCodeBlock(code, language = 'text') {
        const languageNames = {
            'js': 'JavaScript',
            'javascript': 'JavaScript',
            'python': 'Python',
            'py': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C',
            'php': 'PHP',
            'sql': 'SQL',
            'json': 'JSON',
            'xml': 'XML',
            'bash': 'Bash',
            'shell': 'Shell',
            'text': 'Code'
        };
        
        const langName = languageNames[language] || language;
        
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

    // Escape HTML to prevent XSS and preserve formatting
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize copy buttons for all code blocks
    initializeCopyButtons() {
        const codeBlocks = this.chatMessages.querySelectorAll('.code-block');
        codeBlocks.forEach(block => {
            const copyBtn = block.querySelector('.copy-btn');
            const code = block.querySelector('pre').textContent;
            
            copyBtn.addEventListener('click', () => {
                this.copyToClipboard(code);
                this.showCopyFeedback(copyBtn);
            });
        });
    }

    // Copy code to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }

    // Show copy feedback
    showCopyFeedback(button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }

    // Copy code function for onclick (global access)
    copyCode(button) {
        const codeBlock = button.closest('.code-block');
        const code = codeBlock.querySelector('pre').textContent;
        this.copyToClipboard(code);
        this.showCopyFeedback(button);
    }

    async clearChat() {
        try {
            const response = await fetch('http://localhost:3000/clear-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            // Clear the chat UI (keep only the first welcome message)
            const messages = this.chatMessages.querySelectorAll('.message');
            messages.forEach((msg, index) => {
                if (index > 0) {
                    msg.remove();
                }
            });
            
            // Show confirmation
            this.addMessage("Chat history has been cleared. Starting fresh conversation.", 'bot');
            
        } catch (error) {
            console.error('Error clearing history:', error);
            this.addMessage("Failed to clear history. Please try again.", 'bot');
        }
    }

    updateAiName(aiName) {
        const header = document.querySelector('.chat-header h1');
        if (header && header.textContent !== aiName) {
            header.textContent = aiName;
        }
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
        
        if (enabled) {
            this.sendBtn.style.opacity = '1';
        } else {
            this.sendBtn.style.opacity = '0.6';
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// Initialize chatbot when page loads
let chatbot;
document.addEventListener('DOMContentLoaded', () => {
    chatbot = new Chatbot();
});