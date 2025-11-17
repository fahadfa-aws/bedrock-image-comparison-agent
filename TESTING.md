# Integration and End-to-End Testing Guide

This document describes the integration and end-to-end tests for the Bedrock Image Comparison Agent.

## Overview

The test suite validates the complete user flow, error handling, multi-region functionality, and performance requirements. All tests are designed to run against real AWS services and require valid credentials.

## Prerequisites

Before running tests, ensure you have:

1. **Valid AWS Credentials**: Set in `.env` file
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_KNOWLEDGE_BASE_ID`

2. **IAM Permissions**: Your IAM user must have:
   - `bedrock:InvokeModel` for all models in both regions
   - `bedrock:Retrieve` for Knowledge Base access

3. **Dependencies Installed**: Run `npm install`

4. **Environment Variables**: Copy `.env.example` to `.env` and configure

## Test Suites

### 1. Complete User Flow Test

**File**: `src/backend/test-integration-user-flow.ts`

**Purpose**: Tests the end-to-end user journey from model selection to image comparison.

**What it tests**:
- Model selection and persistence
- Prompt optimization with Claude Sonnet 4.5
- Optimized prompt structure validation
- Concurrent image generation
- Image data verification
- Download and copy-to-clipboard functionality

**Requirements covered**: 3.5, 4.1, 5.1, 5.2, 5.5, 5.6

**Run with**:
```bash
npm run test:integration:user-flow
```

**Expected cost**: ~$0.08 (2 images)

**Expected duration**: 30-60 seconds

**Success criteria**:
- ✓ All 6 steps pass
- ✓ Optimization completes in < 10 seconds
- ✓ Images generated successfully
- ✓ All data structures are valid

---

### 2. Error Scenarios Test

**File**: `src/backend/test-integration-error-scenarios.ts`

**Purpose**: Validates error handling and recovery mechanisms.

**What it tests**:
- Invalid AWS credentials detection
- IAM permission validation (< 5 seconds)
- Model selection constraints (2-6 models)
- Invalid model ID rejection
- Content policy violation handling
- Rate limiting configuration
- Knowledge Assistant cache fallback

**Requirements covered**: 1.3, 2.4, 6.1, 6.3, 6.4

**Run with**:
```bash
npm run test:integration:errors
```

**Expected cost**: ~$0.04 (1 image for content policy test)

**Expected duration**: 20-40 seconds

**Success criteria**:
- ✓ Invalid credentials detected
- ✓ Permission validation < 5 seconds
- ✓ Model selection validation works
- ✓ Error messages are user-friendly
- ✓ Cache fallback mechanism available

---

### 3. Multi-Region Functionality Test

**File**: `src/backend/test-integration-multi-region.ts`

**Purpose**: Verifies correct multi-region Bedrock access and error isolation.

**What it tests**:
- Nova Canvas invocation in us-east-1
- Stability models invocation in us-west-2
- Concurrent generation across regions
- Error isolation (one failure doesn't affect others)
- Regional routing correctness

**Requirements covered**: 1.1, 1.2, 4.3, 4.4

**Run with**:
```bash
npm run test:integration:multi-region
```

**Expected cost**: ~$0.24 (6 images across multiple tests)

**Expected duration**: 60-120 seconds

**Success criteria**:
- ✓ Nova Canvas uses us-east-1
- ✓ Stability models use us-west-2
- ✓ Concurrent execution is efficient
- ✓ Error isolation prevents cascading failures

---

### 4. Performance Validation Test

**File**: `src/backend/test-integration-performance.ts`

**Purpose**: Validates performance requirements and timing constraints.

**What it tests**:
- Prompt optimization speed (< 10 seconds)
- Individual model generation speed (< 60 seconds)
- Concurrent generation with all 4 models
- End-to-end flow timing
- Concurrency efficiency

**Requirements covered**: 3.6, 4.6

**Run with**:
```bash
npm run test:integration:performance
```

**Expected cost**: ~$0.32 (8 images - individual + concurrent tests)

**Expected duration**: 120-180 seconds

**Success criteria**:
- ✓ Optimization < 10 seconds
- ✓ Each model generation < 60 seconds
- ✓ Concurrent execution shows time savings
- ✓ End-to-end flow < 90 seconds

---

## Running All Tests

To run all integration tests sequentially:

```bash
npm run test:integration:all
```

**Total expected cost**: ~$0.68
**Total expected duration**: 4-6 minutes

## Test Output

All tests use color-coded output:
- 🟢 **Green (✓)**: Test passed
- 🔴 **Red (✗)**: Test failed
- 🟡 **Yellow (⚠)**: Warning or acceptable deviation
- 🔵 **Blue**: Section headers
- 🔷 **Cyan (ℹ)**: Informational messages

## Understanding Test Results

### Success Indicators

A test is considered successful when:
1. All required assertions pass
2. Performance requirements are met
3. Error handling works correctly
4. Data structures are valid

### Acceptable Warnings

Some warnings are acceptable and don't indicate failure:
- Slightly longer optimization times (10-12 seconds)
- Partial generation failures due to AWS throttling
- Content policy tests not triggering violations
- Cache being empty on first run

### Common Failures

**Authentication Errors**:
- Check `.env` file has correct credentials
- Verify IAM user is active
- Ensure credentials have not expired

**Permission Errors**:
- Review IAM policy in `iam-policy.json`
- Verify permissions for both us-east-1 and us-west-2
- Check Knowledge Base permissions

**Timeout Errors**:
- Network latency may cause timeouts
- Try running tests again
- Check AWS service health status

**Generation Failures**:
- May be due to AWS throttling
- Check AWS account limits
- Verify model availability in regions

## Cost Management

### Estimated Costs per Test Run

| Test Suite | Images Generated | Approximate Cost |
|------------|------------------|------------------|
| User Flow | 2 | $0.08 |
| Error Scenarios | 1 | $0.04 |
| Multi-Region | 6 | $0.24 |
| Performance | 8 | $0.32 |
| **Total** | **17** | **$0.68** |

### Cost Breakdown by Model

- Nova Canvas: $0.04 per image
- Stable Diffusion XL: $0.04 per image
- Stable Image Core: $0.03 per image
- Stable Image Ultra: $0.08 per image

### Minimizing Costs

To reduce testing costs:

1. **Run specific tests**: Only run the test suite you need
2. **Use smaller images**: Modify test parameters to use 512x512 instead of 1024x1024
3. **Reduce model count**: Test with 2 models instead of all 4
4. **Mock responses**: For development, consider mocking AWS responses

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:integration:all
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_KNOWLEDGE_BASE_ID: ${{ secrets.AWS_KNOWLEDGE_BASE_ID }}
```

