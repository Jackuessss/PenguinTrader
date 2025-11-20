import os
import psycopg2
from flask import Flask, jsonify, render_template, request, redirect, url_for, flash, make_response, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
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
app.secret_key = os.getenv("FLASK_SECRET_KEY", "Jacques")

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Path to static JSON files
DEFAULT_LISTS_JSON = os.path.join('static', 'default_lists.json')
DEFAULT_LISTS_META_JSON = os.path.join('static', 'default_lists_meta.json')

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

# Cache for stock quotes
stock_quote_cache = {}
CACHE_DURATION = 60  # Cache duration in seconds
RATE_LIMIT_DELAY = 0.5  # Delay between API calls in seconds

# Cache for watchlist items
watchlist_cache = {}
WATCHLIST_CACHE_DURATION = 30  # Cache duration in seconds

def get_cached_quote(symbol):
    if symbol in stock_quote_cache:
        cached_data, timestamp = stock_quote_cache[symbol]
        if time.time() - timestamp < CACHE_DURATION:
            return cached_data
    return None

def set_cached_quote(symbol, data):
    stock_quote_cache[symbol] = (data, time.time())

def get_cached_watchlist(watchlist_id):
    if watchlist_id in watchlist_cache:
        cached_data, timestamp = watchlist_cache[watchlist_id]
        if time.time() - timestamp < WATCHLIST_CACHE_DURATION:
            return cached_data
    return None

def set_cached_watchlist(watchlist_id, data):
    watchlist_cache[watchlist_id] = (data, time.time())

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

@app.route('/index')
def trade():
    return render_template('index.html', api_key=ALPHA_VANTAGE_API_KEY)

@app.route('/api/stock/<symbol>')
def get_stock(symbol):
    try:
        url = f'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()
        
        if 'Error Message' in data:
            return jsonify({'error': data['Error Message']}), 400
            
        if 'Note' in data:  # API rate limit message
            return jsonify({'error': 'API rate limit reached. Please try again later.'}), 429
            
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/intraday/<symbol>')
def get_intraday(symbol):
    try:
        interval = request.args.get('interval', '5min')
        url = f'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval={interval}&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if 'Error Message' in data:
            return jsonify({'error': data['Error Message']}), 400
            
        if 'Note' in data:  # API rate limit message
            return jsonify({'error': 'API rate limit reached. Please try again later.'}), 429
            
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/daily/<symbol>')
def get_daily(symbol):
    try:
        url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if 'Error Message' in data:
            return jsonify({'error': data['Error Message']}), 400
            
        if 'Note' in data:  # API rate limit message
            return jsonify({'error': 'API rate limit reached. Please try again later.'}), 429
            
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def search_stocks():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'No search query provided'})
    
    try:
        conn = get_supabase_connection()
        cursor = conn.cursor()
        
        # Search in default_list_items table
        cursor.execute("""
            SELECT di.ticker, di.item_name, di.logo_url, di.default_list_id
            FROM default_list_items di
            WHERE LOWER(di.ticker) LIKE LOWER(%s) OR LOWER(di.item_name) LIKE LOWER(%s)
            ORDER BY 
                CASE 
                    WHEN LOWER(di.ticker) = LOWER(%s) THEN 1
                    WHEN LOWER(di.item_name) = LOWER(%s) THEN 2
                    WHEN LOWER(di.ticker) LIKE LOWER(%s) THEN 3
                    WHEN LOWER(di.item_name) LIKE LOWER(%s) THEN 4
                    ELSE 5
                END
            LIMIT 10
        """, (
            f"%{query}%", f"%{query}%",  # For LIKE matches
            query, query,  # For exact matches
            f"{query}%", f"{query}%"  # For starts with matches
        ))
        items = cursor.fetchall()
        
        results = []
        for item in items:
            # Get current quote for the stock
            quote_data = fetch_finnhub_quote(item[0])
            if quote_data:
                results.append({
                    'symbol': item[0],
                    'name': item[1],
                    'price': quote_data['c'],
                    'change': quote_data['d'],
                    'changePercent': quote_data['dp'],
                    'isPositive': quote_data['d'] >= 0,
                    'logoUrl': item[2]
                })
        
        conn.close()
        return jsonify({'result': results})
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'})

def get_db_connection():
    if not SUPABASE_DB_URL:
        raise Exception("SUPABASE_DB_URL environment variable is not set")
    return psycopg2.connect(SUPABASE_DB_URL)

