/**
 * Main Application Controller for Salman Chat Bot
 */

import { Storage } from './storage.js';
import { Markdown } from './markdown.js';
import { ChatAPI, PROVIDERS } from './api.js';

// Pre-configured API keys — set your keys in Settings or via environment
const DEFAULT_GROQ_KEY = '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';
// Gemini key is loaded from settings — configure in the Settings panel (⚙️)
const DEFAULT_GEMINI_KEY = '';

class App {
  constructor() {
    this.storage = Storage;
    this.settings = this.storage.getSettings();

    // Pre-populate keys if not set
    let changed = false;
    if (!this.settings.groqKey && !this.settings.apiKey) {
      this.settings.groqKey = DEFAULT_GROQ_KEY;
      this.settings.apiKey = DEFAULT_GROQ_KEY;
      changed = true;
    }
    if (!this.settings.geminiKey) {
      this.settings.geminiKey = DEFAULT_GEMINI_KEY;
      changed = true;
    }
    if (changed) this.storage.saveSettings(this.settings);

    this.api = new ChatAPI(this.settings);
    this.currentChat = null;
    this.isStreaming = false;
    this.isUserScrolledUp = false;

    this.initElements();
    this.initTheme();
    this.initMarkdown();
    this.initEventListeners();
    this.loadInitialChat();
    this.renderSidebar();
    this.updateStatusBadge();
  }

  initElements() {
    // Layout & Navigation
    this.sidebar = document.getElementById('sidebar');
    this.sidebarBackdrop = document.getElementById('sidebar-backdrop');
    this.toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    this.closeSidebarBtn = document.getElementById('close-sidebar-btn');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.newChatBtn = document.getElementById('new-chat-btn');
    this.mobileNewChatBtn = document.getElementById('mobile-new-chat-btn');
    this.searchChatInput = document.getElementById('search-chat-input');
    this.conversationsList = document.getElementById('conversations-list');
    this.clearAllChatsBtn = document.getElementById('clear-all-chats-btn');

    // Chat Area
    this.chatMessagesContainer = document.getElementById('chat-messages-container');
    this.chatScrollArea = document.getElementById('chat-scroll-area');
    this.welcomeHero = document.getElementById('welcome-hero');
    this.chatTitleDisplay = document.getElementById('chat-title-display');
    this.activeModelBadge = document.getElementById('active-model-badge');
    this.exportChatMdBtn = document.getElementById('export-chat-md-btn');
    this.scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');

    // Input & Actions
    this.chatForm = document.getElementById('chat-form');
    this.promptInput = document.getElementById('prompt-input');
    this.voiceInputBtn = document.getElementById('voice-input-btn');
    this.sendBtn = document.getElementById('send-btn');
    this.stopBtn = document.getElementById('stop-btn');

    // Settings Modal
    this.settingsModal = document.getElementById('settings-modal');
    this.openSettingsBtn = document.getElementById('open-settings-btn');
    this.mobileSettingsBtn = document.getElementById('mobile-settings-btn');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.settingsForm = document.getElementById('settings-form');
    this.providerSelect = document.getElementById('setting-provider');
    this.apiKeyInput = document.getElementById('setting-api-key');
    this.toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility-btn');
    this.baseUrlInput = document.getElementById('setting-base-url');
    this.modelSelect = document.getElementById('setting-model');
    this.customModelInput = document.getElementById('setting-custom-model');
    this.systemPromptInput = document.getElementById('setting-system-prompt');
    this.temperatureSlider = document.getElementById('setting-temperature');
    this.tempValueDisplay = document.getElementById('temp-value-display');
    this.streamToggle = document.getElementById('setting-stream');
    this.testConnectionBtn = document.getElementById('test-connection-btn');
    this.testResultDisplay = document.getElementById('test-result-display');
    this.exportChatsBtn = document.getElementById('export-chats-btn');
    this.importFileInput = document.getElementById('import-file-input');
    this.statusIndicator = document.getElementById('status-indicator');

    // Toast Container
    this.toastContainer = document.getElementById('toast-container');
  }

  // --- Themes ---
  initTheme() {
    const savedTheme = this.storage.getTheme();
    this.applyTheme(savedTheme);
  }

