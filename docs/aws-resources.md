# AWS リソース設計

## リソース一覧

| サービス | リソース名（例） | 用途 |
|---------|--------------|------|
| Amazon Bedrock | `anthropic.claude-haiku-3-5-v1:0` | チャット推論 |
| Amazon Bedrock | `amazon.titan-embed-text-v2:0` | RAG 埋め込み生成 |
| Amazon DynamoDB | `profile-chat-checkpoints` | LangGraph チェックポインター |
| Amazon S3 | `profile-chat-ai-state-{account}` | 大サイズ状態オフロード |
| Amazon S3 Vectors | `profile-chat-ai-vectors` | RAG ベクトルストア |
| AWS Lambda | `profile-chat-api` | FastAPI (Lambda Web Adapter) |
| Amazon ECR | `profile-chat-api` | Lambda コンテナイメージ |

## Bedrock — Claude Haiku 3.5 採用理由

### コスト比較（2024年時点）

| モデル | Input (1M tokens) | Output (1M tokens) | 採用判断 |
|-------|-----------------|------------------|---------|
| Claude Opus 3 | $15.00 | $75.00 | 過剰品質 |
| Claude Sonnet 3.5 | $3.00 | $15.00 | 中間 |
| **Claude Haiku 3.5** | **$0.80** | **$4.00** | **採用** |
| Claude Haiku 3 | $0.25 | $1.25 | 品質不足 |

Haiku 3.5 は Sonnet 3 相当の品質をコスト 1/4 以下で実現しており、ポートフォリオチャットのユースケース（一般的な Q&A・自己紹介応答）に最適です。

### Bedrock 固有の設定

```python
# LangChain から Bedrock を呼び出す際の設定
from langchain_aws import ChatBedrock

llm = ChatBedrock(
    model_id="anthropic.claude-haiku-3-5-v1:0",
    region_name="us-east-1",
    streaming=True,
    model_kwargs={
        "max_tokens": 4096,        # 出力上限（スロットリング対策）
        "temperature": 0.7,
        "anthropic_version": "bedrock-2023-05-31",
    },
)
```

```bash
# Claude Code 使用時のスロットリング対策
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=4096
```

### スロットリング対策

Bedrock はアカウントごとに TPM (Tokens Per Minute) 制限があります。

```python
from botocore.exceptions import ClientError
import time
import random

def invoke_with_retry(llm, messages, max_retries=3):
    """指数バックオフによる Bedrock スロットリング対策"""
    for attempt in range(max_retries):
        try:
            return llm.invoke(messages)
        except ClientError as e:
            if e.response["Error"]["Code"] == "ThrottlingException":
                wait = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait)
            else:
                raise
    raise Exception("Max retries exceeded")
```

## DynamoDB — LangGraph チェックポインター

### テーブル設計

```
Table: profile-chat-checkpoints
├── PK: thread_id (String)       # session_id に対応
├── SK: checkpoint_id (String)   # タイムスタンプ + UUID
├── TTL: expires_at (Number)     # 30日後に自動削除
├── state_size: Number           # 状態サイズ (bytes)
├── state_s3_uri: String?        # 350KB超の場合のS3 URI
└── checkpoint_data: Binary?     # 350KB以下の場合の状態データ
```

### langgraph-checkpoint-aws の使用

```python
from langgraph.checkpoint.aws.dynamodb import DynamoDBSaver

checkpointer = DynamoDBSaver(
    table_name="profile-chat-checkpoints",
    region_name="us-east-1",
)

# TTL 設定（30日）
checkpointer.ttl = 60 * 60 * 24 * 30
```

### 状態サイズと S3 オフロード設計

LangGraph の会話状態（メッセージ履歴・ツール実行ログ）は会話が長くなると肥大化します。

```
状態サイズの目安:
- 短い会話 (5ターン):  ~10KB
- 中程度 (20ターン):   ~80KB
- 長い会話 (50ターン): ~300KB
- 非常に長い (100ターン): ~600KB ← DynamoDB 400KB 制限超過
```

**オフロード戦略:**

```python
# カスタムチェックポインター（概念実装）
class S3OffloadingCheckpointer(DynamoDBSaver):
    OFFLOAD_THRESHOLD = 350_000  # 350KB

    async def aput(self, config, checkpoint, metadata):
        state_bytes = serialize(checkpoint)

        if len(state_bytes) > self.OFFLOAD_THRESHOLD:
            # S3 にオフロード
            s3_uri = await self._upload_to_s3(state_bytes, config["thread_id"])
            # DynamoDB には URI のみ保存
            await super().aput(config, {"s3_uri": s3_uri}, metadata)
        else:
            await super().aput(config, checkpoint, metadata)
```

## S3 Vectors — コスト効率

### 料金モデル（2024年）

```
書き込み: $0.04 / 1,000 vectors
読み込み: $0.04 / 1,000 vectors
ストレージ: $0.023 / GB / 月（通常 S3 と同等）
```

**コスト試算（月間 1,000 クエリ / 500 ベクトル登録）:**
```
クエリ費用: 1,000 × 0.04 / 1,000 = $0.04
登録費用: 500 × 0.04 / 1,000 = $0.02
ストレージ: 500 × 1,536 × 4 bytes ≈ 3MB → 約 $0.00007
合計: ≈ $0.06 / 月 ≈ 9円/月
```

## Lambda Web Adapter (LWA) — サーバーレス化

### LWA とは

Lambda Web Adapter は FastAPI などの通常の Web アプリを、**コード変更なし**で Lambda 上で動かすためのツールです。

```
従来のサーバーレス化:
FastAPI → Mangum (ASGI adapter) → Lambda ← 専用ライブラリが必要

LWA を使ったサーバーレス化:
FastAPI → コンテナ → Lambda (LWA) ← 変更不要
```

### Dockerfile

```dockerfile
FROM public.ecr.aws/docker/library/python:3.12-slim

# Lambda Web Adapter のコピー
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 \
    /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
COPY . .

RUN pip install uv && uv sync --no-dev

ENV PORT=8000
EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 経済的メリット

```
EC2 t3.small (常時起動):  ~$15/月
ECS Fargate (常時起動):   ~$20/月
Lambda + LWA (従量制):    ~$0.20/月 (月1,000リクエスト想定)
```

ポートフォリオサイトのような低トラフィック環境では Lambda が圧倒的にコスト効率が高い。

## IAM 権限設計

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-3-5-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/profile-chat-checkpoints"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::profile-chat-ai-state-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3vectors:QueryVectors",
        "s3vectors:GetVectors"
      ],
      "Resource": "arn:aws:s3:::profile-chat-ai-vectors"
    }
  ]
}
```

## 関連ドキュメント

- [CDK ガイド](cdk-guide.md)
- [RAG パイプライン](../architecture/rag-pipeline.md)
- [ストリーミング仕様](../api/streaming-spec.md)
