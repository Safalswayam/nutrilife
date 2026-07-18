FROM python:3.11-slim

WORKDIR /app

# psycopg2-binary ships its own libpq; curl needed for the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:8000/ || exit 1

CMD ["uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8000"]
