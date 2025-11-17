#!/bin/bash

# Upload Script for Bedrock Image Comparison Agent
# GitHub Profile: fahadfa-aws

echo "🚀 Bedrock Image Comparison Agent - GitHub Upload Script"
echo "=========================================================="
echo ""

# Check if gh CLI is installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI detected"
    echo ""
    echo "Creating repository on GitHub..."
    
    # Create the repository
    gh repo create bedrock-image-comparison-agent \
        --public \
        --description "Compare AWS Bedrock image generation models (Nova Canvas, Stability AI) with intelligent prompt optimization using Claude Sonnet 4.5" \
        --source=. \
        --remote=origin \
        --push
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Repository created and code pushed successfully!"
        echo ""
        echo "🌐 Your repository is now live at:"
        echo "   https://github.com/fahadfa-aws/bedrock-image-comparison-agent"
        echo ""
        echo "📝 Next steps:"
        echo "   1. Visit your repository on GitHub"
        echo "   2. Verify .env file is NOT visible (should be ignored)"
        echo "   3. Check that README shows the credentials warning"
        echo "   4. Add topics/tags in repository settings"
        echo ""
    else
        echo "❌ Failed to create repository. Please check the error above."
        exit 1
    fi
else
    echo "⚠️  GitHub CLI not found. Using manual method..."
    echo ""
    echo "Please follow these steps:"
    echo ""
    echo "1. Go to: https://github.com/new"
    echo "2. Repository name: bedrock-image-comparison-agent"
    echo "3. Description: Compare AWS Bedrock image generation models (Nova Canvas, Stability AI) with intelligent prompt optimization using Claude Sonnet 4.5"
    echo "4. Choose: Public"
    echo "5. Do NOT initialize with README, .gitignore, or license"
    echo "6. Click 'Create repository'"
    echo ""
    echo "Then run these commands:"
    echo ""
    echo "git remote add origin https://github.com/fahadfa-aws/bedrock-image-comparison-agent.git"
    echo "git push -u origin main"
    echo ""
fi
