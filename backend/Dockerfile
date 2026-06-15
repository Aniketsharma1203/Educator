FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Use Railway's dynamic PORT or fallback to 8000 for local dev
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
