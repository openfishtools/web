#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
from pathlib import Path

PORT = 8000
DIRECTORY = "."

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/'):
            self.send_error(501, "API endpoints require Node.js server. Use 'npm start' instead.")
            return
        
        if self.path == '/' or self.path == '':
            self.path = '/index.html'
        
        return super().do_GET()
    
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def run_server():
    os.chdir(DIRECTORY)
    handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"🚀 Server running at http://localhost:{PORT}")
        print(f"📁 Serving files from: {os.getcwd()}")
        print(f"⚠️  API endpoints require Node.js backend")
        print(f"   Run 'npm start' in another terminal to enable API")
        print(f"\n Press Ctrl+C to stop")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✅ Server stopped")

if __name__ == "__main__":
    run_server()
