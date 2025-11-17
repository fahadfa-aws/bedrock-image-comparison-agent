# Setup Guide for New Users

Welcome! This guide will help you set up the Bedrock Image Comparison Agent after cloning from GitHub.

## Prerequisites

Before you begin, make sure you have:

- ✅ Node.js 20 or higher installed
- ✅ npm (comes with Node.js)
- ✅ An AWS account
- ✅ Basic familiarity with command line/terminal

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/bedrock-image-comparison-agent.git
cd bedrock-image-comparison-agent
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages for both frontend and backend.

### 3. Create Your Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 4. Configure AWS Credentials

You need to add your AWS credentials to the `.env` file. Open it in your text editor:

```bash
# On macOS/Linux
nano .env

# On Windows
notepad .env
```

Update these three critical values:

```bash
AWS_ACCESS_KEY_ID=your-access-key-id-here          # Replace with your actual access key
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here  # Replace with your actual secret key
AWS_KNOWLEDGE_BASE_ID=your-knowledge-base-id-here  # Replace with your KB ID or use 'disabled'
```

**Don't have AWS credentials yet?** See the [AWS Setup Guide](#aws-setup-guide) below.

### 5. Start the Application

Open two terminal windows:

**Terminal 1 - Backend Server:**
```bash
npm run dev:backend
```

Wait for the message: `Server running on port 3000`

**Terminal 2 - Frontend Server:**
```bash
npm run dev:frontend
```

Wait for the message: `Local: http://localhost:5173`

### 6. Open in Browser

Navigate to: `http://localhost:5173`

You should see the Bedrock Image Comparison Agent interface!

## AWS Setup Guide

If you don't have AWS credentials yet, follow these steps:

### Step 1: Create an AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Follow the registration process
4. You'll need a credit card (AWS has a free tier)

### Step 2: Create an IAM User

1. Sign in to AWS Console
2. Search for "IAM" in the services search bar
3. Click "Users" in the left sidebar
4. Click "Create user"
5. Enter username: `bedrock-image-agent`
6. Click "Next"

### Step 3: Attach Permissions

**Option A: Use the Provided Policy (Recommended)**

1. In IAM, go to "Policies" → "Create policy"
2. Click the "JSON" tab
3. Open the `iam-policy.json` file from this repository
4. Copy and paste the entire contents
5. Click "Next" → Name it `BedrockImageComparisonPolicy`
6. Click "Create policy"
7. Go back to your user → "Add permissions" → "Attach policies directly"
8. Search for `BedrockImageComparisonPolicy` and select it
9. Click "Add permissions"

**Option B: Use AWS Managed Policy (Simpler but broader permissions)**

1. Attach the `AmazonBedrockFullAccess` policy to your user
2. This gives broader access but is quicker to set up

### Step 4: Create Access Keys

1. Click on your IAM user
2. Go to "Security credentials" tab
3. Scroll to "Access keys"
4. Click "Create access key"
5. Select "Application running outside AWS"
6. Click "Next" → "Create access key"
7. **IMPORTANT**: Copy both the Access Key ID and Secret Access Key
8. Store them securely - you won't be able to see the secret key again!

### Step 5: Enable Bedrock Models

1. Go to AWS Bedrock console (search for "Bedrock")
2. Click "Model access" in the left sidebar
3. Click "Manage model access" or "Enable specific models"
4. Enable these models:
   - ✅ Amazon Nova Canvas (us-east-1)
   - ✅ Claude Sonnet 4.5 (us-east-1)
   - ✅ Stability AI SDXL (us-west-2)
   - ✅ Stability AI Core (us-west-2)
   - ✅ Stability AI Ultra (us-west-2)
5. Click "Save changes"
6. Wait 2-5 minutes for access to activate

### Step 6: Set Up Knowledge Base (Optional)

The application can work without a Knowledge Base by using fallback mode:

**Option A: Use Fallback Mode (Easier)**
```bash
AWS_KNOWLEDGE_BASE_ID=disabled
```

**Option B: Create a Knowledge Base (Better results)**
1. Go to AWS Bedrock → "Knowledge bases"
2. Click "Create knowledge base"
3. Follow the wizard to create a KB with Bedrock documentation
4. Copy the Knowledge Base ID (10 characters)
5. Add it to your `.env` file

## Verification

### Test Your Setup

1. Open the application at `http://localhost:5173`
2. Select 2-3 models from the grid
3. Enter a simple prompt: "A red apple on a wooden table"
4. Click "Optimize Prompt"
5. If successful, you'll see optimized prompts for each model
6. Click "Generate Images"
7. Wait 10-30 seconds for images to generate

### Common Issues

**"Invalid AWS credentials"**
- Double-check your Access Key ID and Secret Access Key in `.env`
- Make sure there are no extra spaces or quotes
- Verify the IAM user exists and is active

**"Model not available"**
- Go to AWS Bedrock console → Model access
- Verify all models are enabled
- Wait a few minutes and try again

**"Failed to retrieve model documentation"**
- Set `AWS_KNOWLEDGE_BASE_ID=disabled` in `.env` to use fallback mode
- Or verify your Knowledge Base ID is correct

**Port already in use**
- Change `PORT=3000` to `PORT=3001` in `.env`
- Update the frontend proxy in `vite.config.ts` if needed

## Next Steps

Once your setup is working:

1. **Explore the Gallery**: Generate a few images and check out the Gallery tab
2. **Try Different Models**: Compare how different models interpret the same prompt
3. **Experiment with Prompts**: See how Claude optimizes different types of descriptions
4. **Read the Documentation**: Check out the main README.md for advanced features

## Security Reminders

- ✅ Never commit your `.env` file to Git
- ✅ Never share your AWS credentials publicly
- ✅ Rotate your access keys every 90 days
- ✅ Monitor your AWS billing dashboard
- ✅ Set up billing alerts in AWS

## Cost Awareness

Each image generation costs approximately:
- Amazon Nova Canvas: $0.04 per image
- Stability AI models: $0.03-$0.08 per image
- Claude optimization: ~$0.01 per prompt

Comparing 4 models costs about $0.20 per prompt.

## Getting Help

If you run into issues:

1. Check the [Troubleshooting section](README.md#troubleshooting) in README.md
2. Review the [AWS Setup Guide](README.md#aws-setup-guide) in README.md
3. Verify your `.env` file matches `.env.example` structure
4. Check AWS service health status
5. Open an issue on GitHub with error details

## Additional Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/)
- [Project README](README.md) - Full documentation
- [Testing Guide](TESTING.md) - How to run tests

---

**Happy image generating!** 🎨

If you found this project helpful, consider giving it a star on GitHub!
