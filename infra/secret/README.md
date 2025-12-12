# Secrets Directory

## Overview
This directory contains sensitive credentials and secrets used by the application services.

⚠️ **IMPORTANT**: This directory is protected by `.gitignore` and should NEVER be committed to git.

## File Structure

```
infra/secrets/
├── README.md                  # This file
├── .gitkeep                   # Placeholder for git tracking
├── postgres_db_pass.txt       # PostgreSQL root password
├── auth_db_pass.txt           # Auth service database password
├── chat_db_pass.txt           # Chat service database password
├── game_db_pass.txt           # Game service database password
└── user_db_pass.txt           # User service database password
```

## Permissions

All files in this directory are protected with strict permissions:

```
drwx------  (700) - Directory: Owner only (r/w/x)
-rw-------  (600) - Files: Owner read/write only
```

## Security

These files contain sensitive information:
- 🔐 Database passwords
- 🔐 API credentials (when added)
- 🔐 Encryption keys (when added)
- 🔐 Tokens (when added)

### Best Practices

1. ✅ **Never** commit these files to version control
2. ✅ **Always** use strong, randomly generated passwords
3. ✅ **Rotate** passwords regularly in production
4. ✅ **Store** backups securely offline
5. ✅ **Use** environment variables or Vault for production
6. ✅ **Monitor** access to these files

## Generation

To generate new secrets with secure random values:

```bash
# Generate a single password
openssl rand -base64 32 > infra/secrets/my_secret.txt
chmod 600 infra/secrets/my_secret.txt

# Or use the Makefile
make vault-init
```

## Usage in Docker Compose

Secrets are mounted as files in containers and read at startup:

```yaml
services:
  postgres:
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
    volumes:
      - ./infra/secrets/postgres_db_pass.txt:/run/secrets/postgres_password:ro
```

## For Production

In production environments, **DO NOT** use file-based secrets. Instead:

- Use **HashiCorp Vault** (already configured in this project)
- Use **AWS Secrets Manager** or similar cloud services
- Use **Kubernetes Secrets** if running on K8s
- Use environment variables from CI/CD secrets management

See `infra/vault/` for Vault configuration.

## Troubleshooting

### Permissions Error
```bash
# Fix if you get "Permission denied"
chmod 700 infra/secrets/
chmod 600 infra/secrets/*.txt
```

### File Not Found
```bash
# Regenerate missing files
make up  # This will fail, but you can see which are missing
# Then regenerate with openssl or the Makefile
```

### Git Accidentally Tracked Secrets
```bash
# Remove from git history (IMMEDIATELY)
git rm --cached infra/secrets/*.txt
git commit -m "Remove accidentally tracked secrets"
git push --force-with-lease origin [branch]
```
