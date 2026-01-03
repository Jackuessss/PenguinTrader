import requests
from requests.auth import HTTPBasicAuth

# --- CONFIGURATION ---
ALPACA_BROKER_KEY = "CKWZXV6O4C7P5ZPGKPZ72KYZQH"
ALPACA_BROKER_SECRET = "GeUEsQeEdVqbp1FRorhfVZJJgQ4fviGahFmhyVXGuek7"
FIRM_ACCOUNT_ID = "e2859088-5daa-37f3-bea3-9d338a388e31"
BASE_URL = "https://broker-api.sandbox.alpaca.markets/v1"

def seed_firm_balance():
    # In sandbox, POST /v1/accounts/{id}/transfers simulates an instant deposit
    url = f"{BASE_URL}/accounts/{FIRM_ACCOUNT_ID}/transfers"
    
    payload = {
        "transfer_type": "wire",    # Sandbox primarily supports ach for simulations
        "direction": "INCOMING",   # Deposit money IN
        "amount": "1000000",       # $1,000,000
        "relationship_id": "00000000-0000-0000-0000-000000000000" # Dummy ID for sandbox transfers
    }

    response = requests.post(
        url, 
        json=payload, 
        auth=HTTPBasicAuth(ALPACA_BROKER_KEY, ALPACA_BROKER_SECRET)
    )

    if response.status_code == 200:
        print("✅ Successfully 'gifted' $1,000,000 to firm account.")
        print("Response:", response.json())
    else:
        print(f"❌ Failed to seed balance. Status: {response.status_code}")
        print("Error:", response.text)

if __name__ == "__main__":
    seed_firm_balance()