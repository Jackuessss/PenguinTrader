import os
import psycopg2
from flask import Flask, jsonify, render_template, request, redirect, url_for, flash, make_response, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_cors import CORS, cross_origin
import uuid
import random
import requests
from dotenv import load_dotenv
from datetime import datetime, timedelta
from supabase import create_client, Client
from psycopg2.extras import RealDictCursor
import time
import json

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
# Enable CORS for all routes (or restrict as needed)
CORS(app)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "Jacques")

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, user_id, email, first_name, last_name):
        self.id = user_id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name

@login_manager.user_loader
def load_user(user_id):
    conn = get_supabase_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return User(user[0], user[1], user[2], user[3])
    return None

# Get Alpha Vantage API key from environment variable
ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY', 'demo')

# Get Finnhub API key from environment variable
FINNHUB_API_KEY = 'cvia941r01qks9q9977gcvia941r01qks9q99780'

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_DB_URL = os.getenv('SUPABASE_DB_URL')

# Initialize Supabase client only if credentials are available
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        supabase = None


def fetch_finnhub_quote(symbol):
    try:
        # Check cache first
        cached_data = get_cached_quote(symbol)
        if cached_data:
            return cached_data

        # Add delay to respect rate limits
        time.sleep(RATE_LIMIT_DELAY)

        # Get current quote from Finnhub
        quote_url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_API_KEY}"
        quote_response = requests.get(quote_url)
        
        if quote_response.status_code == 429:
            print(f"Rate limit hit for {symbol}, waiting before retry...")
            time.sleep(2)  # Wait longer on rate limit
            quote_response = requests.get(quote_url)
            
        quote_response.raise_for_status()
        quote_data = quote_response.json()
        
        if quote_data and quote_data.get('c'):  # If we have current price
            # Cache the successful response
            set_cached_quote(symbol, quote_data)
            return quote_data
            
        return None
    except Exception as e:
        print(f"Error fetching quote for {symbol}: {str(e)}")
        return None

# Connect to Supabase PostgreSQL
def get_supabase_connection():
    return psycopg2.connect(SUPABASE_DB_URL)