  applyTheme(theme) {
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      this.updateThemeIcons(true);
    } else {
      document.documentElement.classList.remove('dark');
      this.updateThemeIcons(false);
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    this.storage.setTheme(newTheme);
    this.updateThemeIcons(isDark);
  }

  updateThemeIcons(isDark) {
    const sunIcons = document.querySelectorAll('.theme-sun-icon');
    const moonIcons = document.querySelectorAll('.theme-moon-icon');
    sunIcons.forEach(el => el.classList.toggle('hidden', !isDark));
    moonIcons.forEach(el => el.classList.toggle('hidden', isDark));
  }

  initMarkdown() {
    Markdown.init();
  }

  // --- Initial Chat State ---
  loadInitialChat() {
    const activeId = this.storage.getActiveChatId();
    if (activeId) {
      const chat = this.storage.getConversation(activeId);
      if (chat) {
        this.selectChat(chat.id);
        return;
      }
    }
    const all = this.storage.getConversations();
    if (all.length > 0) {
      this.selectChat(all[0].id);
    } else {
      this.createNewChat(false);
    }
  }

  createNewChat(focusInput = true) {
    const newChat = this.storage.createConversation('New Chat');
    this.currentChat = newChat;
    this.renderSidebar();
    this.renderChatWindow();
    if (focusInput) {
      this.promptInput.focus();
    }
    this.closeMobileSidebar();
  }

  selectChat(chatId) {
    const chat = this.storage.getConversation(chatId);
    if (!chat) return;
    this.currentChat = chat;
    this.storage.setActiveChatId(chatId);
    this.renderSidebar();
    this.renderChatWindow();
    this.closeMobileSidebar();
  }

