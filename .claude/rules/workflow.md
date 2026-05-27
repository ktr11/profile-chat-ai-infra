## 作業フロー

- 実装前に設計をグリルして合意を取る
- 変更は機能ブランチで行い、PR 経由で main にマージする
- コミットは役割ごとに分割する（pca-split-commits スキル準拠）
- コミットメッセージは日本語、`feat` / `fix` / `refactor` / `chore` / `docs` プレフィックス

## ECR イメージタグ戦略

- `{env}-<git-sha-short>` + `{env}-latest` の併用
- ライフサイクルポリシーで直近 10 イメージを保持
