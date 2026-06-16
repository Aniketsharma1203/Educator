import requests

API = "http://localhost:8000"

print("Logging in...")
res = requests.post(f"{API}/api/auth/login", data={"username": "test4@example.com", "password": "password123"})
token = res.json().get("access_token")

for i in range(4):
    print(f"Request {i+1}...")
    res = requests.post(f"{API}/api/query", json={"question": f"Question {i}", "level": "Primary (Class 1-5)", "subject": "Science"}, headers={"Authorization": f"Bearer {token}"})
    print(res.status_code, res.text)
