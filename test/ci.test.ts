import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CiStack } from '../lib/stacks/ci';

describe('CiStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new CiStack(app, 'ci', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    template = Template.fromStack(stack);
  });

  describe('snapshot', () => {
    test('matches snapshot', () => {
      expect(template.toJSON()).toMatchSnapshot();
    });
  });

  describe('ECR repository', () => {
    test('creates profile-chat-ai-api repository', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'profile-chat-ai-api',
      });
    });

    test('has lifecycle rule keeping last 10 images', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        LifecyclePolicy: {
          LifecyclePolicyText: JSON.stringify({
            rules: [
              {
                rulePriority: 1,
                description: 'Keep last 10 images',
                selection: {
                  tagStatus: 'any',
                  countType: 'imageCountMoreThan',
                  countNumber: 10,
                },
                action: { type: 'expire' },
              },
            ],
          }),
        },
      });
    });
  });

  describe('API GitHub Actions role', () => {
    test('creates ci-api-github-actions-role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'ci-api-github-actions-role',
      });
    });

    test('trusts profile-chat-ai-api main branch only', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'ci-api-github-actions-role',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                },
                StringLike: {
                  'token.actions.githubusercontent.com:sub':
                    'repo:ktr11/profile-chat-ai-api:ref:refs/heads/main',
                },
              },
              Effect: 'Allow',
              Principal: {
                Federated: Match.anyValue(),
              },
            },
          ],
          Version: '2012-10-17',
        },
      });
    });

    test('has ECR push permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'ecr:BatchCheckLayerAvailability',
                'ecr:PutImage',
                'ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart',
                'ecr:CompleteLayerUpload',
              ],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('has Lambda update permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['lambda:UpdateFunctionCode', 'lambda:GetFunction'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('FE ECR repository', () => {
    test('creates profile-chat-ai-fe repository', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'profile-chat-ai-fe',
      });
    });
  });

  describe('FE GitHub Actions role', () => {
    test('creates ci-fe-github-actions-role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'ci-fe-github-actions-role',
      });
    });

    test('trusts profile-chat-ai-fe main branch only', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'ci-fe-github-actions-role',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                },
                StringLike: {
                  'token.actions.githubusercontent.com:sub':
                    'repo:ktr11/profile-chat-ai-fe:ref:refs/heads/main',
                },
              },
              Effect: 'Allow',
              Principal: {
                Federated: Match.anyValue(),
              },
            },
          ],
          Version: '2012-10-17',
        },
      });
    });

    test('has Lambda update permissions scoped to fe function', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['lambda:UpdateFunctionCode', 'lambda:GetFunction'],
              Effect: 'Allow',
              Resource: {
                'Fn::Join': [
                  '',
                  Match.arrayWith([
                    Match.stringLikeRegexp('function:\\*-profile-chat-ai-fe'),
                  ]),
                ],
              },
            }),
          ]),
        },
      });
    });
  });
});
