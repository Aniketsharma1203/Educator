import os
import asyncio
from datetime import datetime, timedelta, date
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from sqlalchemy.orm import Session

from tasks import run_inference
import models
import database
from database import engine, get_db
from auth import get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
from dotenv import load_dotenv
from sqlalchemy import func
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

load_dotenv()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="OmniTutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stats tracking
STATS = {
    "visits": 0,
    "questions:total": 0,
    "questions:math": 0,
    "questions:science": 0,
    "questions:english": 0,
    "questions:gk": 0,
    "questions:coding": 0,
    "questions:agri": 0,
    "questions:law": 0,
    "questions:homework": 0,
    "questions:other": 0,
    "tier:school": 0,
    "tier:highschool": 0,
    "tier:university": 0,
    "tier:phd": 0,
}

def track(key: str, amount: int = 1):
    if key in STATS:
        STATS[key] += amount

def get_counter(key: str) -> int:
    return STATS.get(key, 0)

# Pydantic Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool = False
    xp: int = 0
    level: int = 1
    streak_count: int = 0
    badges: str = ""

class Token(BaseModel):
    access_token: str
    token_type: str

class QueryRequest(BaseModel):
    question: str
    level: str
    subject: Optional[str] = "General"
    image_base64: Optional[str] = None

class QueryResponse(BaseModel):
    status: str
    answer: str = None
    xp_earned: int = 0
    new_xp: int = 0
    new_level: int = 1
    streak_count: int = 0
    new_badges: List[str] = []
    model_used: str = ""

class ChatMessageResponse(BaseModel):
    role: str
    content: str
    timestamp: datetime

class FlashcardCreateRequest(BaseModel):
    subject: str
    topic: str
    history_context: str

class FlashcardResponse(BaseModel):
    id: int
    front: str
    back: str

class FlashcardDeckResponse(BaseModel):
    id: int
    subject: str
    topic: str
    timestamp: datetime
    cards: List[FlashcardResponse] = []

SUBJECT_KEYS = {
    "mathematics": "math",
    "science": "science",
    "english": "english",
    "general knowledge": "gk",
    "finance": "finance",
    "coding": "coding",
    "agriculture": "agri",
    "law": "law",
    "homework helper": "homework",
    "homework": "homework"
}

YOUNG_LEVELS = [
    "kindergarten", "elementary school",
    "primary (class 1-5)", "middle school (class 6-10)"
]
ADVANCED_LEVELS = ["graduate", "phd"]

# ── Gamification ─────────────────────────────────────────────────────────────
XP_PER_QUESTION = 10
LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200]  # XP needed to reach levels 1-5
LEVEL_NAMES = ["", "Curious Cub 🐣", "Explorer 🧭", "Scholar 📚", "Genius 💡", "Master 🏆"]

BADGE_DEFINITIONS = [
    {"id": "first_step",    "name": "First Step 🌱",       "desc": "Ask your first question"},
    {"id": "ten_questions", "name": "Ten Questions 🔟",    "desc": "Ask 10 questions total"},
    {"id": "hot_streak",    "name": "Hot Streak 🔥",       "desc": "Maintain a 3-day streak"},
    {"id": "star_student",  "name": "Star Student 🌟",     "desc": "Reach Scholar level"},
    {"id": "multi_subject", "name": "Big Brain 🧠",        "desc": "Ask in 3 different subjects"},
    {"id": "test_taker",   "name": "Test Taker 📝",       "desc": "Complete your first quiz"},
    {"id": "quiz_master",  "name": "Quiz Master 🏅",      "desc": "Score 100% on any quiz"},
]

def calc_level(xp: int) -> int:
    for lvl in range(len(LEVEL_THRESHOLDS) - 1, 0, -1):
        if xp >= LEVEL_THRESHOLDS[lvl]:
            return lvl + 1
    return 1

