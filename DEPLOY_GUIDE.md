# 🚀 Cloudflare Pages Auto-Deployment

## ✅ What's Done

1. **GitHub Actions Workflow** created at `.github/workflows/deploy.yml`
   - Automatically deploys when you push to `main` branch
   - Uses `@cloudflare/next-on-pages` for Next.js 15 compatibility
   - Deploys to Cloudflare Pages

2. **Workflow Pushed** to your repository
   - Commit: `c72e35e`
   - Ready for secrets setup

---

## 🔑 Step 1: Authenticate Cloudflare (Required)

Run this command in your terminal:

```bash
cd "C:/My data/Coding/Projects/Ahmad-Portfolio/Ahmad_Portfolio"
npx wrangler login
```

This will open a browser window. Complete the OAuth flow.

---

## 🎫 Step 2: Create Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Click **"Use template"** next to **"Edit Cloudflare Pages"**
4. Under **Permissions**, ensure these are checked:
   - ✅ **Cloudflare Pages** → **Edit**
   - ✅ **Account** → **Account Settings** → **Read**
5. Under **Account Resources**, select your account (or use "Include all accounts")
6. Under **Workspace Resources**, click **Add** and enter: `ahmad-portfolio`
7. Click **"Continue to summary"** then **"Create Token"**
8. **⚠️ COPY THIS TOKEN NOW** — you won't see it again!

---

## 📝 Step 3: Get Your Account ID

1. Go to: https://dash.cloudflare.com
2. Click on any zone or go to **Account Home**
3. Find **"Account ID"** on the right sidebar (it's a 32-character hex string like `abc123...`)
4. **Copy this Account ID**

---

## 🔐 Step 4: Add Secrets to GitHub

Go to: https://github.com/ahmad-cs50x/Ahmad_Portfolio/settings/secrets/actions

Click **"New repository secret"** and add these two:

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | Paste your API token from Step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Paste your Account ID from Step 3 |

---

## 🚀 Step 5: Test the Deployment

Once secrets are added, trigger a manual deployment:

### Option A: Push a commit
```bash
git pull origin main
# Make a small change or just pull
git push origin main
```

### Option B: Manual workflow run
1. Go to: https://github.com/ahmad-cs50x/Ahmad_Portfolio/actions
2. Click **"Deploy to Cloudflare Pages"** workflow
3. Click **"Run workflow"** button
4. Wait for it to complete (~2-3 minutes)

---

## 🌐 Your Deployment URLs

After successful deployment:
- **Production URL**: https://ahmad-portfolio.pages.dev
- **Preview URLs**: Each PR creates a preview URL (if configured later)

---

## 📋 Monitoring

Check deployment status:
- **GitHub Actions**: https://github.com/ahmad-cs50x/Ahmad_Portfolio/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com/pages/view/ahmad-portfolio

---

## 🔧 Troubleshooting

### Build fails with "next-on-pages" error?
- Ensure `wrangler.toml` has correct project name
- Check that all environment variables are set

### Deployment fails with permission error?
- Verify API token has correct permissions
- Check account ID is correct

### Want custom domain (like saltiam.com)?
- Add DNS records in Cloudflare dashboard after deployment
- Enable SSL in Cloudflare Pages settings
