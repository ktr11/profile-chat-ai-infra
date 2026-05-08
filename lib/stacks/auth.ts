import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${this.stackName}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: `${this.stackName}-client`,
      generateSecret: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    new secretsmanager.Secret(this, 'CognitoSecret', {
      secretName: `${this.stackName}/cognito`,
      secretObjectValue: {
        userPoolId: cdk.SecretValue.unsafePlainText(userPool.userPoolId),
        clientId: cdk.SecretValue.unsafePlainText(userPoolClient.userPoolClientId),
        clientSecret: userPoolClient.userPoolClientSecret,
      },
    });

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'SecretName', { value: `${this.stackName}/cognito` });
  }
}
