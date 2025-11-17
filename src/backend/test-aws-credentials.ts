/**
 * Test AWS Credentials
 * Verifies that AWS credentials are valid and have necessary permissions
 */

import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

async function testAWSCredentials() {
  console.log('='.repeat(80));
  console.log('AWS CREDENTIALS TEST');
  console.log('='.repeat(80));
  console.log();

  try {
    // Test 1: Verify credentials are loaded
    console.log('Test 1: Environment Variables');
    console.log('-'.repeat(80));
    
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;

    if (!accessKeyId || !secretAccessKey) {
      console.log('❌ FAILED: AWS credentials not found in environment');
      console.log('   Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file');
      process.exit(1);
    }

    console.log('✅ AWS_ACCESS_KEY_ID:', accessKeyId.substring(0, 8) + '...');
    console.log('✅ AWS_SECRET_ACCESS_KEY:', '***' + secretAccessKey.substring(secretAccessKey.length - 4));
    console.log('✅ AWS_REGION:', region || 'us-east-1');
    console.log();

    // Test 2: Test S3 access
    console.log('Test 2: Test S3 Access');
    console.log('-'.repeat(80));

    const s3Client = new S3Client({ region: region || 'us-east-1' });
    
    try {
      const listBucketsCommand = new ListBucketsCommand({});
      const buckets = await s3Client.send(listBucketsCommand);

      console.log('✅ S3 access verified');
      console.log(`   Found ${buckets.Buckets?.length || 0} bucket(s)`);
      console.log();
    } catch (error: any) {
      console.log('❌ FAILED: Cannot access S3');
      console.log('   Error:', error.message);
      console.log('   This may indicate missing S3 permissions');
      console.log();
    }

    // Test 3: Verify specific buckets
    console.log('Test 3: Verify S3 Buckets');
    console.log('-'.repeat(80));

    const bucketUSEast1 = process.env.S3_BUCKET_US_EAST_1;
    const bucketUSWest2 = process.env.S3_BUCKET_US_WEST_2;

    if (!bucketUSEast1 || !bucketUSWest2) {
      console.log('⚠️  WARNING: S3 bucket names not configured');
      console.log('   Set S3_BUCKET_US_EAST_1 and S3_BUCKET_US_WEST_2 in .env file');
      console.log();
    } else {
      console.log('Configured buckets:');
      console.log('   us-east-1:', bucketUSEast1);
      console.log('   us-west-2:', bucketUSWest2);
      console.log();

      // Try to get bucket location for us-east-1
      try {
        const s3East = new S3Client({ region: 'us-east-1' });
        const locationCommand = new GetBucketLocationCommand({ Bucket: bucketUSEast1 });
        const location = await s3East.send(locationCommand);
        console.log('✅ us-east-1 bucket accessible');
        console.log('   Location:', location.LocationConstraint || 'us-east-1');
      } catch (error: any) {
        console.log('❌ Cannot access us-east-1 bucket');
        console.log('   Error:', error.message);
        
        if (error.name === 'NoSuchBucket') {
          console.log('   Bucket does not exist');
        } else if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
          console.log('   Access denied - check IAM permissions');
        }
      }

      // Try to get bucket location for us-west-2
      try {
        const s3West = new S3Client({ region: 'us-west-2' });
        const locationCommand = new GetBucketLocationCommand({ Bucket: bucketUSWest2 });
        const location = await s3West.send(locationCommand);
        console.log('✅ us-west-2 bucket accessible');
        console.log('   Location:', location.LocationConstraint || 'us-west-2');
      } catch (error: any) {
        console.log('❌ Cannot access us-west-2 bucket');
        console.log('   Error:', error.message);
        
        if (error.name === 'NoSuchBucket') {
          console.log('   Bucket does not exist');
        } else if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
          console.log('   Access denied - check IAM permissions');
        }
      }

      console.log();
    }

    console.log('='.repeat(80));
    console.log('✅ AWS CREDENTIALS TEST COMPLETED');
    console.log('='.repeat(80));

  } catch (error) {
    logger.error('Credential test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Run test
testAWSCredentials();
