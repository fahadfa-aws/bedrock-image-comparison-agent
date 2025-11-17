# Quick Setup Guide

This is a condensed setup guide. For complete documentation, see [README.md](README.md).

## Prerequisites Checklist

- [ ] Node.js 20+ installed
- [ ] AWS Account with Bedrock access
- [ ] IAM user with programmatic access created

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AWS

Create IAM user and attach the policy from `iam-policy.json`:

```bash
# In AWS Console:
# IAM → Users → Create user → Attach policy from iam-policy.json
# Security credentials → Create access key
```

### 3. Enable Bedrock Models

In AWS Bedrock console, enable:
- Amazon Nova Canvas (us-east-1)
- Claude Sonnet 4.5 (us-east-1)
- Stability AI models (us-west-2)

### 4. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
```bash
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_KNOWLEDGE_BASE_ID=your-kb-id
```

### 5. Run the Application

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

Open `http://localhost:5173` in your browser.

## Verification

Test your setup:

```bash
# Test configuration
npm run test:config

# Test Bedrock connectivity
npm run test:bedrock-factory
```

## Common Issues

**"Invalid credentials"** → Check `.env` file has correct AWS keys

**"Permission denied"** → Verify IAM policy is attached and models are enabled

**"Model not available"** → Enable models in Bedrock console (takes a few minutes)

## Next Steps

1. Select 2-6 models in the UI
2. Enter a prompt (e.g., "A serene mountain landscape")
3. Review optimized prompts
4. Generate and compare images

For detailed documentation, troubleshooting, and API reference, see [README.md](README.md).
