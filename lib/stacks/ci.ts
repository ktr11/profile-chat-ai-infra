import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class CiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'ci-github-actions-role',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub':
            'repo:ktr11/profile-chat-ai-infra:ref:refs/heads/main',
        },
      }),
      inlinePolicies: {
        AssumeBootstrapRoles: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['sts:AssumeRole'],
              resources: ['arn:aws:iam::*:role/cdk-hnb659fds-*'],
            }),
          ],
        }),
      },
    });

    const repository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: 'profile-chat-ai-api',
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const apiRole = new iam.Role(this, 'ApiGitHubActionsRole', {
      roleName: 'ci-api-github-actions-role',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub':
            'repo:ktr11/profile-chat-ai-api:ref:refs/heads/main',
        },
      }),
    });

    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );

    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
        ],
        resources: [repository.repositoryArn],
      }),
    );

    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:UpdateFunctionCode', 'lambda:GetFunction'],
        resources: [
          cdk.Arn.format(
            { service: 'lambda', resource: 'function', resourceName: '*-profile-chat-ai-api' },
            this,
          ),
        ],
      }),
    );
  }
}
