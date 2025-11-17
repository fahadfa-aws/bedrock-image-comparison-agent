#!/bin/bash

# Deploy S3 buckets for Bedrock Image Comparison Agent
# This script deploys S3 buckets in both us-east-1 and us-west-2 regions

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="bedrock-image-comparison-s3-${ENVIRONMENT}"

echo "Deploying S3 buckets for environment: ${ENVIRONMENT}"
echo "Stack name: ${STACK_NAME}"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: ${ACCOUNT_ID}"

# Deploy to us-east-1
echo ""
echo "Deploying to us-east-1..."
aws cloudformation deploy \
  --template-file s3-buckets.yaml \
  --stack-name "${STACK_NAME}-us-east-1" \
  --parameter-overrides Environment="${ENVIRONMENT}" \
  --region us-east-1 \
  --no-fail-on-empty-changeset

# Get bucket name from us-east-1
BUCKET_US_EAST_1=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}-us-east-1" \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketNameUSEast1`].OutputValue' \
  --output text)

echo "✓ us-east-1 bucket created: ${BUCKET_US_EAST_1}"

# Deploy to us-west-2
echo ""
echo "Deploying to us-west-2..."
aws cloudformation deploy \
  --template-file s3-buckets.yaml \
  --stack-name "${STACK_NAME}-us-west-2" \
  --parameter-overrides Environment="${ENVIRONMENT}" \
  --region us-west-2 \
  --no-fail-on-empty-changeset

# Get bucket name from us-west-2
BUCKET_US_WEST_2=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}-us-west-2" \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketNameUSWest2`].OutputValue' \
  --output text)

echo "✓ us-west-2 bucket created: ${BUCKET_US_WEST_2}"

# Create .env entries
echo ""
echo "Add these to your .env file:"
echo "S3_BUCKET_US_EAST_1=${BUCKET_US_EAST_1}"
echo "S3_BUCKET_US_WEST_2=${BUCKET_US_WEST_2}"
echo "S3_SIGNED_URL_EXPIRATION=3600"

echo ""
echo "✓ Deployment complete!"
