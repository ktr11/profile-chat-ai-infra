import * as cdk from 'aws-cdk-lib/core';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  stageName: 'dev' | 'prod';
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stageName } = props;
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const repository = ecr.Repository.fromRepositoryName(this, 'EcrRepo', 'profile-chat-ai-api');

    const fn = new lambda.DockerImageFunction(this, 'ApiFunction', {
      functionName: `${stageName}-profile-chat-ai-api`,
      code: lambda.DockerImageCode.fromEcr(repository, {
        tagOrDigest: `${stageName}-latest`,
      }),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        AWS_LWA_PORT: '8000',
        DYNAMODB_TABLE_COUNT: `${stageName}-user_chat_count`,
        DYNAMODB_TABLE_HISTORY: `${stageName}-user_chat_history`,
        TRIAL_CHAT_LIMIT: '5',
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        resources: [
          `arn:aws:dynamodb:${region}:${accountId}:table/${stageName}-user_chat_count`,
          `arn:aws:dynamodb:${region}:${accountId}:table/${stageName}-user_chat_history`,
        ],
      }),
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${region}:${accountId}:secret:${stageName}/profile-chat-ai-api/*`,
        ],
      }),
    );

    fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });
  }
}
