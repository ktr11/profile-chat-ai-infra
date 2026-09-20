## CDK スタック構成

- `CiStack`: 環境非依存の CI リソース（OIDC、IAM ロール、ECR）
- `AppStage` (`dev` / `prod`): 環境ごとのリソース群
  - `StorageStack`: DynamoDB テーブル
  - `IamStack`: 環境固有の IAM（現在空）
  - `ApiStack`: Lambda + Function URL
  - `FeStack`: Next.js Lambda + Function URL + CloudFront（OAC）。API の Function URL を環境変数と `lambda:InvokeFunctionUrl` 権限で受け取る

## CDK コーディング規約

- スタックの Props に `stageName: 'dev' | 'prod'` を持たせて環境分岐する
- リソース名は `${stageName}-` プレフィックスで統一（例: `dev-profile-chat-ai-api`）
- `removalPolicy: RETAIN` をステートフルリソース（DynamoDB、ECR）に設定する
- テストはスナップショット + fine-grained assertions の両方を書く
- assertions には CDK の `Match` モジュールを使う（jest の `expect.arrayContaining` は `hasResourceProperties` と非互換）
