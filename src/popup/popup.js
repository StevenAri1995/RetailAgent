document.addEventListener('DOMContentLoaded', () => {
  const messagesDiv = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const settingsModal = document.getElementById('settings-modal');
  const apiKeyInput = document.getElementById('api-key');
  const saveSettingsBtn = document.getElementById('save-settings');
  const checkModelsBtn = document.getElementById('check-models');
  const closeSettingsBtn = document.getElementById('close-settings');

  // Load API Key
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
      } else {
        appendMessage('system', 'Please set your Gemini API Key in settings first.');
        settingsModal.classList.remove('hidden');
      }
    });
  } else {
    console.error('chrome.storage not available. Are you running as an extension?');
    appendMessage('system', 'Error: Extension APIs not available.');
  }

  // Open side panel when extension icon is clicked
  chrome.action.onClicked?.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
  });

  // Initialize side panel if not already set
  chrome.runtime.onInstalled?.addListener(() => {
    chrome.sidePanel.setOptions({
      path: 'src/popup/index.html',
      enabled: true
    });
  });

  checkModelsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      appendMessage('system', 'Enter API Key first');
      return;
    }

    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      appendMessage('system', 'Checking models...');
      chrome.runtime.sendMessage({ type: 'CHECK_MODELS', apiKey: key }, (response) => {
        if (chrome.runtime.lastError) {
          appendMessage('system', 'Runtime Error: ' + chrome.runtime.lastError.message);
        } else if (response && response.error) {
          appendMessage('system', 'API Error: ' + response.error);
        } else if (response && response.models) {
          const names = response.models.map(m => m.name.replace('models/', '')).join(', ');
          appendMessage('system', 'Available Models: ' + names);
        } else {
          appendMessage('system', 'Unknown response from background script.');
        }
      });
    } else {
      appendMessage('system', 'Error: Extension APIs not available.');
    }
  });

  // Load previous messages from storage
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['chatHistory'], (result) => {
      if (result.chatHistory && Array.isArray(result.chatHistory)) {
        // Clear the default welcome message
        messagesDiv.innerHTML = '';
        // Load all previous messages
        result.chatHistory.forEach(msg => {
          appendMessage(msg.sender, msg.text, false); // false = don't save to storage (already saved)
        });
        // Scroll to bottom
        scrollToBottom();
      }
    });
  }

  // Clear chat button
  clearChatBtn.addEventListener('click', () => {
    if (confirm('Clear all messages and start over?')) {
      messagesDiv.innerHTML = '';
      chrome.storage.local.set({ chatHistory: [] }, () => {
        appendMessage('system', 'Chat cleared. How can I help you?');
      });
    }
  });

  // Handlers
  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Keyboard navigation support
  document.addEventListener('keydown', (e) => {
    // Escape key closes settings modal
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
    }
  });

  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        alert('API Key saved!');
        settingsModal.classList.add('hidden');
        appendMessage('system', 'API Key saved. You can now make requests.');
      });
    }
  });

  // Export logs functionality
  const exportLogsBtn = document.getElementById('export-logs-btn');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', async () => {
      try {
        appendMessage('system', 'Exporting logs...');
        
        const { detailedLogs = [], actionLogs = [] } = await chrome.storage.local.get(['detailedLogs', 'actionLogs']);
        
        let allLogs = [];
        if (detailedLogs && detailedLogs.length > 0) {
          allLogs = detailedLogs;
        } else if (actionLogs && actionLogs.length > 0) {
          allLogs = actionLogs.map(log => ({
            timestamp: log.time || new Date().toISOString(),
            level: log.text?.includes('[ERROR]') ? 'ERROR' : log.text?.includes('[WARN]') ? 'WARN' : 'INFO',
            message: log.text || '',
            data: log.fullLog || {}
          }));
        }
        
        if (allLogs.length === 0) {
          appendMessage('system', 'No logs found to export.');
          return;
        }
        
        const logText = allLogs.map(log => {
          const timestamp = log.timestamp || log.time || new Date().toISOString();
          const level = log.level || 'INFO';
          const message = log.message || log.text || '';
          const data = log.data || log.fullLog || {};
          return `[${timestamp}] [${level}] ${message}\n${JSON.stringify(data, null, 2)}`;
        }).join('\n\n---\n\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `retailagent-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        appendMessage('system', `Logs exported successfully! (${allLogs.length} entries)`);
      } catch (error) {
        appendMessage('system', `Error exporting logs: ${error.message}`);
        console.error('Export logs error:', error);
      }
    });
  }

  function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Add user message to chat
    appendMessage('user', text);
    userInput.value = '';
    userInput.focus();

    // Send to background
    chrome.runtime.sendMessage({ type: 'PROCESS_QUERY', text: text }, (response) => {
      if (chrome.runtime.lastError) {
        appendMessage('system', 'Error: ' + chrome.runtime.lastError.message);
      } else if (response && response.status === 'processing') {
        // Background accepted it
      }
    });
  }

  function appendMessage(sender, text, saveToStorage = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    scrollToBottom();

    // Save to storage for persistence
    if (saveToStorage) {
      chrome.storage.local.get(['chatHistory'], (result) => {
        const history = result.chatHistory || [];
        history.push({ sender, text, timestamp: new Date().toISOString() });
        // Keep only last 100 messages
        if (history.length > 100) {
          history.splice(0, history.length - 100);
        }
        chrome.storage.local.set({ chatHistory: history });
      });
    }
  }

  function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_STATUS') {
      appendMessage('system', message.text);
    }
  });

  // Focus input on load
  userInput.focus();
});
