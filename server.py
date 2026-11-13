#!/usr/bin/env python3
"""
Salman Chat Bot - Local Development & Proxy Server
Multi-threaded Python HTTP server with SSE streaming proxy.

Usage:
    python server.py
    or
    python server.py --port 8080
"""

import os
import sys
import json
import socket
import argparse
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Load environment variables from .env if present
def load_dotenv():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val

load_dotenv()

DEFAULT_PORT = int(os.environ.get('PORT', 8000))
DEFAULT_GROQ_KEY = os.environ.get('GROQ_API_KEY', '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')
DEFAULT_OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '')

class SalmanChatBotHandler(SimpleHTTPRequestHandler):
    """Handles static files and forwards streaming API completions"""

    # Ensure correct MIME types on Windows regardless of registry alterations
    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    })

    def end_headers(self):
        # Allow cross-origin requests for development flexibility
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Bypass-Tunnel-Reminder')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        # Proxy endpoint: /api/chat/completions or /api/chat
        if self.path.startswith('/api/chat'):
            self.handle_proxy_chat()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_proxy_chat(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            req_json = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': f'Invalid JSON: {str(e)}'}}).encode('utf-8'))
            return

        # Determine target provider & credentials
        auth_header = self.headers.get('Authorization')
        target_api_key = ''
        if auth_header and auth_header.startswith('Bearer '):
            target_api_key = auth_header.split('Bearer ', 1)[1].strip()

        # If client did not provide an explicit key in request headers, fallback to server env
        target_url = "https://api.groq.com/openai/v1/chat/completions"
        if not target_api_key:
            target_api_key = DEFAULT_GROQ_KEY or DEFAULT_OPENAI_KEY
            if not target_api_key:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': {'message': 'No API key provided. Please set GROQ_API_KEY in .env or pass Authorization header.'}}).encode('utf-8'))
                return

        # Sanitize and ensure valid model
        model = req_json.get('model', '')
        if not model or model == 'default' or 'llama' in model.lower():
            req_json['model'] = 'openai/gpt-oss-20b'

        forward_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {target_api_key}',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        try:
            proxy_req = urllib.request.Request(
                target_url,
                data=json.dumps(req_json).encode('utf-8'),
                headers=forward_headers,
                method='POST'
            )

            with urllib.request.urlopen(proxy_req, timeout=60) as response:
                self.send_response(response.status)
                for header, val in response.getheaders():
                    if header.lower() in ['content-type', 'cache-control']:
                        self.send_header(header, val)
                self.end_headers()

                # Stream response bytes directly to client
                while True:
                    chunk = response.read(1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()

        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': {'message': f'Proxy error: {str(e)}'}}).encode('utf-8'))

class ThreadedHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()

def run_server(port):
    server_address = ('', port)
    try:
        httpd = ThreadedHTTPServer(server_address, SalmanChatBotHandler)
    except OSError as e:
        # Fallback to alternate port if main port is in use
        alt_port = port + 1 if port != 8080 else 8000
        print(f"⚠️ Port {port} busy ({e}). Trying port {alt_port}...")
        server_address = ('', alt_port)
        port = alt_port
        httpd = ThreadedHTTPServer(server_address, SalmanChatBotHandler)

    print("\n" + "="*60)
    print(" 🚀 Salman Chat Bot Web Server Running!")
    print("="*60)
    print(f" • Local URL:    http://localhost:{port}")
    print(f" • Directory:    {os.path.abspath(os.path.dirname(__file__))}")
    print(f" • API Proxy:    http://localhost:{port}/api/chat")
    print(f" • Configured:   Groq API Key {'[Active]' if DEFAULT_GROQ_KEY else '[None]'}")
    print("="*60)
    print(" Ready! Open http://localhost:%d in your browser.\n" % port)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Salman Chat Bot Web Server')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Port to bind (default: 8000)')
    args = parser.parse_args()
    run_server(args.port)
