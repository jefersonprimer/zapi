# Stage 1: Builder stage to install dependencies and pre-download model
FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Install system dependencies required for building and running image processing libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libwebp-dev \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install opencv-python-headless FIRST so rembg doesn't pull the full opencv
# This avoids needing OpenGL libraries at runtime
COPY requirements.txt .
RUN pip install --no-cache-dir opencv-python-headless && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download the u2net model during build
RUN python -c "from rembg import new_session; new_session('u2net')"

# Stage 2: Final minimal runtime stage
FROM python:3.11-slim-bookworm AS runner

WORKDIR /app

# Install only runtime dependencies (no GL needed thanks to headless opencv)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy pre-downloaded u2net model from builder to default location (~/.u2net)
COPY --from=builder /root/.u2net /root/.u2net
ENV U2NET_HOME=/root/.u2net

# Copy application source code
COPY app.py .

# Expose microservice port
EXPOSE 5050

# Command to run FastAPI server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5050"]
