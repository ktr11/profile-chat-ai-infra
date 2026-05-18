# profile-chat-ai-infra

AIチャット搭載ポートフォリオアプリ「profile-chat-ai」の **AWS インフラ定義（CDK）** リポジトリです。

## 概要

AWS CDK (TypeScript) で DynamoDB テーブルや IAM ポリシーを定義しています。`dev` / `prod` の2環境をサポート。

## 技術スタック

| 項目 | 内容 |
|-----|------|
| IaC | AWS CDK v2 (TypeScript) |
| リージョン | ap-northeast-1（デフォルト） |
| 主なリソース | DynamoDB（チャットカウント・履歴） |

## クイックスタート

```bash
# 依存関係インストール
npm install

# TypeScript コンパイル
npm run build

# 差分確認
npx cdk diff 'dev/*'

# デプロイ（dev 環境）
npx cdk deploy 'dev/*'
```

## 主要コマンド

```bash
npm run build      # TypeScript コンパイル
npm run watch      # ファイル変更監視 + コンパイル
npm run test       # Jest テスト実行
npx cdk diff       # 差分確認
npx cdk deploy     # デプロイ
npx cdk synth      # CloudFormation テンプレート出力
```

## ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [AWS リソース設計](./docs/aws-resources.md) | DynamoDB テーブル設計・リソース一覧 |
| [CDK インフラ定義ガイド](./docs/cdk-guide.md) | スタック構成・デプロイ手順 |
| [システム全体構成](https://github.com/ktr11/profile-chat-ai-docs/blob/main/docs/architecture/overall.md) | プロジェクト横断のアーキテクチャ図 |
