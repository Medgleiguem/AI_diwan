FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Uncomment to include qawafi:
# RUN pip install --no-cache-dir git+https://github.com/ARBML/qawafi.git
COPY . .
EXPOSE 5000
# Use shell form so runtime $PORT (set by Render) is respected. Default to 5000 when PORT is unset.
CMD gunicorn app:app --workers 2 --bind 0.0.0.0:${PORT:-5000} --timeout 120 --log-level info
