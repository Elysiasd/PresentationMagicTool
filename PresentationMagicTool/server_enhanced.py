#!/usr/bin/env python3
"""
Enhanced HTTP server for PresentationMagicTool
Serves the web application and provides Python code execution API
"""
import http.server
import socketserver
import os
import json
import subprocess
import sys
import tempfile
from urllib.parse import urlparse, parse_qs
from pathlib import Path

PORT = 5000
DIRECTORY = "PresentationMagicTool"

class EnhancedHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # CORS headers for API requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable caching
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests for code execution"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/execute':
            self.execute_python_code()
        else:
            self.send_error(404, "Endpoint not found")
    
    def execute_python_code(self):
        """Execute Python code and return the result"""
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            code = data.get('code', '')
            timeout = data.get('timeout', 10)  # 默认超时 10 秒
            
            if not code:
                self.send_json_response({
                    'success': False,
                    'error': 'No code provided'
                }, 400)
                return
            
            # 在代码开头添加编码设置和 UTF-8 支持
            code_with_encoding = f"""# -*- coding: utf-8 -*-
import sys
import io

# 设置标准输出为 UTF-8 编码
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 用户代码开始
{code}
"""
            
            # 创建临时文件保存代码
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                f.write(code_with_encoding)
                temp_file = f.name
            
            try:
                # 执行 Python 代码
                # 设置环境变量强制使用 UTF-8
                env = os.environ.copy()
                env['PYTHONIOENCODING'] = 'utf-8'
                
                result = subprocess.run(
                    [sys.executable, temp_file],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    encoding='utf-8',
                    errors='replace',
                    env=env
                )
                
                # 准备响应
                response = {
                    'success': result.returncode == 0,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'returncode': result.returncode
                }
                
                self.send_json_response(response, 200)
                
            except subprocess.TimeoutExpired:
                self.send_json_response({
                    'success': False,
                    'error': f'Code execution timeout ({timeout}s)',
                    'stdout': '',
                    'stderr': f'程序执行超时（超过 {timeout} 秒）',
                    'returncode': -1
                }, 200)
            
            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e),
                    'stdout': '',
                    'stderr': f'执行错误: {str(e)}',
                    'returncode': -1
                }, 200)
            
            finally:
                # 删除临时文件
                try:
                    os.unlink(temp_file)
                except:
                    pass
        
        except json.JSONDecodeError:
            self.send_json_response({
                'success': False,
                'error': 'Invalid JSON'
            }, 400)
        
        except Exception as e:
            self.send_json_response({
                'success': False,
                'error': str(e)
            }, 500)
    
    def send_json_response(self, data, status_code=200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Custom log format"""
        if self.path.startswith('/api/'):
            print(f"[API] {self.command} {self.path} - {args[1]}")
        else:
            super().log_message(format, *args)

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("0.0.0.0", PORT), EnhancedHTTPRequestHandler) as httpd:
        print("=" * 60)
        print(f"🎉 演示神器服务器已启动")
        print(f"📍 访问地址: http://localhost:{PORT}")
        print(f"📁 服务目录: {DIRECTORY}")
        print(f"🐍 Python 版本: {sys.version.split()[0]}")
        print(f"🚀 Python 代码执行 API 已启用")
        print("=" * 60)
        print("按 Ctrl+C 停止服务器\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n服务器已停止")
            sys.exit(0)

if __name__ == "__main__":
    main()
