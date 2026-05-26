import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/stacks/api';

describe('ApiStack', () => {
  let devTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const devStack = new ApiStack(app, 'dev-api', {
      stageName: 'dev',
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    const prodStack = new ApiStack(app, 'prod-api', {
      stageName: 'prod',
      env: { account: '123456789012', region: 'ap-northeast-1' },
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
        FunctionName: 'dev-profile-chat-ai-api',
      });
    });

    test('prod function has correct name', () => {
      prodTemplate.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'prod-profile-chat-ai-api',
      });
    });

    test('uses ARM64 architecture', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64'],
      });
    });

    test('has 512MB memory', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 512,
      });
    });

    test('has 30 second timeout', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 30,
      });
    });

    test('has correct environment variables', () => {
      devTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            AWS_LWA_PORT: '8000',
            DYNAMODB_TABLE_COUNT: 'dev-user_chat_count',
            DYNAMODB_TABLE_HISTORY: 'dev-user_chat_history',
            TRIAL_CHAT_LIMIT: '5',
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
    test('has DynamoDB permissions for dev tables', () => {
      devTemplate.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
              ],
              Effect: 'Allow',
              Resource: [
                'arn:aws:dynamodb:ap-northeast-1:123456789012:table/dev-user_chat_count',
                'arn:aws:dynamodb:ap-northeast-1:123456789012:table/dev-user_chat_history',
              ],
            }),
          ]),
        },
      });
    });

    test('has Secrets Manager permissions', () => {
      devTemplate.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'secretsmanager:GetSecretValue',
              Effect: 'Allow',
              Resource:
                'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:dev/profile-chat-ai-api/*',
            }),
          ]),
        },
      });
    });
  });
});
