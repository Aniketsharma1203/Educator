import os
import re
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI Async Client with GitHub Models API
github_token = os.environ.get("GITHUB_TOKEN")

client = AsyncOpenAI(
    api_key=github_token or "dummy-key-to-prevent-crash",
    base_url="https://models.inference.ai.azure.com"
)

# ── Model Routing Config ───────────────────────────────────────────────────────
# Fast model: gpt-4o-mini — higher rate limits, great for simple factual questions
FAST_MODEL   = "gpt-4o-mini"
# Power model: Llama-3.3-70B — deep reasoning, complex problems, derivations
POWER_MODEL  = "Llama-3.3-70B-Instruct"
# Vision model: gpt-4o — for image-based questions
VISION_MODEL = "gpt-4o"
# Coding model: gpt-4o — best for programming and algorithms
CODING_MODEL = "gpt-4o"
# Agriculture model: Mistral-large-2407 — great general knowledge, diversifies API usage
AGRI_MODEL = "Mistral-large-2407"

# Keywords that signal a HARD question requiring deep reasoning
HARD_KEYWORDS = [
    "prove", "proof", "derive", "derivation", "differentiate", "integrate",
    "why does", "explain why", "analyze", "analyse", "compare and contrast",
    "evaluate", "critically", "advanced", "complex", "detailed explanation",
    "step by step", "how does", "mechanism", "theory behind", "justify",
    "demonstrate", "construct", "solve for", "find the", "calculate",
    "theorem", "hypothesis", "what is the relationship between",
    "difference between", "advantages and disadvantages",
]

# Keywords that signal an EASY question
EASY_KEYWORDS = [
    "what is", "who is", "when was", "where is", "define", "definition",
    "what are", "name the", "list", "who invented", "capital of",
    "spell", "abbreviation", "full form", "how many", "which",
    "true or false", "yes or no", "meaning of",
]

def classify_difficulty(question: str) -> str:
    """
    Classify a question as 'easy' or 'hard' using heuristics.
    Returns 'easy' or 'hard'.
    """
    q = question.lower().strip()

    # Very short questions are usually simple lookups
    word_count = len(q.split())
    if word_count <= 6:
        return "easy"

    # Check for hard keywords first (higher priority)
    for kw in HARD_KEYWORDS:
        if kw in q:
            return "hard"

    # Check for easy keywords
    for kw in EASY_KEYWORDS:
        if q.startswith(kw) or f" {kw}" in q:
            return "easy"

    # Medium-length questions (7-20 words) without hard keywords → easy
    # Long questions (>20 words) → hard (complex context)
    if word_count > 20:
        return "hard"

    return "easy"


async def run_inference(prompt: str, system_prompt: str, image_base64: str = None, subject: str = None) -> tuple[str, str]:
    """
    Run AI inference with intelligent model routing.
    
    Returns a tuple of (answer, model_used).
    
    Routing logic:
    - Image provided → gpt-4o (Vision)
    - Subject Coding → gpt-4o (Coding)
    - Subject Agriculture → Mistral-large-2407 (Agri)
    - Hard question   → Llama-3.3-70B-Instruct (Power)
    - Easy question   → gpt-4o-mini (Fast, higher rate limits)
    """
    try:
        if image_base64:
            # Vision route: always use gpt-4o for image inputs
            model = VISION_MODEL
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ]
        elif subject and subject.lower() == "coding":
            model = CODING_MODEL
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        elif subject and subject.lower() == "agriculture":
            model = AGRI_MODEL
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        else:
            # Text route: classify difficulty and pick appropriate model
            difficulty = classify_difficulty(prompt)
            model = FAST_MODEL if difficulty == "easy" else POWER_MODEL
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=4096
        )

        return response.choices[0].message.content, model

    except Exception as e:
        return f"Error during inference: {str(e)}", "unknown"
