#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AppStage } from '../lib/stage';
import { CiStack } from '../lib/stacks/ci';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};

new CiStack(app, 'ci', { env });
new AppStage(app, 'dev', { env });
new AppStage(app, 'prod', { env });
