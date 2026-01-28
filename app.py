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
import base64
import urllib3

# Suppress InsecureRequestWarning
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

print("--------------------------------------------------")
print("PenguinTrader Backend Loaded - API Routes Registered")
print("--------------------------------------------------")

# load environment variables
load_dotenv()

# initialize flask app
app = Flask(__name__)
# enable cors
CORS(app)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "Jacques")

# load stocks data
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(BASE_DIR, 'stocks.json'), 'r') as f:
        STOCKS_DATA = json.load(f)
except Exception as e:
    print(f"Error loading stocks.json: {e}")
    STOCKS_DATA = []

# initialize flask-login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# user class for flask-login
class User(UserMixin):
    def __init__(self, user_id, email, first_name, last_name, alpaca_account_id=None):
        self.id = user_id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.alpaca_account_id = alpaca_account_id

@login_manager.user_loader
def load_user(user_id):
    conn = get_supabase_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        # Check if alpaca_account_id column exists in the row (it should be the last one if we added it)
        # Using a safer dict approach via RealDictCursor is better, but here we used tuple index.
        # Assuming schema: user_id, email, first_name, last_name, password_hash, terms, created_at, reset_code, alpaca_account_id
        # Let's check init_supabase_db to see the original index.
        # Original: user_id(0), email(1), first_name (missing in create table?), last_name (missing?).
        # Wait, the init_supabase_db logic in line 123 only has user_id, email, password_hash, created_at.
        # BUT the login logic uses user[2], user[3] for names.
        # This implies the DB schema in production/running is different from init_supabase_db function or I misread.
        # Let's depend on the query.
        # To be safe, we should probably switch to RealDictCursor or named attributes if possible, but let's stick to the current pattern.
        # We'll assume alpaca_account_id is fetched.
        # Since I can't know the exact index without `SELECT *`, I'll update the query to be explicit.
        
        # Explicit query is safer:
        # SELECT user_id, email, first_name, last_name, alpaca_account_id FROM users ...
        pass
    
    # Re-implementing load_user to be safer and include alpaca_id
    conn = get_supabase_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor) # Use RealDictCursor
    cursor.execute("SELECT user_id, email, first_name, last_name, alpaca_account_id FROM users WHERE user_id = %s", (user_id,))
    user_data = cursor.fetchone()
    conn.close()
    
    if user_data:
        return User(
            user_data['user_id'], 
            user_data['email'], 
            user_data['first_name'], 
            user_data['last_name'],
            user_data.get('alpaca_account_id')
        )
    return None

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_DB_URL = os.getenv('SUPABASE_DB_URL')

# alpaca broker configuration
ALPACA_BROKER_URL = os.getenv('ALPACA_BROKER_URL', 'https://broker-api.sandbox.alpaca.markets/v1')
ALPACA_BROKER_KEY = os.getenv('ALPACA_BROKER_KEY')
ALPACA_BROKER_SECRET = os.getenv('ALPACA_BROKER_SECRET')

def get_alpaca_headers():
    return {
        "Authorization": f"Basic {base64.b64encode(f'{ALPACA_BROKER_KEY}:{ALPACA_BROKER_SECRET}'.encode()).decode()}"
    }

