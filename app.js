// app.js - Main Application Logic

// State
let state = {
    theme: localStorage.getItem('nexus-theme') || 'blue',
    provider: localStorage.getItem('nexus-provider') || 'demo',
    apiKey: localStorage.getItem('nexus-apikey') || '',
    tasks: JSON.parse(localStorage.getItem('nexus-tasks')) || [],
    chatHistory: JSON.parse(localStorage.getItem('nexus-history')) || [],
    isWaitingForResponse: false
};

// DOM Elements
const els = {
    // Layout
    body: document.body,
    leftSidebar: document.querySelector('.left-sidebar'),
    rightSidebar: document.querySelector('.right-sidebar'),
    
    // Buttons
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileTasksBtn: document.getElementById('mobile-tasks-btn'),
    newChatBtn: document.getElementById('new-chat-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    
    // Chat Area
    chatMessages: document.getElementById('chat-messages'),
    welcomeContainer: document.getElementById('welcome-container'),
    chatForm: document.getElementById('chat-form'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    suggestionCards: document.querySelectorAll('.suggestion-card'),
    
    // Tasks
    taskCount: document.getElementById('task-count'),
    taskList: document.getElementById('task-list'),
    quickTaskInput: document.getElementById('quick-task-input'),
    addTaskBtn: document.getElementById('addTaskBtn') || document.getElementById('add-task-btn'),
    
    // Settings Modal
    settingsModal: document.getElementById('settings-modal'),
    closeModalBtn: document.querySelector('.close-modal-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    providerSelect: document.getElementById('ai-provider'),
    apiKeyGroup: document.getElementById('api-key-group'),
    apiKeyInput: document.getElementById('api-key'),
    colorBtns: document.querySelectorAll('.color-btn')
};

// --- Initialization ---
function init() {
    applyTheme(state.theme);
    renderTasks();
    
    // Set initial settings values
    els.providerSelect.value = state.provider;
    els.apiKeyInput.value = state.apiKey;
    toggleApiKeyVisibility();

    // Event Listeners
    setupEventListeners();
    
    // Auto-resize textarea
    els.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        els.sendBtn.disabled = this.value.trim() === '';
    });
}

// --- Event Listeners ---
function setupEventListeners() {
    // Chat Submission
    els.chatForm.addEventListener('submit', handleSendMessage);
    els.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!els.sendBtn.disabled) handleSendMessage(e);
        }
    });

    // Suggestions
    els.suggestionCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            els.messageInput.value = prompt;
            els.sendBtn.disabled = false;
            els.chatForm.dispatchEvent(new Event('submit'));
        });
    });

    // Mobile toggles
    if (els.mobileMenuBtn) {
        els.mobileMenuBtn.addEventListener('click', () => {
            els.leftSidebar.classList.toggle('open');
            els.rightSidebar.classList.remove('open');
        });
    }
    
    if (els.mobileTasksBtn) {
        els.mobileTasksBtn.addEventListener('click', () => {
            els.rightSidebar.classList.toggle('open');
            els.leftSidebar.classList.remove('open');
        });
    }

    // New Chat
    els.newChatBtn.addEventListener('click', () => {
        els.chatMessages.innerHTML = '';
        els.chatMessages.appendChild(els.welcomeContainer);
        els.welcomeContainer.style.display = 'flex';
    });

    // Quick Add Task
    els.addTaskBtn.addEventListener('click', handleQuickAddTask);
    els.quickTaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleQuickAddTask();
    });

    // Settings
    els.settingsBtn.addEventListener('click', () => els.settingsModal.classList.add('active'));
    els.closeModalBtn.addEventListener('click', () => els.settingsModal.classList.remove('active'));
    els.providerSelect.addEventListener('change', toggleApiKeyVisibility);
    els.saveSettingsBtn.addEventListener('click', saveSettings);
    
    els.colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyTheme(btn.getAttribute('data-color'));
        });
    });
    
    // Close modal on outside click
    els.settingsModal.addEventListener('click', (e) => {
        if (e.target === els.settingsModal) els.settingsModal.classList.remove('active');
    });
}

// --- Theme & Settings ---
function applyTheme(themeColor) {
    els.body.setAttribute('data-theme', themeColor);
    state.theme = themeColor;
    localStorage.setItem('nexus-theme', themeColor);
    
    els.colorBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-color') === themeColor);
    });
}

function toggleApiKeyVisibility() {
    if (els.providerSelect.value === 'demo') {
        els.apiKeyGroup.style.display = 'none';
    } else {
        els.apiKeyGroup.style.display = 'flex';
    }
}

function saveSettings() {
    state.provider = els.providerSelect.value;
    state.apiKey = els.apiKeyInput.value;
    
    localStorage.setItem('nexus-provider', state.provider);
    localStorage.setItem('nexus-apikey', state.apiKey);
    
    els.settingsModal.classList.remove('active');
}

// --- Chat Logic ---
async function handleSendMessage(e) {
    e.preventDefault();
    if (state.isWaitingForResponse) return;

    const message = els.messageInput.value.trim();
    if (!message) return;

    // UI Updates
    els.welcomeContainer.style.display = 'none';
    els.messageInput.value = '';
    els.messageInput.style.height = 'auto';
    els.sendBtn.disabled = true;
    
    // Add user message
    appendMessage('user', message);
    
    // Check for explicit manual task format "Task: XYZ"
    extractExplicitTasks(message);
    
    state.isWaitingForResponse = true;
    const typingIndicator = appendTypingIndicator();

    try {
        const responseText = await fetchAiResponse(message);
        typingIndicator.remove();
        appendMessage('ai', responseText);
        
        // Extract implicit tasks from AI response
        extractTasksFromAi(responseText);
        
    } catch (error) {
        typingIndicator.remove();
        appendMessage('ai', `**Error:** ${error.message}. Please check your API key and provider settings.`);
    } finally {
        state.isWaitingForResponse = false;
        scrollToBottom();
    }
}

