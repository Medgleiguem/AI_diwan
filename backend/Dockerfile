FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Uncomment to include qawafi:
# RUN pip install --no-cache-dir git+https://github.com/ARBML/qawafi.git
COPY . .
EXPOSE 5000
CMD ["gunicorn", "app:app", "--workers", "2", "--bind", "0.0.0.0:5000", "--timeout", "120", "--log-level", "info"]
