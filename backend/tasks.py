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

async def run_inference(prompt: str, system_prompt: str, image_base64: str = None) -> str:
    try:
        if image_base64:
            # When an image is provided, switch to a Vision-capable model
            # GitHub Models supports gpt-4o
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
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7,
                max_tokens=4096
            )
        else:
            # Use Llama-3.3-70B-Instruct for text-only queries
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            response = await client.chat.completions.create(
                model="Llama-3.3-70B-Instruct",
                messages=messages,
                temperature=0.7,
                max_tokens=4096
            )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"Error during inference: {str(e)}"