# fund the new account with 50k
def fund_new_account(alpaca_id):
    try:
        # Wait a moment for the account to be fully active in Sandbox
        time.sleep(1)
        
        payload = {
            "entry_type": "JNLC",
            "from_account": "9896d9b1-fb81-335b-b527-9048f681465f",
            "to_account": alpaca_id,
            "amount": "50000",
            "description": "Initial Signup Balance"
        }
        
        response = requests.post(
            f"{ALPACA_BROKER_URL}/journals",
            json=payload,
            headers=get_alpaca_headers()
        )
        
        if response.status_code in [200, 201]:
            print(f"Account {alpaca_id} funded with $50,000")
            return True
        else:
            print(f"Funding Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"Funding Error: {e}")
        return False

@app.route('/api/account_info', methods=['GET'])
@login_required
def get_account_info():
    if not current_user.alpaca_account_id:
        return jsonify({'error': 'No trading account found'}), 400
        
    try:
        response = requests.get(
            f"{ALPACA_BROKER_URL}/trading/accounts/{current_user.alpaca_account_id}/account",
            headers=get_alpaca_headers()
        )
        
        if response.status_code == 200:
            data = response.json()
            # Extract relevant fields
            return jsonify({
                'cash': data.get('cash'),
                'buying_power': data.get('buying_power'),
                'equity': data.get('equity'),
                'currency': data.get('currency', 'USD')
            })
        else:
            return jsonify({'error': 'Failed to fetch account info', 'details': response.text}), response.status_code
            
    except Exception as e:
        print(f"Account Info Error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# initialize supabase client
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        supabase = None

# connect to supabase
def get_supabase_connection():
    return psycopg2.connect(SUPABASE_DB_URL)

def init_supabase_db():
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    # create users table
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
                        user_id TEXT PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)''')
    
    # create watchlist table
    cursor.execute('''CREATE TABLE IF NOT EXISTS watchlist (
                        watchlist_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        watchlist_name TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(user_id))''')
    
    # create watchlist items table
    cursor.execute('''CREATE TABLE IF NOT EXISTS watchlist_items (
                        watchlist_id TEXT NOT NULL,
                        stock_symbol TEXT NOT NULL,
                        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (watchlist_id, stock_symbol),
                        FOREIGN KEY (watchlist_id) REFERENCES watchlist(watchlist_id))''')



# initialize the database
init_supabase_db()


def signup_user(email, password, first_name, last_name, terms):
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    
    if user:
        conn.close()
        return 'Email is already in use!'

    alpaca_account_id = None
    try:
        # uses the user's real name/email, but fake identity data
        payload = {
            "contact": {
                "email_address": email,
                "phone_number": "555-555-5555",
                "street_address": ["123 Simulation Blvd"],
                "city": "New York",
                "state": "NY",
                "postal_code": "10001",
                "country": "USA"
            },
            "identity": {
                "given_name": first_name,
                "family_name": last_name,
                "date_of_birth": "1990-01-01",
                "tax_id": "400-50-1234",
                "tax_id_type": "USA_SSN",
                "country_of_citizenship": "USA",
                "country_of_birth": "USA",
                "country_of_tax_residence": "USA",
                "funding_source": ["employment_income"]
            },
            "disclosures": {
                "is_control_person": False,
                "is_affiliated_exchange_or_finra": False,
                "is_politically_exposed": False,
                "immediate_family_exposed": False
            },
            "agreements": [
                {
                    "agreement": "margin_agreement",
                    "signed_at": datetime.utcnow().isoformat() + "Z",
                    "ip_address": "127.0.0.1"
                },
                {
                    "agreement": "account_agreement",
                    "signed_at": datetime.utcnow().isoformat() + "Z",
                    "ip_address": "127.0.0.1"
                },
                {
                    "agreement": "customer_agreement",
                    "signed_at": datetime.utcnow().isoformat() + "Z",
                    "ip_address": "127.0.0.1"
                }
            ]
        }
        
        # Make the request to Alpaca
        response = requests.post(
            f"{ALPACA_BROKER_URL}/accounts",
            json=payload,
            headers=get_alpaca_headers()
        )
        
        if response.status_code in [200, 201]:
            alpaca_data = response.json()
            alpaca_account_id = alpaca_data.get('id')
            print(f"Alpaca Account Created: {alpaca_account_id}")
            
            # FUND THE ACCOUNT
            fund_new_account(alpaca_account_id)
            
        else:
            print(f"Alpaca Signup Failed: {response.text}")
            conn.close()
            return f'Trading Account Creation Failed: {response.text}'

    except Exception as e:
        print(f"Alpaca Error: {e}")
        conn.close()
        return 'Error creating trading account.'
    
    # generate unique user_id
    user_id = str(uuid.uuid4())
    
    # Salt the password with the user_id
    salted_password = password + user_id
    hashed_password = generate_password_hash(salted_password)
    
    # Get the current timestamp with timezone
    current_timestamp = datetime.utcnow()

    try:
        cursor.execute("""
            INSERT INTO users (user_id, email, first_name, last_name, password_hash, terms, created_at, alpaca_account_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, email, first_name, last_name, hashed_password, terms, current_timestamp, alpaca_account_id))
        
        # Create My Watchlist for the new user
        watchlist_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO watchlist (watchlist_id, user_id, watchlist_name, created_at, updated_at, position)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (watchlist_id, user_id, "My Watchlist", current_timestamp, current_timestamp, 0))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"DB Error: {e}")
        return 'Database Error during signup.'
    finally:
        conn.close()
    
    return 'Signup successful! Please log in.'

def authenticate_user(email, password):
    # Checks if account exists
    conn = get_supabase_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    conn.close()
    # checks against database
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
            user_data_row = authenticate_user(email, password)
            if user_data_row:
                user = load_user(user_data_row[0]) # Use load_user to get the User object
                login_user(user)
                session.permanent = False  # Session lasts until browser closes
                session['user_id'] = user.id
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
        user_data_row = authenticate_user(email, password)
        if user_data_row:
            user = load_user(user_data_row[0]) # Use load_user
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





@app.route('/dashboard')
@login_required
def dashboard():
    list_type = request.args.get('list', 'my-watchlist')
    logo_api_key = os.getenv("LOGO_API_KEY", "")
    return render_template('dashboard.html', user_id=current_user.id, list_type=list_type, logo_api_key=logo_api_key, stocks=STOCKS_DATA)

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
        # Construct path to stocks.json
        json_path = os.path.join(app.root_path, 'stocks.json')
        
        # Open and read the JSON file
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        return jsonify(data)
    except Exception as e:
        print(f"Error loading stocks.json: {e}")
        return jsonify({"error": "Failed to load stock data"}), 500

@app.route('/api/create_watchlist', methods=['POST'])
@login_required
def create_watchlist():
    data = request.get_json()
    user_id = current_user.id
    watchlist_name = data.get('watchlist_name')

    if not watchlist_name:
        return jsonify({'error': 'Watchlist name is required'}), 400

    conn = get_supabase_connection()
    cursor = conn.cursor()

    try:
        watchlist_id = str(uuid.uuid4())
        current_timestamp = datetime.utcnow()
        
        # Get next position
        cursor.execute("""
            SELECT COALESCE(MAX(position), -1) + 1 
            FROM watchlist 
            WHERE user_id = %s
        """, (user_id,))
        next_position = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO watchlist (watchlist_id, user_id, watchlist_name, created_at, updated_at, position)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (watchlist_id, user_id, watchlist_name, current_timestamp, current_timestamp, next_position))
        
        conn.commit()
        
        return jsonify({
            'success': True, 
            'watchlist_id': watchlist_id, 
            'watchlist_name': watchlist_name
        }), 201
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating watchlist: {e}")
        return jsonify({'error': 'Failed to create watchlist'}), 500
    finally:
        conn.close()

@app.route('/api/watchlists', methods=['GET'])
@login_required
def get_watchlists():
    user_id = current_user.id
    conn = get_supabase_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Fetch watchlists
        cursor.execute("""
            SELECT watchlist_id, watchlist_name, created_at 
            FROM watchlist 
            WHERE user_id = %s 
            ORDER BY position ASC, created_at ASC
        """, (user_id,))
        watchlists = cursor.fetchall()
        
        # For each watchlist, fetch items
        result = []
        for wl in watchlists:
            cursor.execute("""
                SELECT stock_symbol 
                FROM watchlist_items 
                WHERE watchlist_id = %s
                ORDER BY position ASC, added_at ASC
            """, (wl['watchlist_id'],))
            items = [row['stock_symbol'] for row in cursor.fetchall()]
            
            result.append({
                'id': wl['watchlist_id'],
                'name': wl['watchlist_name'],
                'created_at': wl['created_at'],
                'items': items
            })
            
        return jsonify({'success': True, 'watchlists': result})
    except Exception as e:
        print(f"Error fetching watchlists: {e}")
        return jsonify({'error': 'Failed to fetch watchlists'}), 500
    finally:
        conn.close()

@app.route('/api/watchlist/<watchlist_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_watchlist(watchlist_id):
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    try:
        if request.method == 'GET':
            cursor.execute("""
                SELECT w.watchlist_name, i.stock_symbol, i.position 
                FROM watchlist w
                LEFT JOIN watchlist_items i ON w.watchlist_id = i.watchlist_id
                WHERE w.watchlist_id = %s AND w.user_id = %s
                ORDER BY i.position
            """, (watchlist_id, current_user.id))
            
            rows = cursor.fetchall()
            if not rows:
                return jsonify({'error': 'Watchlist not found'}), 404
                
            watchlist_name = rows[0][0]
            items = []
            db_symbols = [r[1] for r in rows if r[1]]
            
            # Enrich with local JSON data
            enriched_items = []
            for sym in db_symbols:
                stock_info = next((s for s in STOCKS_DATA if s['symbol'] == sym), None)
                if stock_info:
                    enriched_items.append({
                        'symbol': sym,
                        'name': stock_info['name'],
                        'domain': stock_info['domain']
                    })
                else:
                    enriched_items.append({'symbol': sym}) # Fallback
            
            return jsonify({
                'id': watchlist_id,
                'watchlist_name': watchlist_name,
                'items': enriched_items
            })

        elif request.method == 'PUT':
            data = request.get_json()
            new_name = data.get('name')
            if not new_name:
                return jsonify({'error': 'Name is required'}), 400
                
            cursor.execute("UPDATE watchlist SET watchlist_name = %s WHERE watchlist_id = %s AND user_id = %s", (new_name, watchlist_id, current_user.id))
            conn.commit()
            return jsonify({'success': True})

        elif request.method == 'DELETE':
            cursor.execute("DELETE FROM watchlist_items WHERE watchlist_id = %s", (watchlist_id,))
            cursor.execute("DELETE FROM watchlist WHERE watchlist_id = %s AND user_id = %s", (watchlist_id, current_user.id))
            conn.commit()
            return jsonify({'success': True})

    except Exception as e:
        conn.rollback()
        print(f"Error managing watchlist {watchlist_id}: {e}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        conn.close()
        
@app.route('/api/watchlist/item/reorder', methods=['POST'])
@login_required
def reorder_watchlist_items():
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')
    ordered_items = data.get('ordered_items') # List of symbols in new order
    
    if not watchlist_id or not ordered_items or not isinstance(ordered_items, list):
        return jsonify({'error': 'Invalid data'}), 400

    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    try:
        # Verify ownership
        cursor.execute("SELECT user_id FROM watchlist WHERE watchlist_id = %s", (watchlist_id,))
        result = cursor.fetchone()
        if not result or result[0] != current_user.id:
             return jsonify({'error': 'Watchlist not found or unauthorized'}), 404
             
        # Update positions
        for index, symbol in enumerate(ordered_items):
            cursor.execute("""
                UPDATE watchlist_items 
                SET position = %s 
                WHERE watchlist_id = %s AND stock_symbol = %s
            """, (index, watchlist_id, symbol))
            
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        print(f"Error reordering items: {e}")
        return jsonify({'error': 'Failed to reorder items'}), 500
    finally:
        conn.close()

@app.route('/api/watchlist/reorder', methods=['POST'])
@login_required
def reorder_watchlists():
    data = request.get_json()
    ordered_ids = data.get('ordered_ids')  # List of watchlist_ids in new order
    
    if not ordered_ids or not isinstance(ordered_ids, list):
        return jsonify({'error': 'Invalid data format'}), 400

    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    try:
        # Update positions
        for index, watchlist_id in enumerate(ordered_ids):
            cursor.execute("""
                UPDATE watchlist 
                SET position = %s 
                WHERE watchlist_id = %s AND user_id = %s
            """, (index, watchlist_id, current_user.id))
            
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        print(f"Error reordering watchlists: {e}")
        return jsonify({'error': 'Failed to reorder watchlists'}), 500
    finally:
        conn.close()

@app.route('/api/watchlist/item', methods=['POST', 'DELETE'])
@login_required
def manage_watchlist_item():
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')
    symbol = data.get('symbol')
    
    if not watchlist_id or not symbol:
        return jsonify({'error': 'Watchlist ID and symbol are required'}), 400
        
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    try:
        # Verify ownership
        cursor.execute("SELECT user_id FROM watchlist WHERE watchlist_id = %s", (watchlist_id,))
        result = cursor.fetchone()
        if not result or result[0] != current_user.id:
             return jsonify({'error': 'Watchlist not found or unauthorized'}), 404

        if request.method == 'POST':
            # Check if item exists
            cursor.execute("""
                SELECT 1 FROM watchlist_items 
                WHERE watchlist_id = %s AND stock_symbol = %s
            """, (watchlist_id, symbol))
            
            if cursor.fetchone():
                return jsonify({'success': True, 'message': 'Item already in watchlist'})
            
            # Get next position
            cursor.execute("""
                SELECT COALESCE(MAX(position), -1) + 1 
                FROM watchlist_items 
                WHERE watchlist_id = %s
            """, (watchlist_id,))
            next_position = cursor.fetchone()[0]

            # Add item
            item_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO watchlist_items (watchlist_item_id, watchlist_id, stock_symbol, added_at, position)
                VALUES (%s, %s, %s, NOW(), %s)
            """, (item_id, watchlist_id, symbol, next_position))
            conn.commit()
            return jsonify({'success': True, 'message': 'Item added'})
            
        elif request.method == 'DELETE':
            # Remove item
            cursor.execute("""
                DELETE FROM watchlist_items 
                WHERE watchlist_id = %s AND stock_symbol = %s
            """, (watchlist_id, symbol))
            conn.commit()
            return jsonify({'success': True, 'message': 'Item removed'})
            
    except Exception as e:
        conn.rollback()
        print(f"Error managing watchlist item: {e}")
        return jsonify({'error': 'Database error'}), 500
    finally:
        conn.close()


# alpaca trading proxy routes

@app.route('/api/portfolio', methods=['GET'])
@login_required
def get_portfolio():
    if not current_user.alpaca_account_id:
        return jsonify({'error': 'No trading account found'}), 400
        
    try:
        response = requests.get(
            f"{ALPACA_BROKER_URL}/trading/accounts/{current_user.alpaca_account_id}/account",
            headers=get_alpaca_headers()
        )
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Failed to fetch portfolio', 'details': response.text}), response.status_code
    except Exception as e:
        print(f"Portfolio Error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/positions', methods=['GET'])
@login_required
def get_positions():
    if not current_user.alpaca_account_id:
        return jsonify({'error': 'No trading account found'}), 400
        
    try:
        response = requests.get(
            f"{ALPACA_BROKER_URL}/trading/accounts/{current_user.alpaca_account_id}/positions",
            headers=get_alpaca_headers()
        )
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Failed to fetch positions', 'details': response.text}), response.status_code
    except Exception as e:
        print(f"Positions Error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/order', methods=['POST'])
@login_required
def place_order():
    if not current_user.alpaca_account_id:
        return jsonify({'error': 'No trading account found'}), 400
        
    data = request.get_json()
    symbol = data.get('symbol')
    qty = data.get('qty')
    side = data.get('side') # buy or sell
    type = data.get('type', 'market')
    time_in_force = data.get('time_in_force', 'day')
    
    if not all([symbol, qty, side]):
        return jsonify({'error': 'Missing order parameters'}), 400
        
    try:
        payload = {
            "symbol": symbol,
            "qty": qty,
            "side": side,
            "type": type,
            "time_in_force": time_in_force
        }
        
        response = requests.post(
            f"{ALPACA_BROKER_URL}/trading/accounts/{current_user.alpaca_account_id}/orders",
            json=payload,
            headers=get_alpaca_headers()
        )
        
        if response.status_code in [200, 201]:
            return jsonify(response.json())
        else:
            # Pass the error from Alpaca back to frontend
            error_data = response.json() if response.content else {'message': response.text}
            return jsonify({'error': 'Order failed', 'details': error_data}), response.status_code
            
    except Exception as e:
        print(f"Order Error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/history', methods=['GET'])
@login_required
def get_history():
    symbol = request.args.get('symbol')
    timeframe = request.args.get('timeframe', '1h')
    
    # Proxy to the provided backend
    external_api_url = os.getenv('TAILSCALE_HISTORY_URL')
    
    if not external_api_url:
        return jsonify({'error': 'Tailscale URL not configured'}), 500
    
    try:
        # verify=False bypasses the Certificate Transparency check that browsers enforce
        response = requests.get(
            external_api_url, 
            params={'symbol': symbol, 'timeframe': timeframe},
            verify=False 
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Failed to fetch history', 'details': response.text}), response.status_code
            
    except Exception as e:
        print(f"History Proxy Error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(port=5001, debug=True)