  // --- Sidebar Management ---
  renderSidebar(filterQuery = '') {
    const conversations = this.storage.getConversations();
    this.conversationsList.innerHTML = '';

    const filtered = filterQuery
      ? conversations.filter(c => c.title.toLowerCase().includes(filterQuery.toLowerCase()))
      : conversations;

    if (filtered.length === 0) {
      this.conversationsList.innerHTML = `
        <div class="px-4 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
          ${filterQuery ? 'No matching conversations' : 'No conversations yet.<br/>Start a new chat!'}
        </div>
      `;
      return;
    }

    // Categorize by time
    const groups = this.groupConversationsByDate(filtered);

    for (const [groupName, chats] of Object.entries(groups)) {
      if (chats.length === 0) continue;

      const groupHeader = document.createElement('div');
      groupHeader.className = 'px-3 pt-3 pb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider';
      groupHeader.textContent = groupName;
      this.conversationsList.appendChild(groupHeader);

      chats.forEach(chat => {
        const isActive = this.currentChat && this.currentChat.id === chat.id;
        const item = document.createElement('div');
        item.className = `group relative flex items-center justify-between px-3 py-2.5 mx-1.5 my-0.5 rounded-lg text-sm cursor-pointer transition-all duration-150 ${
          isActive
            ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium shadow-sm'
            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
        }`;
        item.dataset.id = chat.id;

        item.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            <svg class="w-4 h-4 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            <span class="truncate chat-title-text">${this.escapeHtml(chat.title)}</span>
          </div>
          <div class="chat-actions hidden group-hover:flex items-center gap-1 shrink-0">
            <button type="button" class="rename-chat-btn p-1 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors" title="Rename chat">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button type="button" class="delete-chat-btn p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" title="Delete chat">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        `;

        // Click on conversation to select
        item.addEventListener('click', (e) => {
          if (e.target.closest('.chat-actions')) return;
          this.selectChat(chat.id);
        });

        // Rename button
        const renameBtn = item.querySelector('.rename-chat-btn');
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.promptRenameChat(chat);
        });

        // Delete button
        const deleteBtn = item.querySelector('.delete-chat-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteChat(chat.id);
        });

        this.conversationsList.appendChild(item);
      });
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  groupConversationsByDate(conversations) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;

    const groups = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };

    conversations.forEach(c => {
      const time = c.updatedAt || c.createdAt || 0;
      if (time >= today) {
        groups['Today'].push(c);
      } else if (time >= yesterday) {
        groups['Yesterday'].push(c);
      } else if (time >= sevenDaysAgo) {
        groups['Previous 7 Days'].push(c);
      } else {
        groups['Older'].push(c);
      }
    });

    return groups;
  }

  promptRenameChat(chat) {
    const newTitle = prompt('Rename conversation:', chat.title);
    if (newTitle && newTitle.trim()) {
      this.storage.updateConversation(chat.id, { title: newTitle.trim() });
      if (this.currentChat && this.currentChat.id === chat.id) {
        this.currentChat.title = newTitle.trim();
        this.chatTitleDisplay.textContent = newTitle.trim();
      }
      this.renderSidebar();
      this.showToast('Conversation renamed');
    }
  }

  deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    const nextId = this.storage.deleteConversation(chatId);
    if (nextId) {
      this.selectChat(nextId);
    } else {
      this.createNewChat(false);
    }
    this.showToast('Conversation deleted');
  }

  // --- Render Chat Window ---
  renderChatWindow() {
    if (!this.currentChat) return;

    this.chatTitleDisplay.textContent = this.currentChat.title || 'New Chat';
    const messages = this.currentChat.messages || [];

    // Toggle welcome hero
    if (messages.length === 0) {
      this.welcomeHero.classList.remove('hidden');
      this.chatMessagesContainer.innerHTML = '';
    } else {
      this.welcomeHero.classList.add('hidden');
      this.chatMessagesContainer.innerHTML = '';
      messages.forEach(msg => {
        this.appendMessageElement(msg, false);
      });
      this.scrollToBottom(false);
    }

    this.updateStatusBadge();
  }

  appendMessageElement(message, animate = true) {
    const isUser = message.role === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex gap-3 md:gap-4 my-4 max-w-4xl mx-auto px-2 md:px-4 ${animate ? 'animate-fade-in' : ''} ${isUser ? 'justify-end' : 'justify-start'}`;
    msgDiv.dataset.id = message.id;

    if (isUser) {
      // User message (speech bubble right-aligned)
      msgDiv.innerHTML = `
        <div class="group relative flex flex-col items-end max-w-[85%] md:max-w-[75%]">
          <div class="px-4 py-3 rounded-2xl rounded-tr-sm bg-zinc-800 dark:bg-zinc-700 text-zinc-100 shadow-sm text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
            ${this.escapeHtml(message.content)}
          </div>
          <div class="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" class="edit-msg-btn text-[11px] text-zinc-400 hover:text-indigo-400 inline-flex items-center gap-1 transition-colors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              <span>Edit</span>
            </button>
          </div>
        </div>
      `;

      // Edit message button
      const editBtn = msgDiv.querySelector('.edit-msg-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.promptInput.value = message.content;
          this.promptInput.focus();
          this.adjustTextareaHeight();
        });
      }
    } else {
      // AI Assistant Message (full markdown layout)
      const formattedContent = this.formatMessageContent(message.content || '', message.reasoning || '');
      const renderedHtml = Markdown.render(formattedContent);
      msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md text-xs font-bold">
          AI
        </div>
        <div class="group flex-1 min-w-0 max-w-[90%] md:max-w-[85%]">
          <div class="prose-chat text-zinc-800 dark:text-zinc-100 message-body">
            ${renderedHtml}
          </div>
          <div class="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" class="copy-full-msg-btn text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              <span>Copy Response</span>
            </button>
            <button type="button" class="speak-full-msg-btn text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 transition-colors" title="Read response aloud">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
              <span>Read Aloud</span>
            </button>
            <button type="button" class="regen-msg-btn text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800/80 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      `;

      // Copy response button
      const copyBtn = msgDiv.querySelector('.copy-full-msg-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          this.copyToClipboard(message.content, copyBtn);
        });
      }

      // Read aloud button
      const speakBtn = msgDiv.querySelector('.speak-full-msg-btn');
      if (speakBtn) {
        speakBtn.addEventListener('click', () => {
          this.speakText(message.content, speakBtn);
        });
      }

      // Regenerate response button
      const regenBtn = msgDiv.querySelector('.regen-msg-btn');
      if (regenBtn) {
        regenBtn.addEventListener('click', () => {
          this.regenerateResponse(message.id);
        });
      }
    }

