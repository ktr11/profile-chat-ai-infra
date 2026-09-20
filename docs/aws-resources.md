# AWS リソース設計

## リソース一覧

| サービス | リソース名 | 用途 |
|---------|-----------|------|
| Amazon DynamoDB | `{stage}-user_chat_count` | 1日あたりのチャット回数管理 |
| Amazon DynamoDB | `{stage}-user_chat_history` | ユーザーとの会話履歴保存 |
| AWS Lambda | `{stage}-profile-chat-ai-api` | FastAPI バックエンド（コンテナ + LWA、Function URL: AWS_IAM / streaming） |
| AWS Lambda | `{stage}-profile-chat-ai-fe` | Next.js FE/BFF（コンテナ + LWA、Function URL: AWS_IAM / streaming） |
| Amazon CloudFront | `{stage}-profile-chat-ai-fe` | FE/BFF の前段（OAC で FE Function URL に接続） |
| Amazon ECR | `profile-chat-ai-api` / `profile-chat-ai-fe` | コンテナイメージ（直近10世代保持） |
| AWS IAM | `ci-github-actions-role` / `ci-api-github-actions-role` / `ci-fe-github-actions-role` | GitHub Actions OIDC 用（リポ別に分離） |

`{stage}` は `dev` または `prod`。

## DynamoDB テーブル設計

### user_chat_count

日次のチャット送信回数を管理します。TTL でレコードを自動削除します。

| 属性 | 型 | 説明 |
|------|-----|------|
| `trial_uuid` (PK) | String | トライアルユーザーの UUID |
| `date` (SK) | String | 日付（JST ベース、例: `2025-05-18`） |
| `ttl` | Number | TTL（翌日 0:00 JST の UNIX タイムスタンプ） |

- 課金モード: PAY_PER_REQUEST（オンデマンド）
- TTL 有効

### user_chat_history

チャットの会話履歴を保存します。

| 属性 | 型 | 説明 |
|------|-----|------|
| `trial_uuid` (PK) | String | トライアルユーザーの UUID |
| `timestamp` (SK) | Number | メッセージのタイムスタンプ |

- 課金モード: PAY_PER_REQUEST（オンデマンド）
- prod 環境のみ Point-in-Time Recovery 有効

## デプロイ済み/未デプロイ

| 機能 | 状態 | 備考 |
|------|------|------|
| DynamoDB テーブル（上記2つ） | デプロイ済み | `StorageStack` |
| API Lambda + Function URL | デプロイ済み | `ApiStack` |
| FE Lambda + Function URL + CloudFront | CDK 定義済み（未デプロイ） | `FeStack`。初回は ECR ダミーイメージ push が必要（docs#37 コメント参照） |
| CI リソース（OIDC / IAM ロール / ECR） | デプロイ済み | `CiStack` |
| IAM ロール・ポリシー | スタック定義済み（中身は空） | `IamStack` |
| Cognito UserPool | CDK 定義済み（Stage から未参照） | `AuthStack`（`.ts` ソース削除済み、`.js` のみ残存） |
| Route 53 / ACM（独自ドメイン） | **未実装** | docs#37 で対応予定 |
| S3 / S3 Vectors | **未実装** | RAG 実装時に追加予定 |
| Bedrock 関連 | **未実装** | LLM 統合時に追加予定 |

## リージョン

デフォルト: `ap-northeast-1`（環境変数 `CDK_DEFAULT_REGION` で上書き可能）
