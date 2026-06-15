import os
import asyncio
import redis as redis_client
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from tasks import process_advanced_query, run_inference
from celery.result import AsyncResult
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="OmniTutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection for stats tracking
REDIS_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")
try:
    r = redis_client.from_url(REDIS_URL, decode_responses=True)
except Exception:
    r = None

def track(key: str, amount: int = 1):
    """Safely increment a Redis counter."""
    try:
        if r:
            r.incr(key, amount)
    except Exception:
        pass

def get_counter(key: str) -> int:
    try:
        if r:
            val = r.get(key)
            return int(val) if val else 0
    except Exception:
        pass
    return 0

class QueryRequest(BaseModel):
    question: str
    level: str
    subject: Optional[str] = "General"

class QueryResponse(BaseModel):
    status: str
    task_id: str = None
    answer: str = None

SUBJECT_KEYS = {
    "mathematics": "math",
    "science": "science",
    "english": "english",
    "general knowledge": "gk",
}

YOUNG_LEVELS = [
    "kindergarten", "elementary school",
    "primary (class 1-5)", "middle school (class 6-10)"
]

ADVANCED_LEVELS = ["graduate", "phd"]

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
        }
    }

    subject_data = subject_contexts.get(subject_lower, {
        "young": "You are a friendly, encouraging teacher. Provide simple, engaging, step-by-step answers without advanced notation.",
        "advanced": "You are a rigorous academic professor. Utilize rigorous logic and output structured chain-of-thought reasoning before delivering the final answer."
    })

    base_prompt = subject_data["young"] if is_young else subject_data["advanced"]
    return f"{base_prompt} The student is at the {level} level. This question is in the domain of {subject}."

@app.get("/")
def root():
    track("stats:visits")
    return {"status": "ok", "message": "OmniTutor API"}

@app.post("/api/query", response_model=QueryResponse)
async def submit_query(req: QueryRequest):
    system_prompt = get_system_prompt(req.level, req.subject or "General")

    # Track question stats
    track("stats:questions:total")
    subject_key = SUBJECT_KEYS.get((req.subject or "general").lower(), "other")
    track(f"stats:questions:{subject_key}")
    level_lower = req.level.lower()
    if level_lower in YOUNG_LEVELS:
        track("stats:tier:school")
    elif level_lower in ["high school"]:
        track("stats:tier:highschool")
    elif level_lower in ADVANCED_LEVELS:
        track("stats:tier:phd")
    else:
        track("stats:tier:university")

    if req.level.lower() in YOUNG_LEVELS:
        answer = await run_inference(req.question, system_prompt)
        return QueryResponse(status="completed", answer=answer)
    else:
        task = process_advanced_query.delay(req.question, system_prompt)
        return QueryResponse(status="processing", task_id=task.id)

@app.get("/api/status/{task_id}", response_model=QueryResponse)
def get_task_status(task_id: str):
    task_result = AsyncResult(task_id)
    if task_result.ready():
        return QueryResponse(status="completed", answer=task_result.result, task_id=task_id)
    return QueryResponse(status="processing", task_id=task_id)

@app.get("/api/stats")
def get_stats():
    track("stats:visits")
    return {
        "visits": get_counter("stats:visits"),
        "questions": {
            "total": get_counter("stats:questions:total"),
            "math": get_counter("stats:questions:math"),
            "science": get_counter("stats:questions:science"),
            "english": get_counter("stats:questions:english"),
            "gk": get_counter("stats:questions:gk"),
        },
        "tiers": {
            "school": get_counter("stats:tier:school"),
            "highschool": get_counter("stats:tier:highschool"),
            "university": get_counter("stats:tier:university"),
            "phd": get_counter("stats:tier:phd"),
        }
    }
