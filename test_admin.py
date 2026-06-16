import requests

API = "http://localhost:8000"

print("1. Signing up as Admin...")
res = requests.post(f"{API}/api/auth/signup", json={"email": "nanhuaniket03@gmail.com", "password": "Grazitti$765!"})
print(res.status_code, res.text)

print("\n2. Logging in as Admin...")
res = requests.post(f"{API}/api/auth/login", data={"username": "nanhuaniket03@gmail.com", "password": "Grazitti$765!"})
print(res.status_code)
admin_token = res.json().get("access_token")

print("\n3. Signing up as Regular User...")
res = requests.post(f"{API}/api/auth/signup", json={"email": "regular@example.com", "password": "password123"})
print(res.status_code, res.text)

print("\n4. Asking a question as Regular User...")
res = requests.post(f"{API}/api/auth/login", data={"username": "regular@example.com", "password": "password123"})
user_token = res.json().get("access_token")
requests.post(f"{API}/api/query", json={"question": "Test", "level": "Primary (Class 1-5)", "subject": "Science"}, headers={"Authorization": f"Bearer {user_token}"})

print("\n5. Fetching Admin Stats...")
res = requests.get(f"{API}/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
print(res.status_code, res.text)