@app.route('/get_balance/<user_id>')
def get_balance(user_id):
    try:
        if not SUPABASE_DB_URL:
            return jsonify({'error': 'Database connection not configured'}), 500
            
        conn = get_supabase_connection()
        cur = conn.cursor()
        
        # Query the users table for balance
        cur.execute('SELECT balance FROM users WHERE user_id = %s', (user_id,))
        result = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if result and result[0] is not None:
            return jsonify({'balance': float(result[0])})
        else:
            return jsonify({'balance': 0.00})
            
    except Exception as e:
        print(f"Error fetching balance: {e}")
        return jsonify({'balance': 0.00})

# Database configuration (Supabase PostgreSQL)
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")

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
    
    # Create default_lists table
    cursor.execute('''CREATE TABLE IF NOT EXISTS default_lists (
                        default_list_id TEXT PRIMARY KEY,
                        default_list_name TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)''')
    
    # Drop and recreate default_list_items table to ensure correct structure
    cursor.execute('DROP TABLE IF EXISTS default_list_items')
    
    # Create default_list_items table with updated structure
    cursor.execute('''CREATE TABLE IF NOT EXISTS default_list_items (
                        default_list_item_id TEXT PRIMARY KEY,
                        default_list_id TEXT NOT NULL,
                        ticker TEXT NOT NULL,
                        item_name TEXT NOT NULL,
                        logo_url TEXT NOT NULL,
                        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (default_list_id) REFERENCES default_lists(default_list_id))''')
    
    # Insert default lists if they don't exist
    default_lists = [
        ('default-stocks', 'Stocks'),
        ('default-forex', 'Forex'),
        ('default-global', 'Global Market')
    ]
    
    for list_id, list_name in default_lists:
        cursor.execute("""
            INSERT INTO default_lists (default_list_id, default_list_name)
            VALUES (%s, %s)
            ON CONFLICT (default_list_id) DO NOTHING
        """, (list_id, list_name))
    
    # Insert default items for each list with proper names and logos
    default_items = {
        'default-stocks': [
            ('TSLA', 'Tesla', 'https://logo.clearbit.com/tesla.com'),
            ('NVDA', 'NVIDIA', 'https://logo.clearbit.com/nvidia.com'),
            ('MIGO', 'MicroAlgo', 'https://logo.clearbit.com/microalgo.com'),
            ('PLTR', 'Palantir Technologies', 'https://logo.clearbit.com/palantir.com'),
            ('MSTR', 'MicroStrategy', 'https://logo.clearbit.com/microstrategy.com'),
            ('AAPL', 'Apple Inc.', 'https://logo.clearbit.com/apple.com'),
            ('MSFT', 'Microsoft Corporation', 'https://logo.clearbit.com/microsoft.com'),
            ('GOOGL', 'Alphabet Inc.', 'https://logo.clearbit.com/google.com'),
            ('AMZN', 'Amazon.com Inc.', 'https://logo.clearbit.com/amazon.com'),
            ('META', 'Meta Platforms Inc.', 'https://logo.clearbit.com/meta.com'),
            ('AMD', 'Advanced Micro Devices', 'https://logo.clearbit.com/amd.com'),
            ('INTC', 'Intel Corporation', 'https://logo.clearbit.com/intel.com'),
            ('TSM', 'Taiwan Semiconductor', 'https://logo.clearbit.com/tsmc.com'),
            ('ASML', 'ASML Holding', 'https://logo.clearbit.com/asml.com'),
            ('AVGO', 'Broadcom Inc.', 'https://logo.clearbit.com/broadcom.com'),
            ('TXN', 'Texas Instruments', 'https://logo.clearbit.com/ti.com'),
            ('QCOM', 'Qualcomm Inc.', 'https://logo.clearbit.com/qualcomm.com'),
            ('MU', 'Micron Technology', 'https://logo.clearbit.com/micron.com'),
            ('ADI', 'Analog Devices', 'https://logo.clearbit.com/analog.com'),
            ('CRM', 'Salesforce Inc.', 'https://logo.clearbit.com/salesforce.com')
        ],
        'default-forex': [
            ('EUR/USD', 'Euro/US Dollar', 'https://logo.clearbit.com/ecb.europa.eu'),
            ('GBP/USD', 'British Pound/US Dollar', 'https://logo.clearbit.com/bankofengland.co.uk'),
            ('USD/JPY', 'US Dollar/Japanese Yen', 'https://logo.clearbit.com/boj.or.jp'),
            ('USD/CAD', 'US Dollar/Canadian Dollar', 'https://logo.clearbit.com/bankofcanada.ca'),
            ('AUD/USD', 'Australian Dollar/US Dollar', 'https://logo.clearbit.com/rba.gov.au')
        ],
        'default-global': [
            ('^GSPC', 'S&P 500', 'https://logo.clearbit.com/spglobal.com'),
            ('^DJI', 'Dow Jones Industrial Average', 'https://logo.clearbit.com/spglobal.com'),
            ('^IXIC', 'NASDAQ Composite', 'https://logo.clearbit.com/nasdaq.com'),
            ('^FTSE', 'FTSE 100', 'https://logo.clearbit.com/lseg.com'),
            ('^N225', 'Nikkei 225', 'https://logo.clearbit.com/jpx.co.jp')
        ]
    }
    
    for list_id, items in default_items.items():
        for ticker, name, logo_url in items:
            cursor.execute("""
                INSERT INTO default_list_items (default_list_item_id, default_list_id, ticker, item_name, logo_url)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (default_list_item_id) DO NOTHING
            """, (f'{list_id}-{ticker}', list_id, ticker, name, logo_url))
    
    conn.commit()
    conn.close()

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

