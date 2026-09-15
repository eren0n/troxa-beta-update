bind = "127.0.0.1:8001"
# sync workers each block on the whole request, including the time spent
# streaming a creative image byte-for-byte through CreativeImageProxyView —
# with only 3 of them, a handful of gallery/home page loads (each firing one
# blob fetch per visible image) could tie up every worker on image bytes and
# stall unrelated API calls (auth, gallery listing, ...) behind them. gthread
# workers release the GIL while blocked on that upstream I/O, so one worker
# process serves several requests at once — 4 CPUs here, so 5 workers Ă— 4
# threads gives real headroom without over-committing memory (~80MB/worker):
# 5 workers x 4 threads = 20 requests in flight at once instead of 3.
workers = 5
worker_class = "gthread"
threads = 4
timeout = 300
keepalive = 5
accesslog = "/var/log/gunicorn/troxa-access.log"
errorlog = "/var/log/gunicorn/troxa-error.log"
loglevel = "info"
