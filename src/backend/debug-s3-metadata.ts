/**
 * Debug script to inspect S3 metadata and identify issues
 */

import dotenv from 'dotenv';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config();

async function debugS3Metadata() {
  console.log('\n=== Debugging S3 Metadata ===\n');

  try {
    const s3BucketUsEast1 = process.env.S3_BUCKET_US_EAST_1;
    
    if (!s3BucketUsEast1) {
      console.error('❌ S3_BUCKET_US_EAST_1 not configured');
      return;
    }

    console.log(`Bucket: ${s3BucketUsEast1}`);

    const client = new S3Client({ region: 'us-east-1' });

    // List metadata files
    console.log('\n--- Listing Metadata Files ---');
    const listCommand = new ListObjectsV2Command({
      Bucket: s3BucketUsEast1,
      Prefix: 'metadata/'
    });

    const listResponse = await client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('⚠️  No metadata files found');
      return;
    }

    console.log(`Found ${listResponse.Contents.length} metadata files`);

    // Read first metadata file
    const firstMetadataKey = listResponse.Contents[0].Key;
    console.log(`\nReading metadata file: ${firstMetadataKey}`);

    const getCommand = new GetObjectCommand({
      Bucket: s3BucketUsEast1,
      Key: firstMetadataKey!
    });

    const getResponse = await client.send(getCommand);
    const body = await getResponse.Body?.transformToString();

    if (!body) {
      console.error('❌ Empty metadata file');
      return;
    }

    console.log('\n--- Metadata Content ---');
    const metadata = JSON.parse(body);
    console.log(JSON.stringify(metadata, null, 2));

    // Check for issues
    console.log('\n--- Validation ---');
    
    if (!metadata.imageUrl || metadata.imageUrl === '') {
      console.error('❌ imageUrl is empty or missing');
    } else if (metadata.imageUrl.startsWith('s3://')) {
      console.log('✅ imageUrl has S3 URL format');
      console.log(`   URL: ${metadata.imageUrl}`);
    } else {
      console.warn('⚠️  imageUrl does not have S3 URL format');
      console.log(`   URL: ${metadata.imageUrl}`);
    }

    if (!metadata.id) {
      console.error('❌ id is missing');
    } else {
      console.log(`✅ id: ${metadata.id}`);
    }

    if (!metadata.modelId) {
      console.error('❌ modelId is missing');
    } else {
      console.log(`✅ modelId: ${metadata.modelId}`);
    }

    if (!metadata.region) {
      console.error('❌ region is missing');
    } else {
      console.log(`✅ region: ${metadata.region}`);
    }

    // Check corresponding image file
    console.log('\n--- Checking Image File ---');
    const imageKey = firstMetadataKey!.replace('metadata/', '').replace('.json', '.png');
    console.log(`Expected image key: ${imageKey}`);

    try {
      const headCommand = new GetObjectCommand({
        Bucket: s3BucketUsEast1,
        Key: imageKey
      });
      await client.send(headCommand);
      console.log('✅ Image file exists');
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        console.error('❌ Image file does not exist');
      } else {
        console.error(`❌ Error checking image file: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Debug failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run debug
debugS3Metadata();
