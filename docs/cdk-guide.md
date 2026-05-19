# AWS CDK インフラ定義ガイド

## 概要

本プロジェクトのインフラは **AWS CDK (TypeScript)** で定義します。CDK を採用することで、インフラをコードとして管理し、型安全なリソース定義・差分デプロイ・ドリフト検出が可能になります。

## プロジェクト構成

```
├── bin/
│   └── app.ts              # CDK App エントリーポイント
├── lib/
│   ├── stage.ts            # AppStage（dev/prod 環境定義）
│   └── stacks/
│       ├── storage.ts      # DynamoDB テーブル定義
│       └── iam.ts          # IAM ロール・ポリシー（現在は空）
├── cdk.json
├── package.json
└── tsconfig.json
```

## スタック設計

### 環境分離（Stage）

`bin/app.ts` で `dev` と `prod` の2環境を定義しています。

```typescript
// bin/app.ts
const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};
new AppStage(app, 'dev', { env });
new AppStage(app, 'prod', { env });
```

### AppStage

各環境で作成されるスタックを定義します。

```typescript
// lib/stage.ts
export class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);
    new StorageStack(this, 'Storage', { ...props, stageName: id as 'dev' | 'prod' });
    new IamStack(this, 'Iam', props);
  }
}
```

### StorageStack

DynamoDB テーブルを定義します。テーブル名に `{stage}-` プレフィックスを付与して環境を分離しています。

- `{stage}-user_chat_count` — チャット回数制限
- `{stage}-user_chat_history` — 会話履歴

詳細は [aws-resources.md](./aws-resources.md) を参照。

### IamStack

IAM ロール・ポリシー用のスタック。現在は空です。Lambda 追加時にここにポリシーを定義する予定。

## デプロイ手順

```bash
# 依存関係インストール
pnpm install

# 差分確認
pnpm cdk diff 'dev/*'

# デプロイ（dev 環境）
pnpm cdk deploy 'dev/*'

# デプロイ（prod 環境）
pnpm cdk deploy 'prod/*'
```

## テスト

```bash
pnpm test
```

### スナップショットテスト

CloudFormation テンプレート全体を前回の出力と比較し、意図しない変更を検知します（`cdk diff` を自動で毎回実行しているイメージ）。

**テストが落ちたときの運用:**

- 意図的な変更 → `pnpm test -- -u` でスナップショットを更新してコミット
- 意図しない変更 → コードを修正して差分をなくす

### Fine-grained assertion

スナップショットとは別に、壊れたら致命的なプロパティを個別に検証しています。

- テーブル名（アプリが直接参照するため）
- パーティションキー / ソートキー（変わるとクエリが全て壊れる）
- prod の PITR 設定（無効化されるとデータ復旧不可）
- removalPolicy: RETAIN（スタック削除時にテーブルが消えないこと）

## 今後の拡張予定

| スタック | 内容 | 時期 |
|---------|------|------|
| API スタック | Lambda + Function URL（FastAPI） | LLM 統合時 |
| RAG スタック | S3 Vectors + Bedrock Knowledge Bases | RAG 実装時 |
| Auth スタック | Cognito（定義済み・未接続） | 正式ログイン実装時 |
