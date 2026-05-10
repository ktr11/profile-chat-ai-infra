import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StorageStack } from './stacks/storage';
import { IamStack } from './stacks/iam';

export class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    new StorageStack(this, 'Storage', { ...props, stageName: id as 'dev' | 'prod' });
    new IamStack(this, 'Iam', props);
  }
}
