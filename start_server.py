#!/usr/bin/env python3
import http.server, socketserver, socket, os, json
PORT = 5000
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, 'data', 'data.json')
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/data':
            try:
                with open(DATA_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                data = {"items":[], "tags":[], "cols":[]}
            b = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path == '/api/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else b''
            try:
                data = json.loads(body.decode('utf-8'))
                os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
                with open(DATA_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'OK')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return
        return http.server.SimpleHTTPRequestHandler.do_POST(self)

def get_local_ip():
    ip='localhost'
    try:
        s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8',80))
        ip = s.getsockname()[0]; s.close()
    except Exception:
        try: ip = socket.gethostbyname(socket.gethostname())
        except: ip='localhost'
    return ip

if __name__ == '__main__':
    os.chdir(ROOT)
    ip = get_local_ip()
    addr_local = f'http://localhost:{PORT}'
    addr_lan = f'http://{ip}:{PORT}'
    print('Version: bookmarks_v27c')
    print('請在瀏覽器使用下列其中一個連結：')
    print('Local: ', addr_local)
    print('LAN:   ', addr_lan)
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('Stopping server')