def generate_reset_code():
    return str(random.randint(100000, 999999))

def send_reset_email(email, reset_code):
    reset_link = "https://penguintrader.co.uk/resetpassword"
    
    url = "https://api.sparkpost.com/api/v1/transmissions"
    headers = {
        "Authorization": SPARKPOST_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "options": {"sandbox": False},
        "content": {
            "from": SPARKPOST_FROM_EMAIL,
            "subject": "Password Reset Code",
            "html": f"""
            <h1>Reset Your Password</h1>
            <p>Use the code below to reset your password:</p>
            <h2>{reset_code}</h2>
            <a href='{reset_link}'>Reset Password</a>
            """
        },
        "recipients": [{"address": {"email": email}}]
    }
    response = requests.post(url, json=payload, headers=headers)
    return response.status_code == 200

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

@app.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400

        # Query watchlist from Supabase
        response = supabase.table('watchlist').select('*').eq('user_id', user_id).execute()
        
        if response.error:
            return jsonify({'error': str(response.error)}), 500
            
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlist', methods=['POST'])
def add_to_watchlist():
    try:
        data = request.json
        user_id = data.get('user_id')
        symbol = data.get('symbol')
        
        if not user_id or not symbol:
            return jsonify({'error': 'User ID and symbol are required'}), 400

        # Check if stock is already in watchlist
        existing = supabase.table('watchlist').select('*').eq('user_id', user_id).eq('symbol', symbol).execute()
        
        if existing.data:
            return jsonify({'error': 'Stock already in watchlist'}), 400

        # Add to watchlist
        response = supabase.table('watchlist').insert({
            'user_id': user_id,
            'symbol': symbol,
            'created_at': datetime.now().isoformat()
        }).execute()
        
        if response.error:
            return jsonify({'error': str(response.error)}), 500
            
        return jsonify(response.data[0])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlist', methods=['DELETE'])
