# 作業記録

## 背景・目的

[profile-chat-ai-docs #10](https://github.com/ktr11/profile-chat-ai-docs/issues/10) の対応として、
cognito-local をやめて本番 AWS Cognito をローカルでも使うために、AWS インフラをコード化する。

---

## 決定事項

### IaC ツール
- **AWS CDK（TypeScript）** を採用
- TypeScript / Next.js 環境と親和性が高いため

### リポジトリ
- **`profile-chat-ai-infra`**（このリポジトリ）を新規作成して管理

### スタック構成
- CDK スタックは **dev / prod の 2 つ**
- ローカル開発・CI（GitHub Actions）は dev スタックの AWS リソースを `.env` で参照するだけでスタックは追加しない

### 管理対象リソース（予定）
- Amazon Cognito（User Pool）
- Amazon DynamoDB（LangGraph チェックポインター）
- Amazon S3 Vectors（RAG ストア）
- IAM ロール / ポリシー

---

## 完了した作業（2026-05-05）

- [x] `cdk init app --language typescript` で初期構成を生成
- [x] initial commit（`1e7f306`）

## 完了した作業（2026-05-08）

- [x] ディレクトリ構成を整理
  - `lib/stacks/auth.ts` / `storage.ts` / `iam.ts` の雛形を作成
  - `lib/stage.ts` に `AppStage` を定義（Auth / Storage / Iam スタックを束ねる）
  - `bin/app.ts` で Dev / Prod の 2 ステージをインスタンス化
  - `cdk.json` のエントリポイントを `bin/app.ts` に更新
  - 古い `lib/profile-chat-ai-infra-stack.ts` / `bin/profile-chat-ai-infra.ts` / `test/profile-chat-ai-infra.test.ts` を削除
  - `npm run build` でコンパイルエラーなし確認済み

---

## 次回以降の作業

### 1. GitHub に push

```bash
git push origin main
```

### 2. CDK Bootstrap（初回のみ）

```bash
cdk bootstrap aws://<ACCOUNT_ID>/ap-northeast-1
```

### 3. dev スタックをデプロイして動作確認

```bash
npx cdk deploy 'dev/**'
```

### 4. profile-chat-ai-fe の `.env.local` を本番 Cognito に向ける

デプロイ後に出力される User Pool ID / Client ID を `.env.local` に設定し、
cognito-local 関連の設定を削除する。
