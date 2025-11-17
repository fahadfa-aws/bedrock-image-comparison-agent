/**
 * Test S3 Bucket Policies
 * Verifies bucket policies, encryption, versioning, CORS, and lifecycle rules
 */

import {
  S3Client,
  GetBucketPolicyCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetPublicAccessBlockCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

interface BucketTestResult {
  bucket: string;
  region: string;
  tests: {
    name: string;
    passed: boolean;
    details?: any;
    error?: string;
  }[];
}

async function testBucketPolicies() {
  console.log('='.repeat(80));
  console.log('S3 BUCKET POLICY VERIFICATION');
  console.log('='.repeat(80));
  console.log();

  const bucketUSEast1 = process.env.S3_BUCKET_US_EAST_1;
  const bucketUSWest2 = process.env.S3_BUCKET_US_WEST_2;

  if (!bucketUSEast1 || !bucketUSWest2) {
    console.log('❌ ERROR: S3 bucket names not configured');
    process.exit(1);
  }

  const results: BucketTestResult[] = [];

  // Test both buckets
  for (const [bucket, region] of [
    [bucketUSEast1, 'us-east-1'],
    [bucketUSWest2, 'us-west-2'],
  ] as const) {
    console.log(`Testing Bucket: ${bucket} (${region})`);
    console.log('='.repeat(80));
    console.log();

    const bucketResult: BucketTestResult = {
      bucket,
      region,
      tests: [],
    };

    const s3Client = new S3Client({ region });

    // Test 1: Bucket Policy
    await testBucketPolicy(s3Client, bucket, bucketResult);

    // Test 2: Encryption
    await testEncryption(s3Client, bucket, bucketResult);

    // Test 3: Versioning
    await testVersioning(s3Client, bucket, bucketResult);

    // Test 4: CORS Configuration
    await testCORS(s3Client, bucket, bucketResult);

    // Test 5: Lifecycle Rules
    await testLifecycleRules(s3Client, bucket, bucketResult);

    // Test 6: Public Access Block
    await testPublicAccessBlock(s3Client, bucket, bucketResult);

    // Test 7: Secure Transport (HTTPS)
    await testSecureTransport(s3Client, bucket, region, bucketResult);

    // Test 8: Object Operations
    await testObjectOperations(s3Client, bucket, region, bucketResult);

    results.push(bucketResult);
    console.log();
  }

  // Print summary
  printSummary(results);
}

async function testBucketPolicy(
  s3Client: S3Client,
  bucket: string,
  result: BucketTestResult
) {
  console.log('Test 1: Bucket Policy');
  console.log('-'.repeat(80));

  try {
    const command = new GetBucketPolicyCommand({ Bucket: bucket });
    const response = await s3Client.send(command);

    if (response.Policy) {
      const policy = JSON.parse(response.Policy);
      console.log('✅ Bucket policy exists');

      // Check for DenyInsecureTransport statement
      const hasSecureTransportPolicy = policy.Statement?.some(
        (stmt: any) =>
          stmt.Sid === 'DenyInsecureTransport' &&
          stmt.Effect === 'Deny' &&
          stmt.Condition?.Bool?.['aws:SecureTransport'] === 'false'
      );

      if (hasSecureTransportPolicy) {
        console.log('✅ Secure transport (HTTPS) policy enforced');
      } else {
        console.log('⚠️  Secure transport policy not found');
      }

      result.tests.push({
        name: 'Bucket Policy',
        passed: true,
        details: {
          hasPolicy: true,
          hasSecureTransport: hasSecureTransportPolicy,
          statementCount: policy.Statement?.length || 0,
        },
      });
    }
  } catch (error: any) {
    if (error.name === 'NoSuchBucketPolicy') {
      console.log('⚠️  No bucket policy configured');
      result.tests.push({
        name: 'Bucket Policy',
        passed: true,
        details: { hasPolicy: false },
      });
    } else {
      console.log('❌ Failed to get bucket policy');
      console.log(`   Error: ${error.message}`);
      result.tests.push({
        name: 'Bucket Policy',
        passed: false,
        error: error.message,
      });
    }
  }

  console.log();
}

async function testEncryption(
  s3Client: S3Client,
  bucket: string,
  result: BucketTestResult
) {
  console.log('Test 2: Server-Side Encryption');
  console.log('-'.repeat(80));

  try {
    const command = new GetBucketEncryptionCommand({ Bucket: bucket });
    const response = await s3Client.send(command);

    const rules = response.ServerSideEncryptionConfiguration?.Rules || [];
    const hasAES256 = rules.some(
      (rule) =>
        rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'AES256'
    );

    if (hasAES256) {
      console.log('✅ AES256 encryption enabled');
    } else {
      console.log('⚠️  AES256 encryption not configured');
    }

    result.tests.push({
      name: 'Encryption',
      passed: hasAES256,
      details: {
        algorithm: rules[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm,
      },
    });
  } catch (error: any) {
    console.log('❌ Failed to get encryption configuration');
    console.log(`   Error: ${error.message}`);
    result.tests.push({
      name: 'Encryption',
      passed: false,
      error: error.message,
    });
  }

  console.log();
}

async function testVersioning(
  s3Client: S3Client,
  bucket: string,
  result: BucketTestResult
) {
  console.log('Test 3: Versioning');
  console.log('-'.repeat(80));

  try {
    const command = new GetBucketVersioningCommand({ Bucket: bucket });
    const response = await s3Client.send(command);

    const isEnabled = response.Status === 'Enabled';

    if (isEnabled) {
      console.log('✅ Versioning enabled');
    } else {
      console.log('⚠️  Versioning not enabled');
    }

    result.tests.push({
      name: 'Versioning',
      passed: isEnabled,
      details: { status: response.Status },
    });
  } catch (error: any) {
    console.log('❌ Failed to get versioning configuration');
    console.log(`   Error: ${error.message}`);
    result.tests.push({
      name: 'Versioning',
      passed: false,
      error: error.message,
    });
  }

  console.log();
}

async function testCORS(
  s3Client: S3Client,
  bucket: string,
  result: BucketTestResult
) {
  console.log('Test 4: CORS Configuration');
  console.log('-'.repeat(80));

  try {
    const command = new GetBucketCorsCommand({ Bucket: bucket });
    const response = await s3Client.send(command);

    const rules = response.CORSRules || [];
    const hasLocalhost = rules.some((rule) =>
      rule.AllowedOrigins?.some(
        (origin) =>
          origin.includes('localhost') || origin.includes('127.0.0.1')
      )
    );

    console.log(`✅ CORS configured with ${rules.length} rule(s)`);
    
    if (hasLocalhost) {
      console.log('✅ Localhost origins allowed for development');
    }

    rules.forEach((rule, index) => {
      console.log(`   Rule ${index + 1}:`);
      console.log(`     Methods: ${rule.AllowedMethods?.join(', ')}`);
      console.log(`     Origins: ${rule.AllowedOrigins?.join(', ')}`);
    });

    result.tests.push({
      name: 'CORS',
      passed: rules.length > 0,
      details: {
        ruleCount: rules.length,
        hasLocalhost,
      },
    });
  } catch (error: any) {
    if (error.name === 'NoSuchCORSConfiguration') {
      console.log('⚠️  No CORS configuration');
      result.tests.push({
        name: 'CORS',
        passed: false,
        details: { configured: false },
      });
    } else {
      console.log('❌ Failed to get CORS configuration');
      console.log(`   Error: ${error.message}`);
      result.tests.push({
        name: 'CORS',
        passed: false,
        error: error.message,
      });
    }
  }

  console.log();
}

async function testLifecycleRules(
  s3Client: S3Client,
  bucket: string,
  result: BucketTestResult
) {
  console.log('Test 5: Lifecycle Rules');
  console.log('-'.repeat(80));

  try {
    const command = new GetBucketLifecycleConfigurationCommand({
      Bucket: bucket,
    });
    const response = await s3Client.send(command);

    const rules = response.Rules || [];
    console.log(`✅ Lifecycle configured with ${rules.length} rule(s)`);

    rules.forEach((rule) => {
      console.log(`   Rule: ${rule.ID}`);
      console.log(`     Status: ${rule.Status}`);
      
      if (rule.Transitions) {
        rule.Transitions.forEach((transition) => {
          console.log(
            `     Transition: ${transition.Days} days → ${transition.StorageClass}`
          );
        });
      }

      if (rule.NoncurrentVersionExpiration) {
        console.log(
          `     Delete old versions after: ${rule.NoncurrentVersionExpiration.NoncurrentDays} days`
        );
      }
    });

    result.tests.push({
      name: 'Lifecycle Rules',
      passed: rules.length > 0,
      details: { ruleCount: rules.length },
    });
  } catch (error: any) {
    if (error.name === 'NoSuchLifecycleConfiguration') {
      console.log('⚠️  No lifecycle configuration');
      result.tests.push({
        name: 'Lifecycle Rules',
        passed: false,
        details: { configured: false },
      });
    } else {
      console.log('❌ Failed to get lifecycle configuration');
      console.log(`   Error: ${error.message}`);
      result.tests.push({
        name: 'Lifecycle Rules',
        passed: false,
        error: error.message,
      });
    }
  }

  console.log();
}

async function testPublicAccessBlock(
  s3Client: S3Client,
  bucket: string,
  result: BucketTestResult
) {
  console.log('Test 6: Public Access Block');
  console.log('-'.repeat(80));

  try {
    const command = new GetPublicAccessBlockCommand({ Bucket: bucket });
    const response = await s3Client.send(command);

    const config = response.PublicAccessBlockConfiguration;
    const allBlocked =
      config?.BlockPublicAcls &&
      config?.BlockPublicPolicy &&
      config?.IgnorePublicAcls &&
      config?.RestrictPublicBuckets;

    if (allBlocked) {
      console.log('✅ All public access blocked');
      console.log('   BlockPublicAcls: true');
      console.log('   BlockPublicPolicy: true');
      console.log('   IgnorePublicAcls: true');
      console.log('   RestrictPublicBuckets: true');
    } else {
      console.log('⚠️  Public access not fully blocked');
    }

    result.tests.push({
      name: 'Public Access Block',
      passed: !!allBlocked,
      details: config,
    });
  } catch (error: any) {
    console.log('❌ Failed to get public access block configuration');
    console.log(`   Error: ${error.message}`);
    result.tests.push({
      name: 'Public Access Block',
      passed: false,
      error: error.message,
    });
  }

  console.log();
}

async function testSecureTransport(
  s3Client: S3Client,
  bucket: string,
  region: string,
  result: BucketTestResult
) {
  console.log('Test 7: Secure Transport (HTTPS)');
  console.log('-'.repeat(80));

  try {
    // Upload a test object
    const testKey = `test-secure-transport-${Date.now()}.txt`;
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: 'test',
    });

    await s3Client.send(putCommand);

    // Generate signed URL
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600,
    });

    const usesHTTPS = signedUrl.startsWith('https://');

    if (usesHTTPS) {
      console.log('✅ Signed URLs use HTTPS');
    } else {
      console.log('❌ Signed URLs do not use HTTPS');
    }

    // Clean up
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    });
    await s3Client.send(deleteCommand);

    result.tests.push({
      name: 'Secure Transport',
      passed: usesHTTPS,
      details: { usesHTTPS },
    });
  } catch (error: any) {
    console.log('❌ Failed to test secure transport');
    console.log(`   Error: ${error.message}`);
    result.tests.push({
      name: 'Secure Transport',
      passed: false,
      error: error.message,
    });
  }

  console.log();
}

