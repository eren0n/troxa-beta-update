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

# Override gunicorn config for container (log to stdout, bind to 0.0.0.0).
# gthread instead of sync: a sync worker blocks on the whole request,
# including the time CreativeImageProxyView spends streaming a creative
# image byte-for-byte from upstream — with only 3 of them, a few gallery/
# home page loads (one blob fetch per visible image) could tie up every
# worker on image bytes and stall unrelated API calls behind them. Matches
# the same fix applied to the systemd-run test deployment's gunicorn.conf.py.
RUN printf 'bind = "0.0.0.0:8000"\nworkers = 5\nworker_class = "gthread"\nthreads = 4\ntimeout = 300\nkeepalive = 5\naccesslog = "-"\nerrorlog = "-"\n' > /app/gunicorn.conf.py

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application"]
