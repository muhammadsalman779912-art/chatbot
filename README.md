# Salman Chat Bot 🚀

A production-ready, elegant, and ultra-responsive web interface for AI chat. Inspired by ChatGPT and Claude, built with Tailwind CSS, Lucide icons, Marked.js, and KaTeX, featuring real-time Server-Sent Events (SSE) streaming, thought process inspection, code syntax highlighting, and conversation history management.

---

## ✨ Features

- **🎨 Modern ChatGPT / Claude Inspired Design**:
  - Smooth Dark & Light mode toggle with persistent state.
  - Frosted glassmorphism effects (`backdrop-blur`), subtle elevation shadows, and micro-interactions.
  - Fully responsive layout engineered for mobile phones, tablets, and desktop displays.
  - Collapsible drawer sidebar with backdrop overlay on mobile devices.

- **⚡ Real-time Streaming & Intelligence**:
  - Native SSE (Server-Sent Events) chunk-by-chunk real-time response streaming.
  - **Thought Process Inspection**: Collapsible thinking drawer for reasoning models (e.g. OpenAI GPT-OSS, DeepSeek R1).
  - "Stop Generating" button to cancel in-flight streaming anytime.
  - Auto-growing textarea with `Enter` to send and `Shift + Enter` for new lines.

- **📝 Markdown, Math & Code Highlighting**:
  - Full GitHub-Flavored Markdown (GFM) parsing (tables, blockquotes, lists, links).
  - KaTeX support for inline (`$...$`) and block (`$$...$$`) mathematical formulas.
  - Highlight.js code blocks with language labels and a one-click **"Copy Code"** button with visual feedback.
  - XSS sanitization powered by DOMPurify.

- **🗂️ Conversation History Management**:
  - Grouped by date: *Today*, *Yesterday*, *Previous 7 Days*, and *Older*.
  - Inline conversation renaming and deletion with confirmation.
  - Instant conversation search filter.
  - "New Chat" with keyboard shortcut (`Ctrl + K`).
  - One-click conversation export & import (`.json` format) for backups and data migration.

- **🛠️ AI Provider & Model Flexibility**:
  - **Groq** (Default, ultra-fast inference with models like `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`).
  - **OpenAI** (`gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`).
  - **Custom / Local** (Ollama, LM Studio, OpenRouter, or any OpenAI-compatible base URL).
  - **Backend Proxy Mode** (`/api/chat`) to protect private API keys from client visibility.
  - Built-in **"Test API Connection"** button inside the Settings dialog to verify keys instantly.

---

## 📁 Project Structure

```text
chatbpt/
├── index.html           # Main responsive Single-Page Application (SPA)
├── css/
│   └── styles.css       # Glassmorphism, scrollbars, code blocks, animations
├── js/
│   ├── app.js           # Main UI application controller and event bus
│   ├── api.js           # Multi-provider streaming chat client and connection tester
│   ├── storage.js       # LocalStorage manager for chats, sessions, and settings
│   └── markdown.js      # Marked.js, Highlight.js, DOMPurify, and KaTeX integration
├── api/
│   └── chat.js          # Edge / Serverless function for Vercel deployment
├── server.py            # Zero-dependency Python server with SSE proxy
├── open ai.py           # Python CLI script
├── .env.example         # Template for environment variables
├── .env                 # Local environment file (protected by .gitignore)
├── .gitignore           # Git ignore for secrets and temporary files
├── vercel.json          # Zero-config deployment file for Vercel
├── netlify.toml         # Zero-config deployment file for Netlify
└── README.md            # Comprehensive documentation
```

---

## 🚀 Quick Start (Local)

You can run Salman Chat Bot locally in two ways:

### Option 1: Standalone Python Server (Recommended)
This runs the lightweight, zero-dependency server that serves the UI and proxies streaming API requests:

```bash
# Start the local server
python server.py

# Or specify a custom port
python server.py --port 3000
```

Open your browser and navigate to:
👉 **`http://localhost:8000`**

### Option 2: Direct Static File Opening
Because the web app uses pure modular HTML/JS/CSS, you can also launch it directly:
- Double-click **`index.html`** in your file manager, or
- Run any local static server:
  ```bash
  python -m http.server 8000
  # or
  npx serve .
  ```

---

## 🔑 API Key Configuration

Your workspace is already pre-configured with your Groq API credentials.

### In the Web Interface (UI):
1. Click the **Settings (gear icon)** at the bottom-left of the sidebar (or top-right on mobile).
2. Choose your **AI Provider** (e.g. *Groq*, *OpenAI*, or *Custom*).
3. Enter or update your API Key (toggle visibility with the eye icon).
4. Click **"Test API Connection"** to verify that your key and selected model are communicating successfully.
5. Click **"Save Settings"**.

*(Note: API keys entered in the UI are stored strictly in your browser's private `localStorage`. They are never sent to third-party tracking servers.)*

### In `.env` (Server Proxy Mode):
If you prefer keeping keys server-side:
```env
GROQ_API_KEY=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
OPENAI_API_KEY=your_openai_api_key_here
PORT=8000
```
When using the Python server or Vercel, requests routed to `/api/chat` will automatically use the key from your environment.

---

## 🌐 Deploying Online (Free & Production-Ready)

### 1. Deploy on Vercel (1-Click)
Vercel supports both static assets and the serverless Edge proxy in `api/chat.js`:

1. Install Vercel CLI or connect via GitHub:
   ```bash
   npm i -g vercel
   vercel
   ```
2. Or import your Git repository directly on [vercel.com/new](https://vercel.com/new).
3. Under **Project Settings > Environment Variables**, optionally add:
   - `GROQ_API_KEY`: your Groq API key
   - `OPENAI_API_KEY`: your OpenAI API key
4. Click **Deploy**. You will receive an instant public URL (`https://your-app.vercel.app`).

### 2. Deploy on Netlify (Drag & Drop or Git)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop the `chatbpt` folder into the upload box.
3. Your web app is live instantly with an HTTPS domain!

### 3. Deploy on GitHub Pages
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Salman Chat Bot"
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. In GitHub, go to **Settings > Pages**.
3. Under **Branch**, select `main` and root `/`, then click **Save**.
4. Your site will be published at `https://<your-username>.github.io/<repo-name>/`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Create a New Chat |
| `Enter` | Send message |
| `Shift + Enter` | New line in message box |
| `Escape` | Close Settings modal / popups |

---

## 🛡️ Security & Privacy
- **Client-Side Storage**: Chat history and user settings remain in the user's browser `localStorage`.
- **Secret Isolation**: Secrets in `.env` are protected from Git commits via `.gitignore`.
- **Content Sanitization**: All markdown-rendered HTML is sanitized with DOMPurify to prevent XSS.

