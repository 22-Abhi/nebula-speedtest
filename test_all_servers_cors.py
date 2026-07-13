import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://librespeed.org/backend-servers/servers.php"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        servers = json.loads(response.read().decode('utf-8'))
        print(f"Scanning {len(servers)} servers for native CORS support...")
        
        cors_servers = []
        for srv in servers:
            name = srv.get("name")
            base_url = srv.get("server")
            ping_path = srv.get("pingURL", "empty.php")
            ping_url = urllib.parse.urljoin(base_url, ping_path)
            
            try:
                ping_req = urllib.request.Request(
                    ping_url + "?r=test", 
                    method="GET", 
                    headers={"User-Agent": "Mozilla/5.0", "Origin": "http://localhost:8080"}
                )
                with urllib.request.urlopen(ping_req, context=ctx, timeout=3) as res:
                    origin = res.headers.get("Access-Control-Allow-Origin")
                    if origin == "*" or origin == "http://localhost:8080":
                        print(f"[CORS ALLOWED] {name} - {base_url}")
                        cors_servers.append(srv)
                    else:
                        pass
            except Exception as e:
                pass
                
        print(f"\nFound {len(cors_servers)} servers with native CORS support.")
        print(json.dumps(cors_servers, indent=2))
except Exception as e:
    print("Error:", e)
