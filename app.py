import os
from flask import Flask, render_template, request, redirect, session
import psycopg2
from flask_bcrypt import Bcrypt
from functools import wraps
from authlib.integrations.flask_client import OAuth
from config import Config

app = Flask(__name__)
app.secret_key = "change-this-to-something-random-later"
bcrypt = Bcrypt(app)

oauth = OAuth(app)
google = oauth.register(
    name="google",
    client_id=Config.GOOGLE_CLIENT_ID,
    client_secret=Config.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

ZONES = {
    "Nashik Central": (19.9975, 73.7898),
    "Panchavati": (20.0059, 73.7910),
    "Gangapur Road": (20.0100, 73.7500),
    "College Road": (19.9930, 73.7650),
}

def classify_severity(disaster_type, severity_score):
    """Plain rule-based classification — no ML/DL, just thresholds."""
    if severity_score >= 5:
        label = "Critical"
    elif severity_score >= 3:
        label = "High"
    elif severity_score >= 2:
        label = "Medium"
    else:
        label = "Low"

    if disaster_type in ("Earthquake", "Fire") and severity_score >= 4:
        label = "Critical"

    return label

def get_db_connection():
    return psycopg2.connect(Config.DATABASE_URL)

def login_required(roles=None):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if "user_id" not in session:
                return redirect("/login")
            if roles and session.get("role") not in roles:
                return "Access denied: you don't have permission to view this page.", 403
            return f(*args, **kwargs)
        return wrapped
    return decorator

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            description TEXT NOT NULL,
            location TEXT,
            latitude REAL,
            longitude REAL,
            disaster_type TEXT,
            severity_score INTEGER,
            severity_label TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/report", methods=["GET", "POST"])
@login_required()
def report():
    conn = get_db_connection()
    cur = conn.cursor()

    if request.method == "POST":
        description = request.form["description"]
        location = request.form["location"]
        disaster_type = request.form["disaster_type"]
        severity_score = int(request.form["severity_score"])

        lat, lng = ZONES.get(location, (None, None))
        severity_label = classify_severity(disaster_type, severity_score)

        cur.execute("""
            INSERT INTO reports (description, location, latitude, longitude, disaster_type, severity_score, severity_label)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (description, location, lat, lng, disaster_type, severity_score, severity_label))
        conn.commit()

    cur.execute("""
        SELECT id, description, location, disaster_type, severity_label, status, created_at
        FROM reports ORDER BY created_at DESC
    """)
    reports = cur.fetchall()

    cur.close()
    conn.close()

    return render_template("index.html", reports=reports)

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user or not bcrypt.check_password_hash(user[3], password):
            return render_template("login.html", error="Invalid email or password.")

        session["user_id"] = user[0]
        session["user_name"] = user[1]
        session["user_email"] = user[2]
        session["role"] = user[4]

        return redirect("/admin" if user[4] == "admin" else "/dashboard")

    return render_template("login.html")

@app.route("/google-login")
def google_login():
    redirect_uri = "http://127.0.0.1:5000/google-login/callback"
    return google.authorize_redirect(redirect_uri)

@app.route("/google-login/callback")
def google_callback():
    token = google.authorize_access_token()
    user_info = token.get("userinfo")

    if not user_info:
        return redirect("/login")

    email = user_info["email"]
    name = user_info.get("name", email.split("@")[0])

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, email, role FROM users WHERE email = %s", (email,))
    user = cur.fetchone()

    if not user:
        random_password = bcrypt.generate_password_hash(os.urandom(16).hex()).decode("utf-8")
        cur.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, name, email, role",
            (name, email, random_password)
        )
        conn.commit()
        user = cur.fetchone()

    cur.close()
    conn.close()

    session["user_id"] = user[0]
    session["user_name"] = user[1]
    session["user_email"] = user[2]
    session["role"] = user[3]

    return redirect("/admin" if user[3] == "admin" else "/dashboard")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = request.form["password"]

        password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
                (name, email, password_hash)
            )
            conn.commit()
            cur.close()
            conn.close()
            return redirect("/login")
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            cur.close()
            conn.close()
            return render_template("register.html", error="Email already registered.")

    return render_template("register.html")

@app.route("/forgot-password")
def forgot_password():
    return render_template("forgot_password.html")

@app.route("/map")
@login_required()
def live_map():
    return render_template("map.html")

@app.route("/dashboard")
@login_required(roles=["user", "admin"])
def dashboard():
    return render_template("dashboard.html")

@app.route("/admin")
@login_required(roles=["admin"])
def admin():
    return render_template("admin.html")

@app.route("/simulation")
@login_required(roles=["admin"])
def simulation():
    return render_template("simulation.html")

if __name__ == "__main__":
    init_db()
    app.run(debug=True)