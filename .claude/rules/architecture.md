## アーキテクチャ方針

- dev と prod は同一構成を原則とする（構成差分は保守の負債になる）
- API は BFF からのみ呼び出す。Function URL の `AUTH_TYPE: AWS_IAM` で保護し、BFF の IAM ロールに `lambda:InvokeFunctionUrl` を付与する
- CloudFront は User → FE/BFF の前段に置く。API の前段には置かない
- シークレットは Secrets Manager で管理し、Lambda 実行時に取得する。CDK では権限付与のみ行う
- 環境変数は全て CDK 管理（API リポ側から UpdateFunctionConfiguration しない）
- Lambda Web Adapter (LWA) はコンテナイメージ内に COPY で含める（コンテナイメージ Lambda はレイヤー非対応）

## デプロイ順序

- `ci` スタック → `dev/*` の順にデプロイする（ci 側リソースへの暗黙の依存があるため）
- infra リポのマージ: Lambda の「箱」（設定）をデプロイ
- API リポのマージ: Lambda のコード（ECR イメージ）を更新
