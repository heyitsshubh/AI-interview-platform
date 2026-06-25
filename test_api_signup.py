import urllib.request
import json
import uuid

def test_signup_http():
    url = "http://localhost:8000/api/auth/signup"
    email = f"test_{uuid.uuid4()}@example.com"
    data = {
        "email": email,
        "password": "Password123!",
        "full_name": "Test User",
        "role": "CANDIDATE"
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        print(f"Sending POST to {url}...")
        response = urllib.request.urlopen(req)
        print(f"Status Code: {response.getcode()}")
        print(f"Response: {response.read().decode('utf-8')}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_signup_http()