    this.chatMessagesContainer.appendChild(msgDiv);
    return msgDiv;
  }

  // --- Send Message & Stream ---
  async handleSendMessage() {
    if (this.isStreaming) return;
    const text = this.promptInput.value.trim();
    if (!text) return;

    if (!this.currentChat) {
      this.createNewChat(false);
    }

    // Hide welcome hero on first message
    this.welcomeHero.classList.add('hidden');

    // Add user message
    const userMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    this.currentChat.messages.push(userMsg);

    // Auto title if first message
    if (this.currentChat.messages.length === 1) {
      const summaryTitle = text.slice(0, 32).trim() + (text.length > 32 ? '...' : '');
      this.currentChat.title = summaryTitle;
      this.chatTitleDisplay.textContent = summaryTitle;
    }

    this.storage.updateConversation(this.currentChat.id, {
      title: this.currentChat.title,
      messages: this.currentChat.messages
    });
    this.renderSidebar();

    this.appendMessageElement(userMsg);
    this.promptInput.value = '';
    this.adjustTextareaHeight();
    this.scrollToBottom();

    // Prepare Assistant placeholder
    const assistantMsg = {
      id: 'msg_' + (Date.now() + 1) + '_' + Math.random().toString(36).substring(2, 6),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    this.currentChat.messages.push(assistantMsg);
    const msgElement = this.appendMessageElement(assistantMsg);
    const bodyContainer = msgElement.querySelector('.message-body');
    bodyContainer.classList.add('streaming-cursor');

    this.setStreamingState(true);

    // Stream from API
    await this.api.sendMessage({
      messages: this.currentChat.messages.slice(0, -1), // exclude current empty assistant placeholder
      onChunk: (delta, fullText, fullReasoning) => {
        assistantMsg.content = fullText;
        assistantMsg.reasoning = fullReasoning;
        const display = this.formatMessageContent(fullText, fullReasoning);
        bodyContainer.innerHTML = Markdown.render(display);
        if (!this.isUserScrolledUp) {
          this.scrollToBottom();
        }
      },
      onComplete: (fullText, wasCancelled, fullReasoning) => {
        bodyContainer.classList.remove('streaming-cursor');
        if (wasCancelled) {
          assistantMsg.content = (fullText || assistantMsg.content) + ' *(Generation stopped)*';
        } else {
          assistantMsg.content = fullText || assistantMsg.content;
        }
        assistantMsg.reasoning = fullReasoning || assistantMsg.reasoning;
        const display = this.formatMessageContent(assistantMsg.content, assistantMsg.reasoning);
        bodyContainer.innerHTML = Markdown.render(display);

        // Save conversation state
        this.storage.updateConversation(this.currentChat.id, {
          messages: this.currentChat.messages
        });

        this.setStreamingState(false);
        this.scrollToBottom();
      },
      onError: (err) => {
        bodyContainer.classList.remove('streaming-cursor');
        assistantMsg.content = `⚠️ **Error generating response:** ${err.message}\n\n*Please verify your API key in Settings.*`;
        bodyContainer.innerHTML = Markdown.render(assistantMsg.content);

        this.storage.updateConversation(this.currentChat.id, {
          messages: this.currentChat.messages
        });

        this.setStreamingState(false);
        this.showToast('Error: ' + err.message, 'error');
      }
    });
  }

  async regenerateResponse(targetAssistantMsgId) {
    if (this.isStreaming || !this.currentChat) return;

    const msgs = this.currentChat.messages;
    const index = msgs.findIndex(m => m.id === targetAssistantMsgId);
    if (index === -1) return;

    // Prune messages up to the user message before this assistant message
    const previousMessages = msgs.slice(0, index);

    // Reset this assistant message
    const targetMsg = msgs[index];
    targetMsg.content = '';

    // Re-render chat
    this.renderChatWindow();

    const msgElement = this.chatMessagesContainer.querySelector(`[data-id="${targetAssistantMsgId}"]`);
    if (!msgElement) return;
    const bodyContainer = msgElement.querySelector('.message-body');
    bodyContainer.classList.add('streaming-cursor');

    this.setStreamingState(true);

    await this.api.sendMessage({
      messages: previousMessages,
      onChunk: (delta, fullText, fullReasoning) => {
        targetMsg.content = fullText;
        targetMsg.reasoning = fullReasoning;
        const display = this.formatMessageContent(fullText, fullReasoning);
        bodyContainer.innerHTML = Markdown.render(display);
        if (!this.isUserScrolledUp) {
          this.scrollToBottom();
        }
      },
      onComplete: (fullText, wasCancelled, fullReasoning) => {
        bodyContainer.classList.remove('streaming-cursor');
        if (wasCancelled) {
          targetMsg.content = (fullText || targetMsg.content) + ' *(Generation stopped)*';
        } else {
          targetMsg.content = fullText || targetMsg.content;
        }
        targetMsg.reasoning = fullReasoning || targetMsg.reasoning;
        const display = this.formatMessageContent(targetMsg.content, targetMsg.reasoning);
        bodyContainer.innerHTML = Markdown.render(display);

        this.storage.updateConversation(this.currentChat.id, {
          messages: this.currentChat.messages
        });

        this.setStreamingState(false);
      },
      onError: (err) => {
        bodyContainer.classList.remove('streaming-cursor');
        targetMsg.content = `⚠️ **Error regenerating response:** ${err.message}`;
        bodyContainer.innerHTML = Markdown.render(targetMsg.content);
        this.setStreamingState(false);
        this.showToast(err.message, 'error');
      }
    });
  }

  formatMessageContent(content, reasoning) {
    // Never show the "Thought Process" box — only show the final answer
    return content || '';
  }

  setStreamingState(isStreaming) {
    this.isStreaming = isStreaming;
    if (isStreaming) {
      this.sendBtn.classList.add('hidden');
      this.stopBtn.classList.remove('hidden');
    } else {
      this.sendBtn.classList.remove('hidden');
      this.stopBtn.classList.add('hidden');
    }
  }

  stopGeneration() {
    this.api.stopStreaming();
  }

  // --- Scroll Utilities ---
  scrollToBottom(smooth = true) {
    if (!this.chatScrollArea) return;
    this.chatScrollArea.scrollTo({
      top: this.chatScrollArea.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    this.scrollToBottomBtn.classList.add('hidden');
  }

  handleScroll() {
    if (!this.chatScrollArea) return;
    const { scrollTop, scrollHeight, clientHeight } = this.chatScrollArea;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceFromBottom > 150) {
      this.isUserScrolledUp = true;
      this.scrollToBottomBtn.classList.remove('hidden');
    } else {
      this.isUserScrolledUp = false;
      this.scrollToBottomBtn.classList.add('hidden');
    }
  }

  adjustTextareaHeight() {
    const el = this.promptInput;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${newHeight}px`;
  }

  // --- Settings Modal ---
  openSettings() {
    this.settings = this.storage.getSettings();
    this.populateSettingsForm();
    this.settingsModal.classList.remove('hidden');
    this.testResultDisplay.classList.add('hidden');
  }

  closeSettings() {
    this.settingsModal.classList.add('hidden');
  }

  populateSettingsForm() {
    const s = this.settings;
    this.providerSelect.value = s.provider || 'groq';
    this.handleProviderChange(s.provider || 'groq');

    this.baseUrlInput.value = s.baseUrl || PROVIDERS[s.provider || 'groq']?.baseUrl || '';
    this.systemPromptInput.value = s.systemPrompt || '';
    this.temperatureSlider.value = s.temperature ?? 0.7;
    this.tempValueDisplay.textContent = s.temperature ?? 0.7;
    this.streamToggle.checked = s.stream !== false;
  }

  handleProviderChange(provider) {
    const provConfig = PROVIDERS[provider] || PROVIDERS.groq;

    // Populate model dropdown
    this.modelSelect.innerHTML = '';
    provConfig.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      this.modelSelect.appendChild(opt);
    });

    const isCustom = provider === 'custom';
    this.customModelInput.classList.toggle('hidden', !isCustom);

    // Populate Key according to provider
    if (provider === 'groq') {
      this.apiKeyInput.value = this.settings.groqKey || this.settings.apiKey || '';
      this.apiKeyInput.placeholder = 'gsk_... (Groq API Key)';
    } else if (provider === 'gemini') {
      this.apiKeyInput.value = this.settings.geminiKey || '';
      this.apiKeyInput.placeholder = 'AIza... or AQ... (Gemini API Key)';
    } else if (provider === 'openai') {
      this.apiKeyInput.value = this.settings.openaiKey || '';
      this.apiKeyInput.placeholder = 'sk-... (OpenAI API Key)';
    } else if (provider === 'custom') {
      this.apiKeyInput.value = this.settings.customKey || '';
      this.apiKeyInput.placeholder = 'API Key or bearer token (optional for local)';
    } else {
      this.apiKeyInput.value = '';
      this.apiKeyInput.placeholder = 'Handled by server proxy';
    }

    this.baseUrlInput.value = provConfig.baseUrl;

    // Select matched model or default
    if (this.settings.model && provConfig.models.some(m => m.id === this.settings.model)) {
      this.modelSelect.value = this.settings.model;
    } else {
      this.modelSelect.value = provConfig.defaultModel;
    }
  }

  saveSettingsFromForm() {
    const provider = this.providerSelect.value;
    const keyVal = this.apiKeyInput.value.trim();

    const newSettings = {
      ...this.settings,
      provider: provider,
      baseUrl: this.baseUrlInput.value.trim(),
      model: provider === 'custom' && this.customModelInput.value.trim() ? this.customModelInput.value.trim() : this.modelSelect.value,
      systemPrompt: this.systemPromptInput.value.trim(),
      temperature: parseFloat(this.temperatureSlider.value),
      stream: this.streamToggle.checked
    };

    if (provider === 'groq') {
      newSettings.groqKey = keyVal;
      newSettings.apiKey = keyVal;
    } else if (provider === 'gemini') {
      newSettings.geminiKey = keyVal;
      newSettings.apiKey = keyVal;
    } else if (provider === 'openai') {
      newSettings.openaiKey = keyVal;
    } else if (provider === 'custom') {
      newSettings.customKey = keyVal;
    }

    this.settings = newSettings;
    this.storage.saveSettings(newSettings);
    this.api.updateSettings(newSettings);

    this.updateStatusBadge();
    this.closeSettings();
    this.showToast('Settings saved successfully');
  }

  async testApiConnection() {
    this.testResultDisplay.classList.remove('hidden');
    this.testResultDisplay.innerHTML = `
      <div class="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <svg class="animate-spin w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Testing connection...</span>
      </div>
    `;

    // Temporary settings test from form
    const tempSettings = {
      ...this.settings,
      provider: this.providerSelect.value,
      baseUrl: this.baseUrlInput.value.trim(),
      model: this.providerSelect.value === 'custom' && this.customModelInput.value.trim() ? this.customModelInput.value.trim() : this.modelSelect.value,
      apiKey: this.apiKeyInput.value.trim(),
      groqKey: this.providerSelect.value === 'groq' ? this.apiKeyInput.value.trim() : this.settings.groqKey,
      openaiKey: this.providerSelect.value === 'openai' ? this.apiKeyInput.value.trim() : this.settings.openaiKey,
      customKey: this.providerSelect.value === 'custom' ? this.apiKeyInput.value.trim() : this.settings.customKey
    };

    const tempApi = new ChatAPI(tempSettings);
    const result = await tempApi.testConnection();

    if (result.success) {
      this.testResultDisplay.innerHTML = `
        <div class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
          <svg class="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <span>${this.escapeHtml(result.message)}</span>
        </div>
      `;
    } else {
      this.testResultDisplay.innerHTML = `
        <div class="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
          <svg class="w-4 h-4 shrink-0 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>${this.escapeHtml(result.message)}</span>
        </div>
      `;
    }
  }

  updateStatusBadge() {
    const s = this.settings;
    const hasKey = !!this.api.getEffectiveKey() || s.provider === 'backend';

    if (hasKey) {
      this.statusIndicator.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-xs text-zinc-500 dark:text-zinc-400 capitalize">${s.provider} Connected</span>
      `;
    } else {
      this.statusIndicator.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span class="text-xs text-amber-600 dark:text-amber-400">API Key Missing</span>
      `;
    }

    if (this.activeModelBadge) {
      this.activeModelBadge.textContent = s.model || 'llama-3.3-70b-versatile';
    }
  }

  // --- Mobile Sidebar Controls ---
  openMobileSidebar() {
    this.sidebar.classList.remove('-translate-x-full');
    this.sidebarBackdrop.classList.remove('hidden');
  }

  closeMobileSidebar() {
    if (window.innerWidth < 1024) {
      this.sidebar.classList.add('-translate-x-full');
      this.sidebarBackdrop.classList.add('hidden');
    }
  }

  // --- Copy to Clipboard ---
  copyToClipboard(text, triggerBtn) {
    if (!navigator.clipboard) {
      this.fallbackCopy(text);
      this.showToast('Copied to clipboard!');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copied to clipboard!');
      if (triggerBtn) {
        const span = triggerBtn.querySelector('span');
        const originalText = span ? span.textContent : '';
        if (span) span.textContent = 'Copied!';
        setTimeout(() => {
          if (span) span.textContent = originalText;
        }, 1800);
      }
    }).catch(err => {
      console.error('Copy failed:', err);
      this.fallbackCopy(text);
      this.showToast('Copied to clipboard!');
    });
  }

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // --- Toast Notification ---
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-lg text-xs md:text-sm font-medium animate-fade-in transition-all duration-200 pointer-events-auto ${
      type === 'error'
        ? 'bg-red-600 text-white'
        : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
    }`;
    toast.innerHTML = `
      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>${this.escapeHtml(message)}</span>
    `;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // --- Text-to-Speech (Read Aloud) ---
  speakText(text, btn) {
    if (!('speechSynthesis' in window)) {
      this.showToast('Text-to-speech not supported in this browser', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btn) {
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Read Aloud';
      }
      return;
    }

    // Strip code blocks and markdown markers for natural speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~\[\]()]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanText) {
      this.showToast('No readable text to speak', 'error');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const span = btn ? btn.querySelector('span') : null;
    if (span) span.textContent = 'Speaking... (Click to stop)';

    utterance.onend = () => {
      if (span) span.textContent = 'Read Aloud';
    };

    utterance.onerror = () => {
      if (span) span.textContent = 'Read Aloud';
    };

    window.speechSynthesis.speak(utterance);
  }

  // --- Data Export & Import ---
  handleExport() {
    const dataStr = this.storage.exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salman-chatbot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Chat history exported!');
  }

  handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const ok = this.storage.importData(event.target.result);
      if (ok) {
        this.settings = this.storage.getSettings();
        this.api.updateSettings(this.settings);
        this.loadInitialChat();
        this.showToast('Chat data imported successfully!');
        this.closeSettings();
      } else {
        this.showToast('Failed to import file: Invalid format', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  escapeHtml(string) {
    if (!string) return '';
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Export current conversation (Download button) ---
  exportCurrentChatMarkdown() {
    if (!this.currentChat || !this.currentChat.messages || this.currentChat.messages.length === 0) {
      this.showToast('No messages to export', 'error');
      return;
    }

    // Build a print-friendly HTML page
    const title = this.escapeHtml(this.currentChat.title || 'Conversation');
    const date = new Date().toLocaleString();
    let html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.7}
  h1{font-size:1.5rem;font-weight:700;border-bottom:2px solid #6366f1;padding-bottom:8px;color:#4f46e5}
  .meta{color:#888;font-size:0.85rem;margin-bottom:32px}
  .msg{margin:20px 0;padding:16px 20px;border-radius:12px}
  .user{background:#f1f0ff;border-left:4px solid #6366f1}
  .assistant{background:#f9fafb;border-left:4px solid #10b981}
  .role{font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
  .user .role{color:#4f46e5}.assistant .role{color:#059669}
  pre{background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:0.875rem}
  code{background:#e8e8ff;color:#4f46e5;padding:2px 6px;border-radius:4px;font-size:0.875em}
</style></head><body>
<h1>💬 ${title}</h1>
<p class="meta">Exported from Salman Chat Bot &middot; ${date}</p>`;

    this.currentChat.messages.forEach(msg => {
      const roleLabel = msg.role === 'user' ? '👤 You' : '🤖 Salman AI';
      const cls = msg.role === 'user' ? 'user' : 'assistant';
      const content = msg.content
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\n/g, '<br>');
      html += `<div class="msg ${cls}"><div class="role">${roleLabel}</div><div>${content}</div></div>`;
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (this.currentChat.title || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    a.href = url;
    a.download = `${safeTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Chat downloaded! Open the .html file to read or print it.');
  }

  // --- Voice Input (Speech to Text) ---
  toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast('Speech recognition not supported in this browser', 'error');
      return;
    }

    if (this.isRecording && this.recognition) {
      this.recognition.stop();
      this.isRecording = false;
      this.voiceInputBtn.classList.remove('mic-recording');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.voiceInputBtn.classList.add('mic-recording');
        this.showToast('Listening... Speak now');
      };

      this.recognition.onresult = (e) => {
        const transcript = Array.from(e.results)
          .map(result => result[0].transcript)
          .join('');
        this.promptInput.value = transcript;
        this.adjustTextareaHeight();
      };

      this.recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        this.isRecording = false;
        this.voiceInputBtn.classList.remove('mic-recording');
        this.showToast('Voice error: ' + e.error, 'error');
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.voiceInputBtn.classList.remove('mic-recording');
      };

      this.recognition.start();
    } catch (err) {
      console.error(err);
      this.showToast('Microphone error: ' + err.message, 'error');
    }
  }

  // --- Event Listeners Setup ---
  initEventListeners() {
    // Theme toggle
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

    // Export current chat as markdown
    if (this.exportChatMdBtn) {
      this.exportChatMdBtn.addEventListener('click', () => this.exportCurrentChatMarkdown());
    }

    // Voice input
    if (this.voiceInputBtn) {
      this.voiceInputBtn.addEventListener('click', () => this.toggleVoiceInput());
    }

    // Mobile sidebar
    this.toggleSidebarBtn.addEventListener('click', () => this.openMobileSidebar());
    this.closeSidebarBtn.addEventListener('click', () => this.closeMobileSidebar());
    this.sidebarBackdrop.addEventListener('click', () => this.closeMobileSidebar());

    // New chat
    this.newChatBtn.addEventListener('click', () => this.createNewChat());
    if (this.mobileNewChatBtn) {
      this.mobileNewChatBtn.addEventListener('click', () => this.createNewChat());
    }

    // Search chat
    this.searchChatInput.addEventListener('input', (e) => {
      this.renderSidebar(e.target.value);
    });

    // Clear all chats
    this.clearAllChatsBtn.addEventListener('click', () => {
      if (confirm('Clear all conversation history? This cannot be undone.')) {
        this.storage.clearAllConversations();
        this.createNewChat(false);
        this.showToast('All conversations cleared');
      }
    });

    // Chat Form Submit
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });

    // Prompt input auto-expand & enter handling
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.promptInput.addEventListener('input', () => {
      this.adjustTextareaHeight();
    });

    // Stop button
    this.stopBtn.addEventListener('click', () => {
      this.stopGeneration();
    });

    // Scroll area tracking
    this.chatScrollArea.addEventListener('scroll', () => {
      this.handleScroll();
    });

    this.scrollToBottomBtn.addEventListener('click', () => {
      this.scrollToBottom();
    });

    // Starter suggestion cards
    document.querySelectorAll('.prompt-starter-card').forEach(card => {
      card.addEventListener('click', () => {
        const text = card.dataset.prompt || card.textContent.trim();
        this.promptInput.value = text;
        this.adjustTextareaHeight();
        this.handleSendMessage();
      });
    });

    // Delegated click for "Copy Code" buttons inside markdown
    document.addEventListener('click', (e) => {
      const copyCodeBtn = e.target.closest('.copy-code-btn');
      if (copyCodeBtn) {
        const rawCode = decodeURIComponent(copyCodeBtn.dataset.code || '');
        this.copyToClipboard(rawCode, copyCodeBtn);
      }
    });

    // Settings Modal
    this.openSettingsBtn.addEventListener('click', () => this.openSettings());
    if (this.mobileSettingsBtn) {
      this.mobileSettingsBtn.addEventListener('click', () => this.openSettings());
    }
    this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this.closeSettings();
    });

    this.providerSelect.addEventListener('change', (e) => {
      this.handleProviderChange(e.target.value);
    });

    this.temperatureSlider.addEventListener('input', (e) => {
      this.tempValueDisplay.textContent = e.target.value;
    });

    this.toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPass = this.apiKeyInput.type === 'password';
      this.apiKeyInput.type = isPass ? 'text' : 'password';
    });

    this.testConnectionBtn.addEventListener('click', () => {
      this.testApiConnection();
    });

    this.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettingsFromForm();
    });

    this.exportChatsBtn.addEventListener('click', () => this.handleExport());
    this.importFileInput.addEventListener('change', (e) => this.handleImport(e));

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Escape closes modal
      if (e.key === 'Escape') {
        this.closeSettings();
      }
      // Ctrl/Cmd + Shift + O or Ctrl + K for New Chat
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.createNewChat();
      }
    });
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.chatApp = new App();
});
