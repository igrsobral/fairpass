# AI Engine Dockerfile for FairPass
# Multi-stage build for optimal production image

# Stage 1: Dependencies
FROM python:3.12-slim AS deps
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install uv for fast dependency management
RUN pip install uv

# Install dependencies
RUN uv sync --frozen --no-dev

# Stage 2: Production
FROM python:3.12-slim AS runner
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed dependencies from deps stage
COPY --from=deps /app/.venv /app/.venv

# Copy source code
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"

# Railway sets PORT env var
ENV PORT=8000

# Start the application (use $PORT so Railway can override it)
CMD ["sh", "-c", "uvicorn fairpass.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