def award_gamification(user: models.User, db: Session, total_questions: int, subjects_used: list) -> tuple:
    """Award XP, update streak, check for new badges. Returns (xp_earned, new_badges)."""
    today = date.today()
    new_badges = []
    earned_badges = set(user.badges.split(",")) if user.badges else set()

    # Update streak
    if user.last_active_date is None:
        user.streak_count = 1
    elif user.last_active_date == today:
        pass  # already active today, no change
    elif user.last_active_date == today - timedelta(days=1):
        user.streak_count = (user.streak_count or 0) + 1
    else:
        user.streak_count = 1  # reset streak
    user.last_active_date = today

    # Award XP
    user.xp = (user.xp or 0) + XP_PER_QUESTION
    old_level = user.level or 1
    user.level = calc_level(user.xp)

    # Check badge: star_student (reached Scholar = level 3+)
    if user.level >= 3 and "star_student" not in earned_badges:
        earned_badges.add("star_student")
        new_badges.append("star_student")

    # Check badge: first_step
    if total_questions >= 1 and "first_step" not in earned_badges:
        earned_badges.add("first_step")
        new_badges.append("first_step")

    # Check badge: ten_questions
    if total_questions >= 10 and "ten_questions" not in earned_badges:
        earned_badges.add("ten_questions")
        new_badges.append("ten_questions")

    # Check badge: hot_streak
    if user.streak_count >= 3 and "hot_streak" not in earned_badges:
        earned_badges.add("hot_streak")
        new_badges.append("hot_streak")

    # Check badge: multi_subject (3+ distinct subjects)
    if len(set(subjects_used)) >= 3 and "multi_subject" not in earned_badges:
        earned_badges.add("multi_subject")
        new_badges.append("multi_subject")

    user.badges = ",".join(filter(None, earned_badges))
    db.commit()
    db.refresh(user)
    return XP_PER_QUESTION, new_badges

def get_system_prompt(level: str, subject: str) -> str:
    level_lower = level.lower()
    subject_lower = (subject or "general").lower()
    is_young = level_lower in YOUNG_LEVELS

    subject_contexts = {
        "mathematics": {
            "young": "You are a warm, fun math tutor. Use simple real-world examples like apples, toys, or pizza slices. Avoid complex notation.",
            "advanced": "You are a rigorous mathematics professor. Present complete formal proofs using LaTeX notation. Apply axiomatic reasoning, cite relevant theorems, and verify every step of your chain-of-thought before delivering the final answer."
        },
        "science": {
            "young": "You are an enthusiastic, child-friendly science explorer. Explain phenomena using everyday observations, fun experiments kids can do at home, and simple analogies. Use emojis to make it engaging.",
            "advanced": "You are a research-grade scientist. Provide mechanistic explanations, reference relevant empirical data, include mathematical models where applicable, and structure your response with hypotheses, evidence, and conclusions."
        },
        "english": {
            "young": "You are a creative and encouraging English teacher for young children. Use short, clear sentences. Provide fun examples, stories, or rhymes. Focus on building vocabulary with positive reinforcement.",
            "advanced": "You are a Professor of English Literature and Linguistics. Analyze language with precision, reference literary theory, quote relevant critics, and provide etymological or grammatical depth where required."
        },
        "general knowledge": {
            "young": "You are a fun, curious guide exploring the world with a child. Use surprising facts, colorful descriptions, and simple analogies. Make learning feel like an adventure.",
            "advanced": "You are a multidisciplinary scholar. Draw on history, philosophy, geopolitics, and cultural studies to provide a comprehensive, nuanced, and intellectually rigorous response."
        },
        "coding": {
            "young": "You are a fun coding buddy! Explain programming concepts using games, toys, or everyday examples. Keep code snippets very simple and easy to understand.",
            "advanced": "You are an elite senior software engineer. Provide highly optimized, production-ready code with deep architectural insights, discussing computational complexity, design patterns, and best practices."
        },
        "agriculture": {
            "young": "You are a friendly farmer and nature guide! Explain how plants grow, how soil works, and how food gets to our table using fun stories, animals, and simple analogies.",
            "advanced": "You are an expert agronomist and agricultural scientist. Provide detailed, scientifically rigorous explanations involving soil chemistry, sustainable farming techniques, crop genetics, and agribusiness economics."
        },
        "law": {
            "young": "You are a friendly community helper explaining rules and laws! Explain things like fairness, rules, and how society works using simple examples from a playground or classroom.",
            "advanced": "You are a distinguished legal scholar and professor of Law. Provide highly accurate, logical, and structured explanations of legal concepts, statutes, and case law. Emphasize reasoning and avoid giving actionable legal advice. Use bolding and headers for clarity."
        },
        "homework helper": {
            "young": "You are a supportive homework helper. NEVER give the direct answer right away. Instead, guide the student step-by-step. Ask them leading questions to help them figure it out on their own.",
            "advanced": "You are an advanced academic tutor helping with complex assignments. Break down the methodology and provide structured guidance."
        },
        "homework": {
            "young": "You are a supportive homework helper. NEVER give the direct answer right away. Instead, guide the student step-by-step. Ask them leading questions to help them figure it out on their own.",
            "advanced": "You are an advanced academic tutor helping with complex assignments. Break down the methodology and provide structured guidance."
        }
    }

    subject_data = subject_contexts.get(subject_lower, {
        "young": "You are a friendly, encouraging teacher. Provide simple, engaging, step-by-step answers without advanced notation.",
        "advanced": "You are a rigorous academic professor. Utilize rigorous logic and output structured chain-of-thought reasoning before delivering the final answer."
    })

    base_prompt = subject_data["young"] if is_young else subject_data["advanced"]
    guardrail = f"IMPORTANT RULE: If the student asks a question that is clearly unrelated to {subject} (for example, asking a science question while you are the math tutor), politely mention that the question actually belongs to another subject area, but then proceed to answer their question fully and accurately anyway."
    return f"{base_prompt}\n\nThe student is at the {level} level. This conversation is specifically in the domain of {subject}.\n{guardrail}"

