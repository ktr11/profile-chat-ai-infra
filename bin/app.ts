#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AppStage } from '../lib/stage';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};

new AppStage(app, 'dev', { env });
new AppStage(app, 'prod', { env });
