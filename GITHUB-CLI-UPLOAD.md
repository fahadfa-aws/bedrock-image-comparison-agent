# Upload to GitHub Using GitHub CLI

## Step 1: Authenticate with GitHub

Run this command in your terminal:

```bash
gh auth login
```

Follow the prompts:
1. Choose: **GitHub.com**
2. Choose: **HTTPS** (recommended)
3. Choose: **Login with a web browser** (easiest)
4. Copy the one-time code shown
5. Press Enter to open your browser
6. Paste the code and authorize

## Step 2: Initialize Git Repository

```bash
cd bedrock-image-comparison-agent
git init
```

## Step 3: Verify .env is NOT included

```bash
git status
```

Make sure `.env` is NOT in the list (it should be ignored by .gitignore)

## Step 4: Stage All Files

```bash
git add .
```

## Step 5: Commit

```bash
git commit -m "Initial commit: Bedrock Image Comparison Agent with AWS credentials setup guide"
```

## Step 6: Create GitHub Repository and Push

For a PUBLIC repository:
```bash
gh repo create bedrock-image-comparison-agent --public --source=. --push --description "AWS Bedrock image generation comparison tool with intelligent prompt optimization using Claude Sonnet 4.5"
```

For a PRIVATE repository:
```bash
gh repo create bedrock-image-comparison-agent --private --source=. --push --description "AWS Bedrock image generation comparison tool with intelligent prompt optimization using Claude Sonnet 4.5"
```

## Step 7: Verify on GitHub

After the upload completes, visit:
```
https://github.com/YOUR-USERNAME/bedrock-image-comparison-agent
```

Check that:
- ✅ `.env` file is NOT visible
- ✅ `.env.example` IS visible with placeholders
- ✅ README shows the credentials warning at the top

## Troubleshooting

**If git init says "Reinitialized existing Git repository":**
- That's fine, it means git was already initialized

**If you see .env in git status:**
- Run: `git rm --cached .env`
- Then continue with git add

**If authentication fails:**
- Make sure you're logged into GitHub in your browser
- Try: `gh auth login` again

## Quick Commands Summary

```bash
# 1. Authenticate
gh auth login

# 2. Navigate and initialize
cd bedrock-image-comparison-agent
git init

# 3. Verify .env is ignored
git status | grep .env

# 4. Add and commit
git add .
git commit -m "Initial commit: Bedrock Image Comparison Agent"

# 5. Create and push (choose public or private)
gh repo create bedrock-image-comparison-agent --public --source=. --push
```

---

**Ready to start?** Run the first command: `gh auth login`
