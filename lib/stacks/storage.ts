import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface StorageStackProps extends cdk.StackProps {
  stageName: 'dev' | 'prod';
}

export class StorageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const isProd = props.stageName === 'prod';
    const prefix = props.stageName;

    new dynamodb.Table(this, 'UserChatCount', {
      tableName: `${prefix}-user_chat_count`,
      partitionKey: { name: 'trial_uuid', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new dynamodb.Table(this, 'UserChatHistory', {
      tableName: `${prefix}-user_chat_history`,
      partitionKey: { name: 'trial_uuid', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
