import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from tasks import run_inference
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

# In-memory stats tracking
STATS = {
    "visits": 0,
    "questions:total": 0,
    "questions:math": 0,
    "questions:science": 0,
    "questions:english": 0,
    "questions:gk": 0,
    "questions:other": 0,
    "tier:school": 0,
    "tier:highschool": 0,
    "tier:university": 0,
    "tier:phd": 0,
}

def track(key: str, amount: int = 1):
    """Safely increment in-memory counter."""
    if key in STATS:
        STATS[key] += amount

def get_counter(key: str) -> int:
    return STATS.get(key, 0)

class QueryRequest(BaseModel):
    question: str
    level: str
    subject: Optional[str] = "General"

class QueryResponse(BaseModel):
    status: str
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
    track("visits")
    return {"status": "ok", "message": "OmniTutor API"}

@app.post("/api/query", response_model=QueryResponse)
async def submit_query(req: QueryRequest):
    system_prompt = get_system_prompt(req.level, req.subject or "General")

    # Track question stats
    track("questions:total")
    subject_key = SUBJECT_KEYS.get((req.subject or "general").lower(), "other")
    track(f"questions:{subject_key}")
    level_lower = req.level.lower()
    if level_lower in YOUNG_LEVELS:
        track("tier:school")
    elif level_lower in ["high school"]:
        track("tier:highschool")
    elif level_lower in ADVANCED_LEVELS:
        track("tier:phd")
    else:
        track("tier:university")

    # All requests wait for run_inference using async/await
    answer = await run_inference(req.question, system_prompt)
    return QueryResponse(status="completed", answer=answer)

@app.get("/api/stats")
def get_stats():
    track("visits")
    return {
        "visits": get_counter("visits"),
        "questions": {
            "total": get_counter("questions:total"),
            "math": get_counter("questions:math"),
            "science": get_counter("questions:science"),
            "english": get_counter("questions:english"),
            "gk": get_counter("questions:gk"),
        },
        "tiers": {
            "school": get_counter("tier:school"),
            "highschool": get_counter("tier:highschool"),
            "university": get_counter("tier:university"),
            "phd": get_counter("tier:phd"),
        }
    }
