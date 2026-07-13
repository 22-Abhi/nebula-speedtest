import http.server
import urllib.parse
import sys
import requests
from socketserver import ThreadingMixIn

# Disable warnings from urllib3 for untrusted SSL certs
requests.packages.urllib3.disable_warnings()

# Create a global thread-safe requests session to enable TCP connection pooling (Keep-Alive)
session = requests.Session()
session.verify = False

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow CORS on all files served by the server
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/proxy':
            self.handle_proxy('GET')
        else:
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/proxy':
            self.handle_proxy('POST')
        else:
            super().do_POST()

    def handle_proxy(self, method):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if 'url' not in query:
            self.send_error(400, "Missing 'url' parameter")
            return

        target_url = query['url'][0]
        
        # Read request body for POST uploads
        data = None
        if method == 'POST':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                data = self.rfile.read(content_length)

        # Forward incoming request headers, omitting routing-specific ones
        headers = {}
        for header, val in self.headers.items():
            if header.lower() not in ['host', 'origin', 'referer', 'connection', 'accept-encoding']:
                headers[header] = val

        try:
            # Fetch target with TCP connection pooling & streaming enabled
            res = session.request(
                method=method,
                url=target_url,
                data=data,
                headers=headers,
                stream=True,
                timeout=25
            )

            self.send_response(res.status_code)
            
            # Copy response headers from the target server
            for header, value in res.headers.items():
                if header.lower() not in ['access-control-allow-origin', 'content-encoding', 'transfer-encoding', 'connection']:
                    self.send_header(header, value)
            
            self.end_headers()
            
            # Stream the response body in chunks back to the client
            for chunk in res.iter_content(chunk_size=65536):
                if chunk:
                    self.wfile.write(chunk)
                    
        except Exception as e:
            print(f"Proxy connection failed for target: {target_url} - Error: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

class ThreadedHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    """Handle requests in a separate thread to support high-throughput parallel tests."""
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    server_address = ('127.0.0.1', port)
    httpd = ThreadedHTTPServer(server_address, ProxyHTTPRequestHandler)
    print(f"Nebula Speedtest threaded proxy active on http://127.0.0.1:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