def remove_from_watchlist():
    try:
        data = request.json
        user_id = data.get('user_id')
        symbol = data.get('symbol')
        
        if not user_id or not symbol:
            return jsonify({'error': 'User ID and symbol are required'}), 400

        # Remove from watchlist
        response = supabase.table('watchlist').delete().eq('user_id', user_id).eq('symbol', symbol).execute()
        
        if response.error:
            return jsonify({'error': str(response.error)}), 500
            
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forex/<symbol>')
def get_forex_data(symbol):
    try:
        # Format the symbol for Alpha Vantage
        from_currency = symbol[:3]
        to_currency = symbol[3:]
        
        # Call Alpha Vantage API for forex data
        url = f'https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency={from_currency}&to_currency={to_currency}&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        data = response.json()
        
        if "Realtime Currency Exchange Rate" in data:
            rate_data = data["Realtime Currency Exchange Rate"]
            price = float(rate_data["5. Exchange Rate"])
            
            # Calculate a random change percentage for demo
            change = round(random.uniform(-1.5, 1.5), 2)
            
            return jsonify({
                'symbol': f'{from_currency}/{to_currency}',
                'name': f'{from_currency}/{to_currency}',
                'price': price,
                'change': change,
                'sell': price * 0.9995,  # Slightly lower for sell
                'buy': price * 1.0005    # Slightly higher for buy
            })
        else:
            return jsonify({'error': 'Unable to fetch forex data'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forex/history/<symbol>')
def get_forex_history(symbol):
    try:
        # Format the symbol for Alpha Vantage
        from_currency = symbol[:3]
        to_currency = symbol[3:]
        
        # Call Alpha Vantage API for intraday data
        url = f'https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol={from_currency}&to_symbol={to_currency}&interval=5min&apikey={ALPHA_VANTAGE_API_KEY}'
        response = requests.get(url)
        data = response.json()
        
        if "Time Series FX (5min)" in data:
            time_series = data["Time Series FX (5min)"]
            timestamps = []
            prices = []
            
            # Get the last 100 data points
            for timestamp, values in list(time_series.items())[:100]:
                timestamps.append(timestamp)
                prices.append(float(values["4. close"]))
            
            return jsonify({
                'timestamps': timestamps,
                'prices': prices
            })
        else:
            return jsonify({'error': 'Unable to fetch forex history'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/balance')
@login_required
def get_user_balance(user_id):
    try:
        # Ensure the user can only access their own balance
        if user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
            
        # Get user's balance from Supabase database
        conn = get_supabase_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT balance FROM users WHERE user_id = %s', (user_id,))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if result and result[0] is not None:
            return jsonify({'balance': float(result[0])})
        else:
            return jsonify({'balance': 0.00})
            
    except Exception as e:
        print(f"Error fetching balance: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlists/<user_id>')
@login_required
def get_user_watchlists(user_id):
    try:
        # Ensure the user can only access their own watchlists
        if user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        conn = get_supabase_connection()
        cursor = conn.cursor()
        
        # Get user's personal watchlists
        cursor.execute("""
            SELECT watchlist_id, watchlist_name, created_at, updated_at
            FROM watchlist 
            WHERE user_id = %s 
            ORDER BY created_at DESC
        """, (user_id,))
        user_watchlists = cursor.fetchall()
        
        conn.close()

        # Convert the results to a list of dictionaries
        watchlist_data = []
        
        # Add user's personal watchlists
        for watchlist in user_watchlists:
            watchlist_data.append({
                'watchlist_id': watchlist[0],
                'watchlist_name': watchlist[1],
                'created_at': watchlist[2].isoformat(),
                'updated_at': watchlist[3].isoformat(),
                'is_default': False
            })
            
        # Add default lists from static JSON file
        try:
            with open(DEFAULT_LISTS_META_JSON, 'r') as f:
                default_lists = json.load(f)
                watchlist_data.extend(default_lists)
        except Exception as e:
            print(f"Error loading default lists: {e}")
            # Fallback to hardcoded default lists
            default_lists = [
                {"watchlist_id": "default-stocks", "watchlist_name": "Stocks", "is_default": True},
                {"watchlist_id": "default-forex", "watchlist_name": "Forex", "is_default": True},
                {"watchlist_id": "default-global", "watchlist_name": "Global Market", "is_default": True}
            ]
            watchlist_data.extend(default_lists)

        return jsonify(watchlist_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlist/<watchlist_id>')
def get_watchlist_items(watchlist_id):
    try:
        # Check cache first
        cached_data = get_cached_watchlist(watchlist_id)
        if cached_data:
            return jsonify(cached_data)

        if watchlist_id.startswith('default-'):
            # Get items from static JSON file
            try:
                with open(DEFAULT_LISTS_JSON, 'r') as f:
                    default_lists = json.load(f)
                    if watchlist_id in default_lists:
                        list_data = default_lists[watchlist_id]
                        # Get current prices for each stock
                        watchlist_items = []
                        for item in list_data['items']:
                            quote_data = fetch_finnhub_quote(item['symbol'])
                            if quote_data:
                                watchlist_items.append({
                                    'symbol': item['symbol'],
                                    'name': item['name'],
                                    'price': quote_data['c'],
                                    'change': quote_data['d'],
                                    'changePercent': quote_data['dp'],
                                    'isPositive': quote_data['d'] >= 0,
                                    'logoUrl': item['logoUrl']
                                })
                        
                        response_data = {
                            'watchlist_name': list_data['watchlist_name'],
                            'items': watchlist_items
                        }
                        
                        # Cache the response
                        set_cached_watchlist(watchlist_id, response_data)
                        return jsonify(response_data)
                    else:
                        return jsonify({'error': 'Default list not found'}), 404
            except Exception as e:
                print(f"Error loading default list from JSON: {e}")
                # Fall back to database query if JSON fails
                conn = get_supabase_connection()
                cursor = conn.cursor()
                
                # Get items from default list
                cursor.execute("""
                    SELECT di.ticker, di.item_name, di.logo_url, di.default_list_id
                    FROM default_list_items di
                    WHERE di.default_list_id = %s
                    ORDER BY di.added_at
                """, (watchlist_id,))
                items = cursor.fetchall()
                
                # Get the default list name
                cursor.execute("""
                    SELECT default_list_name
                    FROM default_lists
                    WHERE default_list_id = %s
                """, (watchlist_id,))
                list_name = cursor.fetchone()[0]
                
                # Get current prices for each stock
                watchlist_items = []
                for item in items:
                    quote_data = fetch_finnhub_quote(item[0])
                    if quote_data:
                        watchlist_items.append({
                            'symbol': item[0],
                            'name': item[1],
                            'price': quote_data['c'],
                            'change': quote_data['d'],
                            'changePercent': quote_data['dp'],
                            'isPositive': quote_data['d'] >= 0,
                            'logoUrl': item[2]
                        })
                
                conn.close()
                
                response_data = {
                    'watchlist_name': list_name,
                    'items': watchlist_items
                }
                
                # Cache the response
                set_cached_watchlist(watchlist_id, response_data)
                return jsonify(response_data)
        else:
            # Verify the watchlist belongs to the current user
            conn = get_supabase_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT w.watchlist_id, w.watchlist_name 
                FROM watchlist w 
                WHERE w.watchlist_id = %s AND w.user_id = %s
            """, (watchlist_id, current_user.id))
            watchlist = cursor.fetchone()
            
            if not watchlist:
                return jsonify({'error': 'Watchlist not found or unauthorized'}), 404
                
            # Get all items in the personal watchlist
            cursor.execute("""
                SELECT stock_symbol 
                FROM watchlist_items 
                WHERE watchlist_id = %s
            """, (watchlist_id,))
            items = cursor.fetchall()
            watchlist_name = watchlist[1]
            
            # Get current prices for each stock
            watchlist_items = []
            for item in items:
                quote_data = fetch_finnhub_quote(item[0])
                if quote_data:
                    cursor.execute("""
                        SELECT item_name, logo_url
                        FROM default_list_items
                        WHERE ticker = %s
                        LIMIT 1
                    """, (item[0],))
                    company_info = cursor.fetchone()
                    
                    watchlist_items.append({
                        'symbol': item[0],
                        'name': company_info[0] if company_info else item[0],
                        'price': quote_data['c'],
                        'change': quote_data['d'],
                        'changePercent': quote_data['dp'],
                        'isPositive': quote_data['d'] >= 0,
                        'logoUrl': company_info[1] if company_info else f"https://logo.clearbit.com/{item[0].lower()}.com"
                    })
            
            conn.close()
            
            response_data = {
                'watchlist_name': watchlist_name,
                'items': watchlist_items
            }
            
            # Cache the response
            set_cached_watchlist(watchlist_id, response_data)
            return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/static/default-lists')
def get_static_default_lists():
    """Serve the static default lists metadata directly from the JSON file."""
    try:
        with open(DEFAULT_LISTS_META_JSON, 'r') as f:
            default_lists = json.load(f)
            return jsonify(default_lists)
    except Exception as e:
        return jsonify({
            'error': f'Error loading default lists: {str(e)}',
            'fallback_lists': [
                {"watchlist_id": "default-stocks", "watchlist_name": "Stocks", "is_default": True},
                {"watchlist_id": "default-forex", "watchlist_name": "Forex", "is_default": True},
                {"watchlist_id": "default-global", "watchlist_name": "Global Market", "is_default": True}
            ]
        }), 500

@app.route('/api/static/default-list/<watchlist_id>')
def get_static_default_list(watchlist_id):
    """Serve a specific static default list directly from the JSON file without live prices."""
    try:
        with open(DEFAULT_LISTS_JSON, 'r') as f:
            default_lists = json.load(f)
            if watchlist_id in default_lists:
                return jsonify(default_lists[watchlist_id])
            else:
                return jsonify({'error': 'Default list not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Error loading default list: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
