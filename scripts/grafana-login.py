#!/usr/bin/env python3
"""
Auto-login script for Grafana
Opens Grafana in the browser and logs in automatically
"""
import sys
import os
import json
import urllib.request
import urllib.error
import time
from http.cookies import SimpleCookie

def get_grafana_password_from_vault(vault_addr, vault_token):
    """Fetch Grafana password from Vault"""
    url = f"{vault_addr}/v1/secret/data/grafana"
    headers = {"X-Vault-Token": vault_token}
    
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            password = data['data']['data']['password']
            return password
    except Exception as e:
        print(f"Error fetching password from Vault: {e}")
        return None

def login_to_grafana(grafana_url, username, password):
    """Login to Grafana and return session cookie"""
    login_url = f"{grafana_url}/api/auth/login"
    login_data = json.dumps({
        "user": username,
        "password": password
   }).encode('utf-8')
    
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(login_url, data=login_data, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if 'message' in result and result['message'] == 'User logged in':
                # Extract cookies
                cookies = response.headers.get('Set-Cookie')
                return True, cookies
            else:
                return False, None
    except Exception as e:
        print(f"Error logging in: {e}")
        return False, None

if __name__ == "__main__":
    vault_addr = "https://localhost:8200"
    # Prefer VAULT_TOKEN env var, then token file (infra/secret/vault_token.txt), else fail
    vault_token = None
    if 'VAULT_TOKEN' in os.environ and os.environ['VAULT_TOKEN'].strip() != '':
        vault_token = os.environ['VAULT_TOKEN']
    else:
        token_file = os.environ.get('VAULT_TOKEN_FILE', './infra/secret/vault_token.txt')
        try:
            with open(token_file, 'r') as f:
                vault_token = f.read().strip()
        except Exception:
            vault_token = None

    grafana_url = "https://localhost:3002"
    username = "grafana_admin"
    
    if not vault_token:
        print("error:		No Vault token available. Set VAULT_TOKEN env var or provide vault token file at ./infra/secret/vault_token.txt")
        sys.exit(1)

    print("Fetching Grafana password from Vault...")
    password = get_grafana_password_from_vault(vault_addr, vault_token)
    
    if not password:
        print("Failed to get password from Vault")
        sys.exit(1)
    
    print(f"Password retrieved. Logging in as {username}...")
    success, cookies = login_to_grafana(grafana_url, username, password)
    
    if success:
        print("✓ Successfully logged in to Grafana!")
        print(f"Open your browser to: {grafana_url}")
        if cookies:
            print(f"Session cookies: {cookies}")
    else:
        print("✗ Failed to login")
        sys.exit(1)
