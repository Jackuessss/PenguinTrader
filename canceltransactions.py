import requests
from requests.auth import HTTPBasicAuth


API_KEY = "CKWZXV6O4C7P5ZPGKPZ72KYZQH"
API_SECRET = "GeUEsQeEdVqbp1FRorhfVZJJgQ4fviGahFmhyVXGuek7"
BASE_URL = "https://broker-api.sandbox.alpaca.markets/v1"

AUTH = HTTPBasicAuth(API_KEY, API_SECRET)

def cancel_all_transfers():
    print("\nChecking for stuck Transfers (ACH)...")
    # Fetch all transfers that are in a queued/pending state
    try:
        # Get list of ALL transfers, then we filter locally or via separate calls
        # Alpaca allows filtering by status
        response = requests.get(f"{BASE_URL}/transfers?status=queued", auth=AUTH)
        queued_transfers = response.json()
        
        # Also check 'pending'
        response_pending = requests.get(f"{BASE_URL}/transfers?status=pending", auth=AUTH)
        pending_transfers = response_pending.json()
        
        all_stuck = queued_transfers + pending_transfers
        
        if not all_stuck:
            print("No stuck transfers found.")
            return

        print(f"found {len(all_stuck)} stuck transfers. Canceling now...")

        for transfer in all_stuck:
            t_id = transfer['id']
            # DELETE /v1/transfers/{id} cancels it
            del_resp = requests.delete(f"{BASE_URL}/transfers/{t_id}", auth=AUTH)
            
            if del_resp.status_code == 204:
                print(f"Cancelled Transfer {t_id}")
            else:
                print(f"Could not cancel {t_id}: {del_resp.status_code}")

    except Exception as e:
        print(f"Error checking transfers: {e}")

def cancel_all_journals():
    print("\nChecking for stuck Journals (JNLC)...")
    # Fetch pending journals
    try:
        response = requests.get(f"{BASE_URL}/journals?status=pending", auth=AUTH)
        if response.status_code != 200:
            print("Could not fetch journals.")
            return

        journals = response.json()
        
        # Also check 'queued' just in case
        resp_q = requests.get(f"{BASE_URL}/journals?status=queued", auth=AUTH)
        if resp_q.status_code == 200:
            journals += resp_q.json()

        if not journals:
            print("No stuck journals found.")
            return

        print(f"Found {len(journals)} stuck journals. Canceling now...")

        for journal in journals:
            j_id = journal['id']
            # DELETE /v1/journals/{id} cancels it
            del_resp = requests.delete(f"{BASE_URL}/journals/{j_id}", auth=AUTH)
            
            if del_resp.status_code == 204:
                print(f"Cancelled Journal {j_id}")
            else:
                print(f"Could not cancel {j_id}: {del_resp.status_code}")

    except Exception as e:
        print(f"Error checking journals: {e}")

if __name__ == "__main__":
    print("--- STARTING CLEANUP ---")
    cancel_all_transfers() # Clears the ACH list from your screenshot
    cancel_all_journals()  # Clears any stuck internal movements
    print("\n--- CLEANUP COMPLETE ---")