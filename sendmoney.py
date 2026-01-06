import requests
from requests.auth import HTTPBasicAuth

API_KEY = "CKWZXV6O4C7P5ZPGKPZ72KYZQH"       
API_SECRET = "GeUEsQeEdVqbp1FRorhfVZJJgQ4fviGahFmhyVXGuek7" 

#Firm Sweep Account ID 
FIRM_ACCOUNT_ID = "ea8b4d97-ec46-399b-b088-e88936c3ecaf" 

BASE_URL = "https://broker-api.sandbox.alpaca.markets/v1"

def send_money():
    # 1. Ask for the Account ID
    target_account_id = input("\n Enter the User Account ID: ").strip()
    
    if not target_account_id:
        print(" Error: No Account ID entered.")
        return

    print(f"\n Sending $50,000 from Firm Wallet to {target_account_id}...")

    # 2. Construct the Instant Journal (JNLC)
    payload = {
        "entry_type": "JNLC",  # JNLC = Journal Cash (Instant)
        "from_account": FIRM_ACCOUNT_ID,
        "to_account": target_account_id,
        "amount": "50000",
        "description": "Manual Admin Top-up"
    }

    # 3. Send the Request
    try:
        response = requests.post(
            f"{BASE_URL}/journals", 
            json=payload, 
            auth=HTTPBasicAuth(API_KEY, API_SECRET)
        )

        # 4. Handle Response
        if response.status_code == 200:
            print("\n SUCCESS! Transfer Executed.")
            print(f" Account {target_account_id} now has $50,000 available.")
            print("Check the 'Accounts' tab in your dashboard to verify equity.")
        else:
            print("\nFAILED.")
            print(f"Status Code: {response.status_code}")
            print(f"Error Message: {response.text}")
            
    except Exception as e:
        print(f"\n Script Error: {e}")

if __name__ == "__main__":
    send_money()