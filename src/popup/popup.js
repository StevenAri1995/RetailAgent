document.addEventListener('DOMContentLoaded', () => {
  const messagesDiv = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const settingsBtn = document.getElementById('settings-btn');
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

  checkModelsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      appendMessage('system', 'Enter API Key first');
      return;
    }

    // Check if chrome.runtime exists (sanity check)
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

  // Load previous messages (optional)

  // Load persistent logs
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['actionLogs'], (result) => {
      if (result.actionLogs) {
        result.actionLogs.forEach(log => {
          appendMessage('system', log.text); // Optional: Prepend time? `[${log.time}] ${log.text}`
        });
      }
    });
  }

  // Handlers
  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
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

  function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';

    // Send to background
    chrome.runtime.sendMessage({ type: 'PROCESS_QUERY', text: text }, (response) => {
      if (chrome.runtime.lastError) {
        appendMessage('system', 'Error: ' + chrome.runtime.lastError.message);
      } else if (response && response.status === 'processing') {
        // Background accepted it
      }
    });
  }

  function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_STATUS') {
      appendMessage('system', message.text);
    }
  });
});
