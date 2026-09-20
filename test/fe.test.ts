import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/stacks/api';
import { FeStack } from '../lib/stacks/fe';

describe('FeStack', () => {
  let devTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const env = { account: '123456789012', region: 'ap-northeast-1' };
    const devApiStack = new ApiStack(app, 'dev-api', { stageName: 'dev', env });
    const prodApiStack = new ApiStack(app, 'prod-api', { stageName: 'prod', env });
    const devStack = new FeStack(app, 'dev-fe', {
      stageName: 'dev',
      apiFunctionUrl: devApiStack.functionUrl,
      env,
    });
    const prodStack = new FeStack(app, 'prod-fe', {
      stageName: 'prod',
      apiFunctionUrl: prodApiStack.functionUrl,
      env,
    });
    devTemplate = Template.fromStack(devStack);
    prodTemplate = Template.fromStack(prodStack);
  });

  describe('snapshot', () => {
    test('dev', () => {
      expect(devTemplate.toJSON()).toMatchSnapshot();
    });

    test('prod', () => {
      expect(prodTemplate.toJSON()).toMatchSnapshot();
    });
  });

  describe('Lambda function', () => {
    test('dev function has correct name', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'dev-profile-chat-ai-fe',
      });
    });

    test('prod function has correct name', () => {
      prodTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'prod-profile-chat-ai-fe',
      });
    });

    test('uses ARM64 architecture', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64'],
      });
    });

    test('has LWA streaming environment variables', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            AWS_LWA_PORT: '3000',
            AWS_LWA_INVOKE_MODE: 'response_stream',
            PYTHON_API_URL: Match.anyValue(),
          },
        },
      });
    });
  });

  describe('Function URL', () => {
    test('has AWS_IAM auth type with response streaming', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Url', {
        AuthType: 'AWS_IAM',
        InvokeMode: 'RESPONSE_STREAM',
      });
    });
  });

  describe('execution role permissions', () => {
    test('can invoke the API function URL', () => {
      devTemplate.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'lambda:InvokeFunctionUrl',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('CloudFront distribution', () => {
    test('default behavior disables caching and allows all methods', () => {
      devTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          DefaultCacheBehavior: Match.objectLike({
            // CachePolicy CACHING_DISABLED のマネージドポリシーID
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
            ViewerProtocolPolicy: 'redirect-to-https',
            AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
          }),
        }),
      });
    });

    test('caches /_next/static/* with optimized policy', () => {
      devTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/_next/static/*',
              // CachePolicy CACHING_OPTIMIZED のマネージドポリシーID
              CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
            }),
          ]),
        }),
      });
    });

    test('origin uses OAC for the function URL', () => {
      devTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          Origins: Match.arrayWith([
            Match.objectLike({
              OriginAccessControlId: Match.anyValue(),
            }),
          ]),
        }),
      });
    });
  });
});