def init_supabase_db():
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
                        user_id TEXT PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)''')
    
    # Create watchlist table
    cursor.execute('''CREATE TABLE IF NOT EXISTS watchlist (
                        watchlist_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        watchlist_name TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(user_id))''')
    
    # Create watchlist_items table
    cursor.execute('''CREATE TABLE IF NOT EXISTS watchlist_items (
                        watchlist_id TEXT NOT NULL,
                        stock_symbol TEXT NOT NULL,
                        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (watchlist_id, stock_symbol),
                        FOREIGN KEY (watchlist_id) REFERENCES watchlist(watchlist_id))''')



# Initialize the database
init_supabase_db()

# SparkPost configuration
SPARKPOST_API_KEY = os.getenv("SPARKPOST_API_KEY")
SPARKPOST_FROM_EMAIL = os.getenv("SPARKPOST_FROM_EMAIL")

def signup_user(email, password, first_name, last_name, terms):
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    
    if user:
        return 'Email is already in use!'
    
    # Generate unique user_id
    user_id = str(uuid.uuid4())
    
    # Salt the password with the user_id for extra security
    salted_password = password + user_id
    hashed_password = generate_password_hash(salted_password)
    
    # Get the current timestamp with timezone
    current_timestamp = datetime.utcnow()

    cursor.execute("""
        INSERT INTO users (user_id, email, first_name, last_name, password_hash, terms, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (user_id, email, first_name, last_name, hashed_password, terms, current_timestamp))
    
    # Create My Watchlist for the new user
    watchlist_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO watchlist (watchlist_id, user_id, watchlist_name, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s)
    """, (watchlist_id, user_id, "My Watchlist", current_timestamp, current_timestamp))
    
    conn.commit()
    conn.close()
    
    return 'Signup successful! Please log in.'

def authenticate_user(email, password):
    # Checks if account exists
    conn = get_supabase_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    conn.close()
    # Checks against database
    if user:
        salted_password = password + user[0]
        if check_password_hash(user[4], salted_password):
            return user
    return None

# Routes
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        first_name = request.form['first_name']
        last_name = request.form['last_name']
        terms = request.form.get('terms')

        if terms is None:
            flash('You must agree to the terms and conditions!', 'error')
            return render_template('signup.html')

        terms = True  

        message = signup_user(email, password, first_name, last_name, terms)
        flash(message)

        if 'Signup successful!' in message:
            # Create a browser session for the new user
            user_data = authenticate_user(email, password)
            if user_data:
                user = User(user_data[0], user_data[1], user_data[2], user_data[3])
                login_user(user)
                session.permanent = False  # Session lasts until browser closes
                session['user_id'] = user_data[0]
                session['email'] = email
                flash('Account created and logged in successfully!', 'success')
                return redirect(url_for('dashboard'))
            else:
                flash('Account created but login failed. Please log in manually.', 'warning')
                return redirect(url_for('login'))
                
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    # Check if the user is already logged in
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    # Gets input from form
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        # Checks wether the form is filled or not
        if not email or not password:
            flash("Email and password are required", "error")
            return redirect(url_for('login'))
        # Validates if user exists or not
        user_data = authenticate_user(email, password)
        if user_data:
            user = User(user_data[0], user_data[1], user_data[2], user_data[3])
            login_user(user)
            # Checks if remember me is checked and if it is it creates a session
            remember = 'remember' in request.form
            if remember:
                session.permanent = True
                app.permanent_session_lifetime = timedelta(days=30)
            # Redirects to dashboard after successful login
            flash('Login successful!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid login credentials', 'error')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'success')
    return redirect(url_for('login'))

@app.route('/resetpassword', methods=['GET', 'POST'])
def resetpassword():
    if request.method == 'POST':
        reset_code = request.form['reset_code']
        new_password = request.form['new_password']
        confirm_password = request.form['confirm_password']

        if new_password != confirm_password:
            flash('Passwords do not match!', 'error')
            return redirect(url_for('resetpassword'))

        conn = get_supabase_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE reset_code = %s", (reset_code,))
        user = cursor.fetchone()

        if user:
            salted_password = new_password + user[0]
            hashed_password = generate_password_hash(salted_password)

            cursor.execute("UPDATE users SET password_hash = %s, reset_code = NULL WHERE id = %s", (hashed_password, user[0]))
            conn.commit()
            conn.close()

            flash('Password reset successful! Please log in.', 'success')
            return redirect(url_for('login'))
        else:
            flash('Invalid reset code.', 'error')

    return render_template('resetpassword.html')

@app.route('/forgotpasswordemail', methods=['GET', 'POST'])
def forgotpasswordemail():
    if request.method == 'POST':
        email = request.form['email']

        conn = get_supabase_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user:
            reset_code = generate_reset_code()
            cursor.execute("UPDATE users SET reset_code = %s WHERE email = %s", (reset_code, email))
            conn.commit()
            conn.close()

            if send_reset_email(email, reset_code):
                flash('Reset code sent to your email!', 'success')
                return redirect(url_for('resetpassword'))
            else:
                flash('Failed to send email. Please try again later.', 'error')
        else:
            flash('Email not found!', 'error')

    return render_template('forgotpasswordemail.html')

@app.route('/dashboard')
@login_required
def dashboard():
    list_type = request.args.get('list', 'my-watchlist')
    return render_template('dashboard.html', user_id=current_user.id, list_type=list_type)

@app.route('/homepage')
def homepage():
    return render_template('homepage.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/api/stocks')
@cross_origin()
def get_stocks():
    try:
        # Construct the absolute path to stocks.json
        json_path = os.path.join(app.root_path, 'stocks.json')
        
        # Open and read the JSON file
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        return jsonify(data)
    except Exception as e:
        print(f"Error loading stocks.json: {e}")
        return jsonify({"error": "Failed to load stock data"}), 500