## Troubleshooting

### Tests Hang or Timeout

**Symptoms**: Test execution stops without completing

**Solutions**:
- Check network connectivity
- Verify AWS service availability
- Increase timeout values in `.env`
- Check for rate limiting

### All Tests Fail Immediately

**Symptoms**: Tests fail during service initialization

**Solutions**:
- Verify `.env` file exists and is configured
- Check AWS credentials are valid
- Ensure IAM permissions are correct
- Review error messages in console

### Inconsistent Results

**Symptoms**: Tests pass sometimes but fail other times

**Solutions**:
- AWS throttling may be occurring
- Network conditions may vary
- Try running tests during off-peak hours
- Check AWS service health dashboard

### Knowledge Assistant Errors

**Symptoms**: Tests fail with Knowledge Base errors

**Solutions**:
- Verify `AWS_KNOWLEDGE_BASE_ID` is correct
- Check Knowledge Base is in us-east-1
- Ensure IAM user has `bedrock:Retrieve` permission
- Tests will use cache fallback if KB is unavailable

## Best Practices

1. **Run tests in order**: Start with error scenarios, then user flow, then performance
2. **Monitor costs**: Keep track of AWS spending during testing
3. **Review logs**: Check Winston logs for detailed error information
4. **Test incrementally**: Test individual components before full integration
5. **Document failures**: Record any consistent failures for investigation
6. **Update tests**: Keep tests in sync with application changes

## Manual Testing

For manual testing of the frontend:

1. Start the backend: `npm run dev:backend`
2. Start the frontend: `npm run dev:frontend`
3. Open browser to `http://localhost:5173`
4. Follow the user flow:
   - Select 2-6 models
   - Enter a prompt
   - Review optimized prompts
   - Generate images
   - Compare results

## Support

If you encounter issues with tests:

1. Check this documentation first
2. Review error messages carefully
3. Verify AWS credentials and permissions
4. Check AWS service health status
5. Review application logs in `logs/` directory

## Future Enhancements

Potential test improvements:

- [ ] Add frontend E2E tests with Playwright or Cypress
- [ ] Add load testing for concurrent users
- [ ] Add visual regression testing for UI
- [ ] Add API contract tests
- [ ] Add security testing (OWASP)
- [ ] Add accessibility testing
- [ ] Mock AWS responses for unit tests
- [ ] Add test coverage reporting
