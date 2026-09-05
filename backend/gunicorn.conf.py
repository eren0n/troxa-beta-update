bind = "127.0.0.1:8001"
workers = 3
worker_class = "sync"
timeout = 300
keepalive = 5
accesslog = "/var/log/gunicorn/troxa-access.log"
errorlog = "/var/log/gunicorn/troxa-error.log"
loglevel = "info"
