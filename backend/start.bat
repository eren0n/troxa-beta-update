@echo off
cd /d %~dp0
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
