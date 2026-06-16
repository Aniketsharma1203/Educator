"""
OmniTutor Backend — Full Test Suite
====================================
Tests: Auth, Rate Limiting, Subject History, Gamification, Admin, Guardrails.

Run with:
    cd backend && pytest tests/ -v
"""

import pytest
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import AsyncMock, patch

# ── Use an isolated in-memory SQLite DB for tests ────────────────────────────
TEST_DB_URL = "sqlite:///./test_educator.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
from main import app

# Override the DB dependency to use the test DB
def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create all tables before tests, drop after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_educator.db"):
        os.remove("./test_educator.db")

@pytest.fixture(scope="session")
def client():
    return TestClient(app)

@pytest.fixture(scope="session")
def regular_user_token(client):
    """Sign up and log in a regular test user, return token."""
    client.post("/api/auth/signup", json={"email": "testuser@example.com", "password": "Password123!"})
    res = client.post("/api/auth/login", data={"username": "testuser@example.com", "password": "Password123!"})
    return res.json()["access_token"]

@pytest.fixture(scope="session")
def admin_token(client):
    """Sign up and log in the admin user, return token."""
    client.post("/api/auth/signup", json={"email": "nanhuaniket03@gmail.com", "password": "Grazitti$765!"})
    res = client.post("/api/auth/login", data={"username": "nanhuaniket03@gmail.com", "password": "Grazitti$765!"})
    return res.json()["access_token"]

