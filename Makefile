.PHONY: up dev shell down clean

up:
	DISPLAY=$${DISPLAY:-:1} docker compose up

# Docker Composeで開発用コンテナをビルド・起動する
# DISPLAY変数がなければデフォルトで :1 を使う
dev:
	DISPLAY=$${DISPLAY:-:1} docker compose up --build

# 起動中の開発コンテナの中に入る
shell:
	docker compose exec waypoint-dev bash

# コンテナを停止する
down:
	docker compose down

# コンテナ、ネットワーク、イメージ、名前付きボリューム(キャッシュ含む)を完全削除する
clean:
	docker compose down -v --rmi all
	@echo "Cleaned up Docker resources."
