import requests

API = "http://localhost:8000"

print("1. Signing up...")
res = requests.post(f"{API}/api/auth/signup", json={"email": "test4@example.com", "password": "password123"})
print(res.status_code, res.text)

print("\n2. Logging in...")
res = requests.post(f"{API}/api/auth/login", data={"username": "test4@example.com", "password": "password123"})
print(res.status_code)
token = res.json().get("access_token")

print("\n3. Asking a question...")
res = requests.post(f"{API}/api/query", json={"question": "Hello", "level": "Primary (Class 1-5)", "subject": "Science"}, headers={"Authorization": f"Bearer {token}"})
print(res.status_code, res.text)

print("\n4. Checking history...")
res = requests.get(f"{API}/api/history", headers={"Authorization": f"Bearer {token}"})
print(res.status_code, res.text)
