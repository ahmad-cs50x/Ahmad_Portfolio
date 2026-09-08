# Cloudflare Pages Deployment Setup Guide

## ✅ Already Completed
- GitHub Actions workflow created: `.github/workflows/deploy.yml`
- `wrangler.toml` configured with project name

## 🔄 Complete These Steps Manually

### Step 1: Login to Cloudflare (Do This Now)
```bash
cd "C:/My data/Coding/Projects/Ahmad-Portfolio/Ahmad_Portfolio"
npx wrangler login
```
- This will open your browser for OAuth authentication
- Accept the requested permissions

### Step 2: Create Cloudflare API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use **Edit Cloudflare Pages** template
4. Under **Account Resources**, select your account
5. Under **Workspace Resources**, click **Add** and enter your project name: `ahmad-portfolio`
6. Click **Continue to summary** then **Create Token**
7. **Copy the token** (you won't see it again!)

### Step 3: Get Your Account ID
1. Go to https://dash.cloudflare.com
2. Click on your account
3. Copy the **Account ID** from the right sidebar

### Step 4: Add Secrets to GitHub Repository
Go to your repository: https://github.com/ahmad-cs50x/Ahmad_Portfolio/settings/secrets/actions
Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | [Your API token from Step 2] |
| `CLOUDFLARE_ACCOUNT_ID` | [Your account ID from Step 3] |

### Step 5: Push and Deploy
```bash
cd C:/My\ data/Coding/Projects/Ahmad-Portfolio/Ahmad_Portfolio
git add .
git commit -m "feat: add GitHub Actions deployment workflow"
git push origin main
```

After pushing, go to https://github.com/ahmad-cs50x/Ahmad_Portfolio/actions
Watch the workflow run - it will automatically deploy to Cloudflare Pages!

---

## 🌐 Your Deployed URLs
- Staging: https://ahmad-portfolio.pages.dev
- Production: Same as staging (Cloudflare Pages uses same URL)