def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuth:
    def test_signup_success(self, client):
        res = client.post("/api/auth/signup", json={"email": "newuser@example.com", "password": "pass123"})
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "newuser@example.com"
        assert data["is_admin"] is False
        assert "id" in data

    def test_signup_duplicate_email(self, client):
        client.post("/api/auth/signup", json={"email": "dup@example.com", "password": "pass123"})
        res = client.post("/api/auth/signup", json={"email": "dup@example.com", "password": "pass123"})
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"]

    def test_login_success(self, client):
        client.post("/api/auth/signup", json={"email": "logintest@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "logintest@example.com", "password": "pass123"})
        assert res.status_code == 200
        assert "access_token" in res.json()
        assert res.json()["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        client.post("/api/auth/signup", json={"email": "wrongpwd@example.com", "password": "correct"})
        res = client.post("/api/auth/login", data={"username": "wrongpwd@example.com", "password": "wrong"})
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client):
        res = client.post("/api/auth/login", data={"username": "ghost@example.com", "password": "nope"})
        assert res.status_code == 401

    def test_me_endpoint_authenticated(self, client, regular_user_token):
        res = client.get("/api/auth/me", headers=auth_header(regular_user_token))
        assert res.status_code == 200
        assert res.json()["email"] == "testuser@example.com"

    def test_me_endpoint_unauthenticated(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_admin_signup_sets_is_admin(self, client, admin_token):
        res = client.get("/api/auth/me", headers=auth_header(admin_token))
        assert res.status_code == 200
        assert res.json()["is_admin"] is True


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: CHAT QUERY & RATE LIMITING
# ═══════════════════════════════════════════════════════════════════════════════

class TestQuery:
    @patch("main.run_inference", new_callable=AsyncMock, return_value="Test answer from AI.")
    def test_query_success(self, mock_ai, client, regular_user_token):
        res = client.post("/api/query",
            json={"question": "What is 2+2?", "level": "Primary (Class 1-5)", "subject": "Mathematics"},
            headers=auth_header(regular_user_token)
        )
        assert res.status_code == 200
        assert res.json()["status"] == "completed"
        assert res.json()["answer"] == "Test answer from AI."

    def test_query_unauthenticated(self, client):
        res = client.post("/api/query", json={"question": "hi", "level": "Primary (Class 1-5)", "subject": "Science"})
        assert res.status_code == 401

    @patch("main.run_inference", new_callable=AsyncMock, return_value="ok")
    def test_rate_limit_enforced(self, mock_ai, client):
        """Sign up a fresh user and hammer 4 requests — 4th should be 429."""
        client.post("/api/auth/signup", json={"email": "ratelimit@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "ratelimit@example.com", "password": "pass123"})
        token = res.json()["access_token"]
        headers = auth_header(token)
        payload = {"question": "Q", "level": "Primary (Class 1-5)", "subject": "Science"}

        # First 3 should succeed
        for _ in range(3):
            r = client.post("/api/query", json=payload, headers=headers)
            assert r.status_code == 200, f"Expected 200 but got {r.status_code}"

        # 4th should be blocked
        r = client.post("/api/query", json=payload, headers=headers)
        assert r.status_code == 429
        assert "Rate limit" in r.json()["detail"]


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: SUBJECT-SPECIFIC CHAT HISTORY
# ═══════════════════════════════════════════════════════════════════════════════

class TestChatHistory:
    @patch("main.run_inference", new_callable=AsyncMock, return_value="A math answer.")
    def test_history_is_subject_scoped(self, mock_ai, client):
        """Maths history should not appear in Science history."""
        client.post("/api/auth/signup", json={"email": "historytest@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "historytest@example.com", "password": "pass123"})
        token = res.json()["access_token"]
        headers = auth_header(token)

        # Ask a Maths question
        client.post("/api/query",
            json={"question": "What is calculus?", "level": "High School", "subject": "Mathematics"},
            headers=headers
        )

        # Fetch Science history — should be empty
        res = client.get("/api/history?subject=Science", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) == 0

        # Fetch Maths history — should have 2 messages (user + assistant)
        res = client.get("/api/history?subject=Mathematics", headers=headers)
        assert res.status_code == 200
        msgs = res.json()
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert msgs[1]["role"] == "assistant"

    def test_history_requires_auth(self, client):
        res = client.get("/api/history?subject=Mathematics")
        assert res.status_code == 401

    def test_history_requires_subject_param(self, client, regular_user_token):
        res = client.get("/api/history", headers=auth_header(regular_user_token))
        assert res.status_code == 422  # Unprocessable — missing required query param


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: GAMIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

class TestGamification:
    @patch("main.run_inference", new_callable=AsyncMock, return_value="Fun science answer!")
    def test_xp_awarded_for_young_level(self, mock_ai, client):
        """Asking a question as a young user should earn XP."""
        client.post("/api/auth/signup", json={"email": "kiduser@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "kiduser@example.com", "password": "pass123"})
        token = res.json()["access_token"]
        headers = auth_header(token)

        res = client.post("/api/query",
            json={"question": "What is gravity?", "level": "Primary (Class 1-5)", "subject": "Science"},
            headers=headers
        )
        data = res.json()
        assert res.status_code == 200
        assert data["xp_earned"] == 10
        assert data["new_xp"] == 10
        assert data["new_level"] == 1
        assert data["streak_count"] == 1

    @patch("main.run_inference", new_callable=AsyncMock, return_value="ok")
    def test_xp_increments_each_question(self, mock_ai, client):
        """Each question should award +10 XP and accumulate correctly."""
        client.post("/api/auth/signup", json={"email": "xpinc@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "xpinc@example.com", "password": "pass123"})
        token = res.json()["access_token"]
        headers = auth_header(token)

        # Ask 3 questions (max within rate limit window)
        for i in range(3):
            res = client.post("/api/query",
                json={"question": f"Question {i}", "level": "Primary (Class 1-5)", "subject": "Science"},
                headers=headers
            )
            assert res.status_code == 200
            data = res.json()
            assert data["xp_earned"] == 10
            assert data["new_xp"] == (i + 1) * 10

        # After 3 questions, level should still be 1 (need 50 XP for level 2)
        profile_res = client.get("/api/profile", headers=headers)
        assert profile_res.json()["xp"] == 30
        assert profile_res.json()["level"] == 1

    @patch("main.run_inference", new_callable=AsyncMock, return_value="PhD answer.")
    def test_no_xp_for_advanced_level(self, mock_ai, client):
        """Gamification should NOT activate for university/PhD users."""
        client.post("/api/auth/signup", json={"email": "phduser@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "phduser@example.com", "password": "pass123"})
        token = res.json()["access_token"]

        res = client.post("/api/query",
            json={"question": "Explain tensors in differential geometry.", "level": "PhD", "subject": "Mathematics"},
            headers=auth_header(token)
        )
        assert res.status_code == 200
        assert res.json()["xp_earned"] == 0

    @patch("main.run_inference", new_callable=AsyncMock, return_value="ok")
    def test_first_step_badge_unlocked(self, mock_ai, client):
        """First question should unlock the 'first_step' badge."""
        client.post("/api/auth/signup", json={"email": "badgeuser@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "badgeuser@example.com", "password": "pass123"})
        token = res.json()["access_token"]

        res = client.post("/api/query",
            json={"question": "Hello!", "level": "Primary (Class 1-5)", "subject": "Science"},
            headers=auth_header(token)
        )
        assert "first_step" in res.json()["new_badges"]

    def test_profile_endpoint(self, client):
        """GET /api/profile should return XP, level, streak, and badges."""
        client.post("/api/auth/signup", json={"email": "profiletest@example.com", "password": "pass123"})
        res = client.post("/api/auth/login", data={"username": "profiletest@example.com", "password": "pass123"})
        token = res.json()["access_token"]

        res = client.get("/api/profile", headers=auth_header(token))
        assert res.status_code == 200
        data = res.json()
        assert "xp" in data
        assert "level" in data
        assert "level_name" in data
        assert "streak_count" in data
        assert "badges" in data
        assert "xp_for_next_level" in data

    def test_profile_requires_auth(self, client):
        res = client.get("/api/profile")
        assert res.status_code == 401

    def test_calc_level_thresholds(self):
        """Unit test the level calculation helper."""
        from main import calc_level
        assert calc_level(0) == 1    # Curious Cub
        assert calc_level(49) == 1
        assert calc_level(50) == 2   # Explorer
        assert calc_level(149) == 2
        assert calc_level(150) == 3  # Scholar
        assert calc_level(350) == 4  # Genius
        assert calc_level(700) == 5  # Master
        assert calc_level(9999) >= 5 # High XP = high level


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: ADMIN PANEL
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdmin:
    def test_admin_can_see_stats(self, client, admin_token):
        res = client.get("/api/admin/stats", headers=auth_header(admin_token))
        assert res.status_code == 200
        data = res.json()
        assert "users" in data
        assert isinstance(data["users"], list)
        # Each user entry should have expected keys
        if data["users"]:
            user = data["users"][0]
            assert "email" in user
            assert "questions_asked" in user
            assert "is_admin" in user
            assert "level" in user
            assert "streak" in user

    def test_regular_user_cannot_see_admin_stats(self, client, regular_user_token):
        res = client.get("/api/admin/stats", headers=auth_header(regular_user_token))
        assert res.status_code == 403

    def test_unauthenticated_cannot_see_admin_stats(self, client):
        res = client.get("/api/admin/stats")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: ANALYTICS STATS
# ═══════════════════════════════════════════════════════════════════════════════

class TestStats:
    def test_stats_endpoint_accessible(self, client):
        res = client.get("/api/stats")
        assert res.status_code == 200
        data = res.json()
        assert "visits" in data
        assert "questions" in data
        assert "tiers" in data
        assert "total" in data["questions"]

    def test_root_endpoint(self, client):
        res = client.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
