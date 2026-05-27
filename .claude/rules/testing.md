## テスト方針

- 全スタックにスナップショットテストを書く（意図しない変更の検知）
- 重要な不変条件には fine-grained assertions を書く（テーブル名、キースキーマ、IAM 条件等）
- CDK assertions の `Match.arrayWith()` / `Match.objectLike()` を使う
- テストで env を渡す場合は `{ account: '123456789012', region: 'ap-northeast-1' }` を使う

## 依存関係

- jest@29 + ts-jest@29 の組み合わせを使う（jest@30 は ts-jest が未対応）
- `@aws-cdk/cloud-assembly-api` は aws-cdk-lib@2.253+ で必要
- tsconfig.json に `"types": ["node", "jest"]` を指定する（typeRoots 指定時は必須）
