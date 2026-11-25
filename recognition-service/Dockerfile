FROM python:3.10-slim

# Install system dependencies for OpenCV, Tesseract OCR, and multimedia
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    libzbar0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and models
COPY . .

# Ensure storage directories exist
RUN mkdir -p uploads/anpr_captures uploads/captured_plates

EXPOSE 8000

ENV NESTJS_API_URL=http://backend:4000/api/v1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