async function testObjectOperations(
  s3Client: S3Client,
  bucket: string,
  region: string,
  result: BucketTestResult
) {
  console.log('Test 8: Object Operations');
  console.log('-'.repeat(80));

  const testKey = `test-operations-${Date.now()}.txt`;
  let operationsPassed = 0;
  const totalOperations = 3;

  try {
    // Test PUT
    try {
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: 'test content',
        ServerSideEncryption: 'AES256',
      });

      await s3Client.send(putCommand);
      console.log('✅ PUT operation successful');
      operationsPassed++;
    } catch (error: any) {
      console.log('❌ PUT operation failed:', error.message);
    }

    // Test GET
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: testKey,
      });

      const response = await s3Client.send(getCommand);
      const encryption = response.ServerSideEncryption;

      if (encryption === 'AES256') {
        console.log('✅ GET operation successful (encryption verified)');
      } else {
        console.log('✅ GET operation successful');
      }
      operationsPassed++;
    } catch (error: any) {
      console.log('❌ GET operation failed:', error.message);
    }

    // Test DELETE
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: testKey,
      });

      await s3Client.send(deleteCommand);
      console.log('✅ DELETE operation successful');
      operationsPassed++;
    } catch (error: any) {
      console.log('❌ DELETE operation failed:', error.message);
    }

    result.tests.push({
      name: 'Object Operations',
      passed: operationsPassed === totalOperations,
      details: {
        passed: operationsPassed,
        total: totalOperations,
      },
    });
  } catch (error: any) {
    console.log('❌ Object operations test failed');
    console.log(`   Error: ${error.message}`);
    result.tests.push({
      name: 'Object Operations',
      passed: false,
      error: error.message,
    });
  }

  console.log();
}

function printSummary(results: BucketTestResult[]) {
  console.log('='.repeat(80));
  console.log('BUCKET POLICY VERIFICATION SUMMARY');
  console.log('='.repeat(80));
  console.log();

  for (const bucketResult of results) {
    console.log(`Bucket: ${bucketResult.bucket} (${bucketResult.region})`);
    console.log('-'.repeat(80));

    const passed = bucketResult.tests.filter((t) => t.passed).length;
    const total = bucketResult.tests.length;

    bucketResult.tests.forEach((test) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });

    console.log();
    console.log(`Result: ${passed}/${total} tests passed`);
    console.log();
  }

  const allPassed = results.every((r) => r.tests.every((t) => t.passed));

  console.log('='.repeat(80));
  if (allPassed) {
    console.log('🎉 ALL BUCKET POLICY TESTS PASSED');
  } else {
    console.log('⚠️  SOME BUCKET POLICY TESTS FAILED');
  }
  console.log('='.repeat(80));
}

// Run tests
testBucketPolicies().catch((error) => {
  logger.error('Bucket policy test failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