@app.get("/")
def root():
    track("visits")
    return {"status": "ok", "message": "OmniTutor API"}

@app.post("/api/auth/signup", response_model=UserResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    clean_email = user.email.strip().lower()
    db_user = db.query(models.User).filter(models.User.email == clean_email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    is_admin = (clean_email == "nanhuaniket03@gmail.com")
    new_user = models.User(email=clean_email, hashed_password=hashed_password, is_admin=is_admin)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    clean_email = form_data.username.strip().lower()
    user = db.query(models.User).filter(models.User.email == clean_email).first()
    
    if user and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is linked to a Google account. Please log in using the 'Sign in with Google' button."
        )

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    track("visits")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

class GoogleAuthRequest(BaseModel):
    token: str

@app.post("/api/auth/google")
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google Auth is not configured on the server")
            
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(req.token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email'].strip().lower()
        
        # Check if user exists
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            # Auto-signup the user
            user = models.User(email=email, hashed_password="") # No password needed
            db.add(user)
            db.commit()
            db.refresh(user)
            
        track("visits")
        access_token = create_access_token(data={"sub": user.email})
        return {"access_token": access_token, "token_type": "bearer"}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@app.get("/api/auth/me", response_model=UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/api/history", response_model=List[ChatMessageResponse])
def get_chat_history(subject: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(models.ChatMessage)\
        .filter(models.ChatMessage.user_id == current_user.id)\
        .filter(models.ChatMessage.subject == subject)\
        .order_by(models.ChatMessage.timestamp.desc())\
        .limit(20).all() # Last 10 exchanges (user + assistant)
    
    return [
        ChatMessageResponse(role=msg.role, content=msg.content, timestamp=msg.timestamp)
        for msg in reversed(messages)
    ]

@app.post("/api/query", response_model=QueryResponse)
async def submit_query(
    req: QueryRequest, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Rate Limiting Check: Max 3 questions in the last 60 seconds
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
    recent_questions = db.query(models.ChatMessage)\
        .filter(models.ChatMessage.user_id == current_user.id)\
        .filter(models.ChatMessage.role == 'user')\
        .filter(models.ChatMessage.timestamp >= one_minute_ago)\
        .count()
    
    if recent_questions >= 3:
        raise HTTPException(
            status_code=429, 
            detail="Rate limit exceeded. You can only ask 3 questions per minute."
        )

    # 2. Fetch past memory (last 10 questions) for this specific subject
    past_messages = db.query(models.ChatMessage)\
        .filter(models.ChatMessage.user_id == current_user.id)\
        .filter(models.ChatMessage.subject == req.subject)\
        .order_by(models.ChatMessage.timestamp.desc())\
        .limit(20).all()
    
    past_messages.reverse() # chronological order
    
    # 3. Format memory context
    system_prompt = get_system_prompt(req.level, req.subject or "General")
    
    # We will embed past memory into the system prompt or simply prepend it
    memory_context = ""
    if past_messages:
        memory_context = "\n\nPrevious Conversation History:\n"
        for msg in past_messages:
            memory_context += f"{msg.role.capitalize()}: {msg.content}\n"
        
        system_prompt += memory_context + "\nNow respond to the latest user message."

    # Stats tracking
    track("questions:total")
    subject_key = SUBJECT_KEYS.get((req.subject or "general").lower(), "other")
    track(f"questions:{subject_key}")
    level_lower = req.level.lower()
    if level_lower in YOUNG_LEVELS:
        track("tier:school")
    elif level_lower in ADVANCED_LEVELS:
        track("tier:phd")
    elif "high" in level_lower:
        track("tier:highschool")
    else:
        track("tier:university")

    # Save user message to DB (save the original short text so UI looks clean)
    user_msg = models.ChatMessage(user_id=current_user.id, role="user", content=req.question, subject=req.subject)
    db.add(user_msg)
    db.commit()

    # Enhance short or ambiguous queries to reduce hallucination
    enhanced_query = req.question
    if len(req.question.split()) < 10:
        enhanced_query = (
            f"{req.question}\n\n"
            f"[System Directive: The user provided a very short or vague prompt. "
            f"Please interpret this strictly within the context of {req.subject}. "
            f"Provide a highly precise, factual, and structured explanation. "
            f"If the query is ambiguous, focus on the most fundamental concept related to it. "
            f"Do not hallucinate, guess, or invent unverified facts.]"
        )

    # Call AI using the enhanced query
    answer, model_used = await run_inference(enhanced_query, system_prompt, req.image_base64, subject=req.subject)

    # Save AI response to DB
    ai_msg = models.ChatMessage(user_id=current_user.id, role="assistant", content=answer, subject=req.subject)
    db.add(ai_msg)
    db.commit()

    # Gamification: award XP, update streak, check badges (only for young levels)
    level_lower = req.level.lower()
    xp_earned, new_badges = 0, []
    if level_lower in YOUNG_LEVELS:
        total_questions = db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == current_user.id,
            models.ChatMessage.role == 'user'
        ).count()
        subjects_used = [m.subject for m in db.query(models.ChatMessage.subject).filter(
            models.ChatMessage.user_id == current_user.id,
            models.ChatMessage.role == 'user'
        ).distinct().all()]
        xp_earned, new_badges = award_gamification(current_user, db, total_questions, subjects_used)

    return QueryResponse(
        status="completed",
        answer=answer,
        xp_earned=xp_earned,
        new_xp=current_user.xp,
        new_level=current_user.level,
        streak_count=current_user.streak_count,
        new_badges=new_badges,
        model_used=model_used
    )

@app.get("/api/stats")
def get_stats():
    return {
        "visits": get_counter("visits"),
        "questions": {
            "total": get_counter("questions:total"),
            "math": get_counter("questions:math"),
            "science": get_counter("questions:science"),
            "english": get_counter("questions:english"),
            "gk": get_counter("questions:gk"),
            "finance": get_counter("questions:finance"),
            "coding": get_counter("questions:coding"),
            "agriculture": get_counter("questions:agri"),
            "law": get_counter("questions:law"),
            "homework": get_counter("questions:homework"),
        },
        "tiers": {
            "school": get_counter("tier:school"),
            "highschool": get_counter("tier:highschool"),
            "university": get_counter("tier:university"),
            "phd": get_counter("tier:phd"),
        }
    }

@app.get("/api/profile")
def get_profile(current_user: models.User = Depends(get_current_user)):
    earned_badges = [b for b in current_user.badges.split(",") if b]
    badge_details = [d for d in BADGE_DEFINITIONS if d["id"] in earned_badges]
    return {
        "email": current_user.email,
        "xp": current_user.xp or 0,
        "level": current_user.level or 1,
        "level_name": LEVEL_NAMES[min(current_user.level or 1, len(LEVEL_NAMES)-1)],
        "streak_count": current_user.streak_count or 0,
        "badges": badge_details,
        "xp_for_next_level": LEVEL_THRESHOLDS[min((current_user.level or 1), len(LEVEL_THRESHOLDS)-1)],
    }

@app.get("/api/admin/stats")
def get_admin_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = db.query(models.User).all()
    user_stats = []
    for u in users:
        question_count = db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == u.id, 
            models.ChatMessage.role == 'user'
        ).count()
        user_stats.append({
            "id": u.id,
            "email": u.email,
            "questions_asked": question_count,
            "is_admin": u.is_admin,
            "level": LEVEL_NAMES[min(u.level or 1, len(LEVEL_NAMES)-1)],
            "streak": u.streak_count or 0,
        })
    return {"users": user_stats}

# ── Quiz Endpoints ─────────────────────────────────────────────────────────────

import json, re as _re

class QuizGenerateRequest(BaseModel):
    subject: str
    topic: str
    quiz_type: str   # 'mcq', 'true_false', 'fill_blank', 'mixed'
    count: int = 5   # number of questions
    difficulty: str = "medium"  # 'easy', 'medium', 'hard'
    level: str = "High School"

class QuizSubmitRequest(BaseModel):
    subject: str
    topic: str
    quiz_type: str
    difficulty: str
    questions: list  # list of question objects from generate
    answers: list    # user's answers indexed by question id

@app.post("/api/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest, current_user: models.User = Depends(get_current_user)):
    type_map = {
        "mcq":        "multiple choice (4 options labelled A, B, C, D)",
        "true_false": "True/False (boolean)",
        "fill_blank": "fill in the blank (short one-word or one-phrase answer)",
        "mixed":      "a mix of multiple choice (4 options), True/False, and fill in the blank",
    }
    q_type_desc = type_map.get(req.quiz_type, "multiple choice")

    prompt = f"""You are an expert educator generating a quiz.

Create exactly {req.count} {q_type_desc} questions about "{req.topic}" in the subject "{req.subject}".
The student level is: {req.level}. Difficulty: {req.difficulty}.

Return ONLY valid JSON with no extra text, no markdown, no code fences. Use this exact structure:
{{
  "questions": [
    {{
      "id": 1,
      "type": "mcq",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of the correct answer."
    }},
    {{
      "id": 2,
      "type": "true_false",
      "question": "Statement to evaluate.",
      "correct": true,
      "explanation": "Brief explanation."
    }},
    {{
      "id": 3,
      "type": "fill_blank",
      "question": "The ___ is the powerhouse of the cell.",
      "correct": "mitochondria",
      "explanation": "Brief explanation."
    }}
  ]
}}

For mcq: correct is the 0-based index of the correct option.
For true_false: correct is true or false.
For fill_blank: correct is the expected answer string (case-insensitive match will be used).
Generate all {req.count} questions now."""

    raw, _ = await run_inference(prompt, "You are an expert quiz generator. Return only valid JSON.", None, subject=req.subject)

    # Find the first '{' and last '}' to extract just the JSON object
    start_idx = raw.find('{')
    end_idx = raw.rfind('}')
    if start_idx != -1 and end_idx != -1:
        cleaned = raw[start_idx:end_idx+1]
    else:
        cleaned = raw
        
    try:
        data = json.loads(cleaned)
        return {"questions": data["questions"]}
    except Exception:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {raw[:300]}")


@app.post("/api/quiz/submit")
def submit_quiz(req: QuizSubmitRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    questions = req.questions
    answers   = req.answers   # list: each element is the user's answer for that question index

    score = 0
    for i, q in enumerate(questions):
        if i >= len(answers):
            continue
        user_ans = answers[i]
        correct  = q.get("correct")

        if q.get("type") == "fill_blank":
            if str(user_ans).strip().lower() == str(correct).strip().lower():
                score += 1
        elif q.get("type") == "true_false":
            if str(user_ans).lower() == str(correct).lower():
                score += 1
        else:  # mcq
            if str(user_ans) == str(correct):
                score += 1

    total = len(questions)
    pct   = (score / total * 100) if total > 0 else 0

    # XP calculation
    xp_earned = score * 5
    if pct >= 80:
        xp_earned += 20
    if pct == 100:
        xp_earned += 50

    # Update user XP & badges
    new_badges = []
    current_user.xp = (current_user.xp or 0) + xp_earned
    current_user.level = calc_level(current_user.xp)

    earned = set(b for b in (current_user.badges or "").split(",") if b)

    # test_taker badge
    quiz_count = db.query(models.QuizResult).filter(models.QuizResult.user_id == current_user.id).count()
    if quiz_count == 0 and "test_taker" not in earned:
        earned.add("test_taker")
        new_badges.append("test_taker")

    # quiz_master badge
    if pct == 100 and "quiz_master" not in earned:
        earned.add("quiz_master")
        new_badges.append("quiz_master")

    current_user.badges = ",".join(earned)

    # Save result
    result = models.QuizResult(
        user_id=current_user.id,
        subject=req.subject,
        topic=req.topic,
        quiz_type=req.quiz_type,
        difficulty=req.difficulty,
        score=score,
        total=total,
        xp_earned=xp_earned,
    )
    db.add(result)
    db.commit()

    return {
        "score": score,
        "total": total,
        "percentage": round(pct, 1),
        "xp_earned": xp_earned,
        "new_xp": current_user.xp,
        "new_level": current_user.level,
        "new_badges": new_badges,
    }


@app.get("/api/quiz/history")
def get_quiz_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    results = db.query(models.QuizResult)\
        .filter(models.QuizResult.user_id == current_user.id)\
        .order_by(models.QuizResult.timestamp.desc())\
        .limit(20).all()
    return [
        {
            "subject": r.subject,
            "topic": r.topic,
            "score": r.score,
            "total": r.total,
            "percentage": round(r.score / r.total * 100, 1) if r.total else 0,
            "xp_earned": r.xp_earned,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in results
    ]

# ── Flashcards ───────────────────────────────────────────────────────────────

@app.post("/api/flashcards/generate")
async def generate_flashcards(req: FlashcardCreateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    system_prompt = "You are an expert tutor creating study materials. Return exactly 5 flashcards based on the provided topic and chat history. Output pure JSON format: a list of objects with 'front' (question/concept) and 'back' (answer/explanation). Example: [{\"front\": \"What is X?\", \"back\": \"X is Y\"}]. Return ONLY JSON, no markdown blocks."
    user_prompt = f"Topic: {req.topic}\n\nContext/Chat History:\n{req.history_context}"

    try:
        content, _ = await run_inference(user_prompt, system_prompt, None, subject=req.subject)
        # Find the first '[' and last ']' to extract just the JSON array
        start_idx = content.find('[')
        end_idx = content.rfind(']')
        if start_idx != -1 and end_idx != -1:
            content = content[start_idx:end_idx+1]
        
        cards_data = json.loads(content)
        
        deck = models.FlashcardDeck(user_id=current_user.id, subject=req.subject, topic=req.topic)
        db.add(deck)
        db.flush() 
        
        for c in cards_data:
            fc = models.Flashcard(deck_id=deck.id, front=c.get('front',''), back=c.get('back',''))
            db.add(fc)
            
        db.commit()
        db.refresh(deck)
        return {"status": "success", "deck_id": deck.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate flashcards: " + str(e))

@app.get("/api/flashcards", response_model=List[FlashcardDeckResponse])
def get_flashcards(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    decks = db.query(models.FlashcardDeck).filter(models.FlashcardDeck.user_id == current_user.id).order_by(models.FlashcardDeck.timestamp.desc()).all()
    res = []
    for d in decks:
        cards = [{"id": c.id, "front": c.front, "back": c.back} for c in d.cards]
        res.append({
            "id": d.id, "subject": d.subject, "topic": d.topic, "timestamp": d.timestamp, "cards": cards
        })
    return res

@app.delete("/api/flashcards/{deck_id}")
def delete_deck(deck_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    deck = db.query(models.FlashcardDeck).filter(models.FlashcardDeck.id == deck_id, models.FlashcardDeck.user_id == current_user.id).first()
    if deck:
        db.delete(deck)
        db.commit()
    return {"status": "ok"}
