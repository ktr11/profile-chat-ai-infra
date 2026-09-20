import * as cdk from 'aws-cdk-lib/core';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface FeStackProps extends cdk.StackProps {
  stageName: 'dev' | 'prod';
  apiFunctionUrl: lambda.IFunctionUrl;
}

export class FeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FeStackProps) {
    super(scope, id, props);

    const { stageName, apiFunctionUrl } = props;

    const repository = ecr.Repository.fromRepositoryName(this, 'EcrRepo', 'profile-chat-ai-fe');

    const fn = new lambda.DockerImageFunction(this, 'FeFunction', {
      functionName: `${stageName}-profile-chat-ai-fe`,
      code: lambda.DockerImageCode.fromEcr(repository, {
        tagOrDigest: `${stageName}-latest`,
      }),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        AWS_LWA_PORT: '3000',
        AWS_LWA_INVOKE_MODE: 'response_stream',
        PYTHON_API_URL: apiFunctionUrl.url,
      },
    });

    apiFunctionUrl.grantInvokeUrl(fn);

    const functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // OAC 経由の POST/PUT はビューアーが x-amz-content-sha256 ヘッダーを付与する必要がある（FE 側で対応）
    const origin = origins.FunctionUrlOrigin.withOriginAccessControl(functionUrl);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${stageName}-profile-chat-ai-fe`,
      defaultBehavior: {
        origin,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });
  }
}
