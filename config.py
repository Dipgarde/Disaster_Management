# Database configuration will go here once we connect PostgreSQL
# Leaving this empty for now is fine — app.py doesn't need it yet
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DATABASE_URL = os.getenv("DATABASE_URL")