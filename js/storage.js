/**
 * Storage Manager for Salman Chat Bot
 * Handles local persistence of settings, conversations, and UI state.
 */

const STORAGE_KEYS = {
  SETTINGS: 'agy_chat_settings_v1',
  CONVERSATIONS: 'agy_chat_conversations_v1',
  ACTIVE_CHAT_ID: 'agy_chat_active_id_v1',
  THEME: 'agy_chat_theme_v1'
};

const DEFAULT_SETTINGS = {
  provider: 'groq', // 'groq', 'openai', 'custom', 'backend'
  apiKey: '',
  groqKey: '',
  openaiKey: '',
  customKey: '',
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-20b',
  systemPrompt: 'You are an intelligent, helpful, and concise AI assistant named Salman Chat Bot. You provide well-structured, elegant answers with clean markdown and code formatting.',
  temperature: 0.7,
  maxTokens: 4096,
  stream: true
};

export const Storage = {
  // --- Settings ---
  getSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const parsed = saved ? JSON.parse(saved) : {};
      const settings = { ...DEFAULT_SETTINGS, ...parsed };

      // Automatically migrate legacy or inaccessible models
      if (settings.provider === 'groq') {
        const validGroq = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'allam-2-7b'];
        if (!settings.model || !validGroq.includes(settings.model)) {
          settings.model = 'openai/gpt-oss-20b';
          this.saveSettings(settings);
        }
      }

      return settings;
    } catch (e) {
      console.error('Failed to read settings from localStorage:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  // --- Theme ---
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  // --- Conversations ---
  getConversations() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse conversations:', e);
      return [];
    }
  },

  saveConversations(conversations) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  },

  getActiveChatId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
  },

  setActiveChatId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
    }
  },

  getConversation(id) {
    const list = this.getConversations();
    return list.find(c => c.id === id) || null;
  },

  createConversation(title = 'New Conversation') {
    const newChat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    const list = this.getConversations();
    list.unshift(newChat);
    this.saveConversations(list);
    this.setActiveChatId(newChat.id);
    return newChat;
  },

  updateConversation(id, updates) {
    const list = this.getConversations();
    const index = list.findIndex(c => c.id === id);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        ...updates,
        updatedAt: Date.now()
      };
      // Keep sorted by updatedAt descending
      const item = list.splice(index, 1)[0];
      list.unshift(item);
      this.saveConversations(list);
      return list[0];
    }
    return null;
  },

  deleteConversation(id) {
    let list = this.getConversations();
    list = list.filter(c => c.id !== id);
    this.saveConversations(list);

    const activeId = this.getActiveChatId();
    if (activeId === id) {
      const nextActive = list.length > 0 ? list[0].id : null;
      this.setActiveChatId(nextActive);
      return nextActive;
    }
    return activeId;
  },

  clearAllConversations() {
    this.saveConversations([]);
    this.setActiveChatId(null);
  },

  // Export / Import
  exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      conversations: this.getConversations(),
      settings: this.getSettings()
    };
    return JSON.stringify(data, null, 2);
  },

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.conversations)) {
        this.saveConversations(parsed.conversations);
        if (parsed.conversations.length > 0) {
          this.setActiveChatId(parsed.conversations[0].id);
        }
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        const current = this.getSettings();
        this.saveSettings({ ...current, ...parsed.settings });
      }
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  }
};
