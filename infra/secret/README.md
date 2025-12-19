# Hybrid Secret Management (Development Environment)

> [!WARNING]
> **DEVELOPMENT ONLY**
> The files generated in this directory contain **sensitive credentials** (passwords, tokens).
> * **Do NOT** commit `.txt` files to version control.
> * **Do NOT** use these mechanisms in Production.
> * **Do NOT** share these secrets over insecure channels.
> 
> 

---

## ⚡ Quick Start (TL;DR)

If you just need to log in to a service, run these commands from the repository root:

### 1. Generate Secrets (First Run Only)

If you are setting up the project for the first time:

`./scripts/generate_dev_secrets.sh`

### 2. View Credentials

To see a safe summary of where credentials are stored and their login URLs:

`./scripts/show_creds.sh`

### 3. Reveal Passwords

To see the **actual raw passwords** (e.g., to copy-paste into a login form):

`./scripts/show_creds.sh --reveal`

---

## 🔄 The Secret Workflow

We use a **Hybrid Injection** model. Secrets are generated locally, stored in git-ignored files, and then "seeded" into HashiCorp Vault when containers start.

**The Flow:**

1. **Generate:** `generate_dev_secrets.sh` creates cryptographically secure random values.
2. **Store:** Values are written to `./infra/secret/*.txt` (Git-Ignored).
3. **Mount:** Docker Compose mounts this directory into `/run/secrets` inside containers.
4. **Seed:** Entrypoint scripts (like `init_vault.sh`) read these files and push them into the Vault API.
5. **Consume:** Services (Backend, Grafana, etc.) fetch their secrets from Vault at runtime.

---

## 🛠️ Usage Guide

### Generative Scripts

The `generate_dev_secrets.sh` script handles the creation of all required passwords.

* **Location:** `./scripts/generate_dev_secrets.sh` (Symlinked from `infra/secret/`).
* **Behavior:** It checks if a secret exists. If not, it generates a high-entropy string and saves it. It sets file permissions to `600` (User Read/Write Only).

### The Credential Viewer (`show_creds.sh`)

This utility is the standard way to access credentials.

| Command | Description |
| --- | --- |
| `./scripts/show_creds.sh` | **Safe Mode.** Shows Service names, Usernames, and file paths. Use this for presentations or screen sharing. |
| `./scripts/show_creds.sh --reveal` | **Unsafe Mode.** Prints the raw secret values in the table. Use only in a private terminal. |

---

## ⚙️ Vault Integration Details

For developers debugging `vault` or `entrypoint` issues:

* **Initialization:** The local Vault instance is stateless. It is re-initialized on every `docker compose up` by `infra/vault/init_vault.sh`.
* **Root Token:** The root token is hardcoded in the generator for dev convenience but is **never used in production configuration**.
* **Service Access:** Backend services do not read text files. They authenticate to Vault using the token seeded during the build/init process.

---

## ❓ Troubleshooting

**"I ran `show_creds.sh` but it says 'Not Found'"**

> You haven't generated the secrets yet. Run `./scripts/generate_dev_secrets.sh`.

**"Services are failing with 'Permission Denied' on secrets"**

> Check file permissions. The container user must be able to read the mounted files.
> Fix: `chmod 600 infra/secret/*.txt`

**"I changed a password file, but the service uses the old one"**

> Docker volumes are persistent. You must restart the container to pick up the change, and for Vault-backed services, you may need to restart Vault to re-seed the value.
> `docker compose restart vault <service_name>`

---

## 📞 Contact

For production secret provisioning or CI/CD pipeline questions, please contact the **DevSecOps Lead**.
