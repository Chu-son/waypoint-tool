.PHONY: up dev shell down clean prepare-dirs

# コンテナをホストと同じユーザー・同じパスで動かすための値 (compose.yaml が参照する)
export USER_UID := $(shell id -u)
export USER_GID := $(shell id -g)
# プロジェクトやカスタムプラグインの置き場。ホストと同じパスでマウントされる
export WPT_PROJECTS_DIR ?= $(HOME)/waypoint-projects

# マウント元がないと Docker が root 所有で作ってしまうため、ホストユーザーとして先に作る
prepare-dirs:
	mkdir -p "$(HOME)/.config/com.chuson.waypoint-tool" \
	         "$(HOME)/.local/share/com.chuson.waypoint-tool/plugins" \
	         "$(WPT_PROJECTS_DIR)"

up: prepare-dirs
	DISPLAY=$${DISPLAY:-:1} docker compose up

# Docker Composeで開発用コンテナをビルド・起動する
# DISPLAY変数がなければデフォルトで :1 を使う
dev: prepare-dirs
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
