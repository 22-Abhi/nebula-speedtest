import urllib.request
import json
import ssl

# List of servers to test
servers = [
    {"name": "Bangalore, India (DO)", "url": "https://in1.backend.librespeed.org/empty.php"},
    {"name": "Singapore (DigitalOcean)", "url": "https://speedtest.dsgroupmedia.com/backend/empty.php"},
    {"name": "Tokyo, Japan (A573)", "url": "https://librespeed.a573.net/backend/empty.php"},
    {"name": "London, England (Clouvider)", "url": "https://lon.speedtest.clouvider.net/backend/empty.php"},
    {"name": "Frankfurt, Germany (Clouvider)", "url": "https://fra.speedtest.clouvider.net/backend/empty.php"},
    {"name": "New York, USA (Clouvider)", "url": "https://nyc.speedtest.clouvider.net/backend/empty.php"},
    {"name": "Los Angeles, USA (Clouvider)", "url": "https://la.speedtest.clouvider.net/backend/empty.php"}
]

# Bypass SSL errors for testing
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

for srv in servers:
    print(f"Testing {srv['name']}...")
    req = urllib.request.Request(
        srv['url'] + "?r=test",
        headers={
            "Origin": "http://127.0.0.1:8080",
            "User-Agent": "Mozilla/5.0"
        },
        method="OPTIONS"  # Test preflight first
    )
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            headers = response.info()
            cors = headers.get("Access-Control-Allow-Origin", "None")
            methods = headers.get("Access-Control-Allow-Methods", "None")
            print(f"  OPTIONS: Status={response.status}, CORS={cors}, Methods={methods}")
    except Exception as e:
        print(f"  OPTIONS: Failed: {e}")
        
    req_post = urllib.request.Request(
        srv['url'] + "?r=test",
        headers={
            "Origin": "http://127.0.0.1:8080",
            "User-Agent": "Mozilla/5.0"
        },
        data=b"hello",
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req_post, context=ctx, timeout=5) as response:
            headers = response.info()
            cors = headers.get("Access-Control-Allow-Origin", "None")
            print(f"  POST   : Status={response.status}, CORS={cors}")
    except Exception as e:
        print(f"  POST   : Failed: {e}")
    print()
