# ECR 初回ダミーイメージ push 手順

Lambda (DockerImageFunction) の初回デプロイ時、参照先の ECR イメージが存在しないためデプロイが失敗する。
この手順でダミーイメージを push してから CDK デプロイを再実行する。

## 発生したエラー

### 1. イメージが存在しない

```
❌  dev-Api failed: DeploymentError: Resource updates failed:
 └─ ApiFunction (AWS::Lambda::Function)
    🛑 Source image ***.dkr.ecr.ap-northeast-1.amazonaws.com/profile-chat-ai-api:dev-latest
       does not exist. Provide a valid source image.
```

→ ECR にイメージを push してから再デプロイする。

### 2. イメージマニフェスト形式が非対応

```
❌  dev-Api failed: DeploymentError: Resource updates failed:
 └─ ApiFunction (AWS::Lambda::Function)
    🛑 The image manifest, config or layer media type for the source image
       ***.dkr.ecr.ap-northeast-1.amazonaws.com/profile-chat-ai-api:dev-latest is not supported.
```

→ buildx のデフォルト（OCI イメージインデックス）は Lambda 非対応。`--provenance=false --output type=docker` で Docker マニフェスト v2 形式にする。

## 前提

- AWS CLI が設定済み
- Docker が起動している
- `<AWS_ACCOUNT>` を自分の AWS アカウント ID に置き換える

## 手順

```bash
# 1. ECR にログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. Dockerfile を作成
cat <<'DOCKERFILE' > ./tmp/Dockerfile.dummy
FROM --platform=linux/arm64 public.ecr.aws/lambda/python:3.12
COPY <<'HANDLER' ${LAMBDA_TASK_ROOT}/lambda_function.py
def handler(event, context):
    return {"statusCode": 200, "body": "ok"}
HANDLER
CMD ["lambda_function.handler"]
DOCKERFILE

# 3. buildx で Docker マニフェスト v2 形式でビルド
docker buildx build --platform linux/arm64 \
  --provenance=false --output type=docker \
  -t <AWS_ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com/profile-chat-ai-api:dev-latest \
  -f ./tmp/Dockerfile.dummy ./tmp

# 4. push
docker push <AWS_ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com/profile-chat-ai-api:dev-latest
```

## push 後

GitHub Actions の `deploy-dev` ワークフローを手動実行（workflow_dispatch）するか、空コミットで再トリガーする。

## トラブルシューティング

### エラー: `The repository with name 'profile-chat-ai-api' does not exist`

ECR リポジトリは `ci` スタックに定義されているが、`deploy-dev.yml` が `dev/*` のみデプロイしていた場合に発生する。
先に `ci` スタックをデプロイする。

```bash
pnpm cdk deploy ci
```

### エラー: `The image manifest, config or layer media type for the source image is not supported`

buildx がデフォルトで生成する OCI イメージインデックス（マルチプラットフォームマニフェスト）を Lambda が受け付けないために発生する。
ビルド時に `--provenance=false --output type=docker` を指定して従来の Docker マニフェスト v2 形式で出力する必要がある。

```bash
# NG: デフォルトの buildx ビルド
docker build --platform linux/arm64 -t dummy-api .

# OK: Docker マニフェスト v2 形式を明示
docker buildx build --platform linux/arm64 \
  --provenance=false --output type=docker \
  -t <AWS_ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com/profile-chat-ai-api:dev-latest \
  -f /tmp/Dockerfile.dummy /tmp
```
