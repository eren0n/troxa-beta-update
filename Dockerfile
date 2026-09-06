FROM python:3.12-slim

WORKDIR /app

# System deps: OpenCV, psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Override gunicorn config for container (log to stdout, bind to 0.0.0.0)
RUN printf 'bind = "0.0.0.0:8000"\nworkers = 3\nworker_class = "sync"\ntimeout = 300\nkeepalive = 5\naccesslog = "-"\nerrorlog = "-"\n' > /app/gunicorn.conf.py

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application"]
