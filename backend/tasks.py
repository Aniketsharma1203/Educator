import os
import asyncio
from celery import Celery
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize Celery
celery_app = Celery(
    "tasks",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/0")
)

# Initialize OpenAI Async Client with GitHub Models API
github_token = os.environ.get("GITHUB_TOKEN")

client = AsyncOpenAI(
    api_key=github_token or "dummy-key-to-prevent-crash",
    base_url="https://models.inference.ai.azure.com"
)

async def run_inference(prompt: str, system_prompt: str) -> str:
    try:
        response = await client.chat.completions.create(
            model="DeepSeek-R1-0528",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4096
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error during inference: {str(e)}"

@celery_app.task(name="tasks.process_advanced_query")
def process_advanced_query(prompt: str, system_prompt: str):
    # Celery tasks are synchronous by default, so we run the async inference inside an event loop
    return asyncio.run(run_inference(prompt, system_prompt))
