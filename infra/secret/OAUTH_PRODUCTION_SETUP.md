# OAuth Keys for Production Deployment

## Overview

Your 42 OAuth keys need to be stored securely for production deployment. This guide shows you how to add them to HashiCorp Vault.

## Development vs Production

### Development (Current)
- OAuth keys can be set via environment variables in `docker-compose.override.yml`
- Keys are loaded directly into auth-service container

### Production (Recommended)
- OAuth keys stored in HashiCorp Vault
- Auth-service automatically fetches keys on startup via entrypoint.sh
- Keys never stored in code or docker-compose files

## Setup Instructions

### Option 1: Store in Vault (Recommended for Production)

Your auth-service is already configured to read from Vault! Just add the secrets:

#### Step 1: Get Your 42 OAuth Credentials
1. Go to https://profile.intra.42.fr/oauth/applications
2. Create or select your application
3. Note your:
   - Client ID (UID)
   - Client Secret
   - Redirect URI (should be: `https://your-domain.com/api/auth/callback/42`)

#### Step 2: Start Vault in Production Mode

For production, you need to properly initialize Vault (not dev mode):

```bash
# In production docker-compose, ensure Vault is NOT in dev mode
# vault service should NOT have VAULT_DEV_ROOT_TOKEN_ID
```

#### Step 3: Add OAuth Secrets to Vault

After Vault is initialized and unsealed:

```bash
# Login to vault container
docker compose exec vault sh

# Authenticate (use your actual root token or AppRole)
vault login <your-vault-token>

# Store OAuth credentials
vault kv put secret/oauth/42 \
  client_id="your_42_client_id_here" \
  client_secret="your_42_client_secret_here"

# Verify storage
vault kv get secret/oauth/42
```

#### Step 4: Update Vault Policy (if needed)

The auth-policy should already allow reading OAuth secrets. Verify:

```bash
# Check current policy
vault policy read auth-policy
```

Expected content should include:
```hcl
path "secret/data/oauth/*" {
  capabilities = ["read", "list"]
}
```

If not present, update `infra/vault/policies/auth-policy.hcl`:

```hcl
# OAuth credentials
path "secret/data/oauth/*" {
  capabilities = ["read", "list"]
}
```

Then reload:
```bash
vault policy write auth-policy /vault/policies/auth-policy.hcl
```

### Option 2: Environment Variables (Quick Setup)

For quick production deployment without Vault modifications:

Add to your production `docker-compose.prod.yml`:

```yaml
services:
  auth-service:
    environment:
      - OAUTH_42_CLIENT_ID=${OAUTH_42_CLIENT_ID}
      - OAUTH_42_CLIENT_SECRET=${OAUTH_42_CLIENT_SECRET}
      - OAUTH_42_REDIRECT_URI=https://your-domain.com/api/auth/callback/42
```

Then create `.env.prod` file (DO NOT COMMIT THIS):

```env
OAUTH_42_CLIENT_ID=your_client_id_here
OAUTH_42_CLIENT_SECRET=your_client_secret_here
```

Load it:
```bash
export $(cat .env.prod | xargs)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Option 3: CI/CD Secrets (GitHub Actions, GitLab CI, etc.)

Store secrets in your CI/CD platform:

**GitHub Actions Example:**
1. Go to repository Settings → Secrets and variables → Actions
2. Add secrets:
   - `OAUTH_42_CLIENT_ID`
   - `OAUTH_42_CLIENT_SECRET`

3. In your deployment workflow:
```yaml
- name: Deploy
  env:
    OAUTH_42_CLIENT_ID: ${{ secrets.OAUTH_42_CLIENT_ID }}
    OAUTH_42_CLIENT_SECRET: ${{ secrets.OAUTH_42_CLIENT_SECRET }}
  run: |
    # Write to Vault or use directly
    docker compose -f docker-compose.prod.yml up -d
```

## How It Works

The auth-service `entrypoint.sh` already has this logic:

```bash
if [ -f "/tmp/vault_token" ]; then
    export VAULT_TOKEN=$(cat /tmp/vault_token)
    
    # Fetch 42 OAuth credentials from Vault
    OAUTH_DATA=$(wget -q -O- --header "X-Vault-Token: $VAULT_TOKEN" http://vault:8200/v1/secret/data/oauth/42 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$OAUTH_DATA" ]; then
        export OAUTH_42_CLIENT_ID=$(echo "$OAUTH_DATA" | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
        export OAUTH_42_CLIENT_SECRET=$(echo "$OAUTH_DATA" | grep -o '"client_secret":"[^"]*' | cut -d'"' -f4)
        export OAUTH_42_REDIRECT_URI="https://localhost:8443/api/auth/callback/42"
    fi
fi
```

This means:
1. ✅ If Vault token exists, fetch from Vault automatically
2. ✅ If environment variables are set, use those (fallback)
3. ✅ No code changes needed!

## Security Best Practices

1. **Never commit secrets to git**
   - Add `.env.prod` to `.gitignore`
   - Don't hardcode in docker-compose files

2. **Use Vault in production**
   - Proper secret rotation
   - Audit logging
   - Access control via policies

3. **Update redirect URI**
   - Change from `localhost:8443` to your actual domain
   - Update in both Vault/env vars AND 42 OAuth app settings

4. **Restrict Vault access**
   - Use AppRole authentication for services
   - Limit token TTL and max TTL
   - Enable audit logging

## Troubleshooting

### OAuth keys not loading
```bash
# Check if Vault token exists in container
docker compose exec auth-service cat /tmp/vault_token

# Check if secrets exist in Vault
docker compose exec vault vault kv get secret/oauth/42

# Check container environment variables
docker compose exec auth-service env | grep OAUTH
```

### 42 OAuth callback failing
- Verify redirect URI in 42 app settings matches exactly
- Check that domain/port is accessible
- Ensure HTTPS is properly configured

## Quick Production Checklist

- [ ] Get 42 OAuth credentials from intra.42.fr
- [ ] Choose storage method (Vault recommended)
- [ ] Add secrets to Vault or CI/CD
- [ ] Update redirect URI to production domain
- [ ] Update 42 OAuth app settings with production callback URL
- [ ] Test OAuth login flow in production
- [ ] Verify secrets are not in git history

## Need Help?

Check related documentation:
- `infra/secret/DEV_VS_PROD.md` - Development vs production secrets
- `infra/vault/README.md` - Vault configuration
- `infra/INFRA_DOC.md` - Infrastructure overview
