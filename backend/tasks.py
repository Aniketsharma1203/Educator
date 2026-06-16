import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI Async Client with GitHub Models API
github_token = os.environ.get("GITHUB_TOKEN")

client = AsyncOpenAI(
    api_key=github_token or "dummy-key-to-prevent-crash",
    base_url="https://models.inference.ai.azure.com"
)

async def run_inference(prompt: str, system_prompt: str) -> str:
    try:
        response = await client.chat.completions.create(
            model="Meta-Llama-3.3-70B-Instruct",
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