function appendMessage(role, content) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse Markdown if available, else plain text
    if (typeof marked !== 'undefined') {
        contentDiv.innerHTML = marked.parse(content);
    } else {
        contentDiv.innerText = content;
    }
    
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    els.chatMessages.appendChild(wrapper);
    
    scrollToBottom();
}

function appendTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    
    messageDiv.innerHTML = `
        <div class="typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    
    wrapper.appendChild(messageDiv);
    els.chatMessages.appendChild(wrapper);
    scrollToBottom();
    
    return wrapper;
}

function scrollToBottom() {
    els.chatMessages.scrollTo({
        top: els.chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// --- AI Integration ---
async function fetchAiResponse(prompt) {
    const provider = state.provider;
    
    if (provider === 'demo') {
        return simulateDemoResponse(prompt);
    }
    
    if (!state.apiKey) {
        throw new Error("API Key is missing. Please add it in Settings.");
    }
    
    if (provider === 'gemini') {
        return callGeminiAPI(prompt, state.apiKey);
    } else if (provider === 'openai') {
        return callOpenAIAPI(prompt, state.apiKey);
    }
    
    return "Unsupported provider.";
}

// Mock API Call
function simulateDemoResponse(prompt) {
    return new Promise(resolve => {
        setTimeout(() => {
            const p = prompt.toLowerCase();
            let response = "";
            
            if (p.includes('plan') || p.includes('week')) {
                response = "Here is a plan for your week as requested:\n\n" +
                "### Monday & Tuesday\n" +
                "- Set up the development environment\n" +
                "- Read the documentation for Next.js\n\n" +
                "### Wednesday\n" +
                "- Build the basic UI layout\n\n" +
                "### Thursday & Friday\n" +
                "- Integrate the API and test thoroughly\n\n" +
                "I've added these to your task list!";
            } else if (p.includes('code') || p.includes('script')) {
                response = "Sure, here is a simple Python snippet using `requests` and `BeautifulSoup`:\n\n" +
                "```python\nimport requests\nfrom bs4 import BeautifulSoup\n\n" +
                "res = requests.get('https://example.com')\n" +
                "soup = BeautifulSoup(res.text, 'html.parser')\n" +
                "print(soup.title.text)\n```\n\n" +
                "Task: Review the Python snippet to ensure it meets requirements.";
            } else {
                response = "That's an interesting thought! If there's an action item here, let me know. For example, you can say 'Remind me to follow up on this' or type 'Task: Follow up on conversation'.";
            }
            
            resolve(response);
        }, 1500);
    });
}

// Real Gemini API Call (Example implementation using fetch)
async function callGeminiAPI(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    return data.candidates[0].content.parts[0].text;
}

// Real OpenAI API Call
async function callOpenAIAPI(prompt, apiKey) {
    const url = 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }]
        })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    return data.choices[0].message.content;
}

// --- Task Management ---

function handleQuickAddTask() {
    const text = els.quickTaskInput.value.trim();
    if (text) {
        addTask(text, 'manual');
        els.quickTaskInput.value = '';
    }
}

function extractExplicitTasks(text) {
    // Looks for "Task: something"
    const regex = /task:\s*(.+)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        addTask(match[1].trim(), 'manual');
    }
}

function extractTasksFromAi(text) {
    // Look for explicit task declarations in AI output
    extractExplicitTasks(text);
    
    // Look for Markdown lists (e.g. "- do something")
    const lines = text.split('\n');
    let inList = false;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const taskText = trimmed.substring(2).trim();
            if (taskText.length > 3) {
                // Avoid extracting very short meaningless bullets
                addTask(taskText, 'ai');
            }
        } else if (trimmed.match(/^\d+\.\s/)) {
            // Numbered list
            const taskText = trimmed.replace(/^\d+\.\s/, '').trim();
            if (taskText.length > 3) {
                addTask(taskText, 'ai');
            }
        }
    });
}

function addTask(title, source = 'manual') {
    const newTask = {
        id: Date.now().toString(),
        title,
        completed: false,
        source
    };
    
    state.tasks.unshift(newTask); // Add to top
    saveTasks();
    renderTasks();
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
    }
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
}

function saveTasks() {
    localStorage.setItem('nexus-tasks', JSON.stringify(state.tasks));
}

function renderTasks() {
    els.taskCount.textContent = state.tasks.length;
    els.taskList.innerHTML = '';
    
    if (state.tasks.length === 0) {
        els.taskList.innerHTML = `
            <div class="empty-tasks">
                <i class="fa-solid fa-clipboard-check"></i>
                <p>No tasks yet. I'll extract action items from our chat automatically.</p>
            </div>
        `;
        return;
    }
    
    state.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="checkbox" onclick="toggleTask('${task.id}')">
                <i class="fa-solid fa-check"></i>
            </div>
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                <div class="task-meta">
                    <span class="task-badge ${task.source === 'ai' ? 'badge-ai' : 'badge-manual'}">
                        ${task.source === 'ai' ? 'AI Extracted' : 'Manual'}
                    </span>
                </div>
            </div>
            <button class="delete-task" onclick="deleteTask('${task.id}')">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        
        els.taskList.appendChild(li);
    });
}

// Start app
init();
