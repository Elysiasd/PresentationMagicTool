#!/usr/bin/env python3
"""
Simple HTTP server for PresentationMagicTool
Serves the web application on port 5000
"""
import http.server
import socketserver
import os

PORT = 5000
DIRECTORY = "PresentationMagicTool"

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Disable caching for Replit iframe
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
        print(f"演示神器服务器运行在: http://0.0.0.0:{PORT}")
        print(f"提供目录: {DIRECTORY}")
        httpd.serve_forever()
