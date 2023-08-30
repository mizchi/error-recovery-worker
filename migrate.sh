#!/bin/bash

# ソースディレクトリ
SOURCE_DIR="prisma/migrations/"

# 保存先ディレクトリ
DEST_DIR=".wrangler/migrations/"

# DEST_DIRが存在しない場合、ディレクトリを作成
rm -rf $DEST_DIR
mkdir -p $DEST_DIR

# ファイルをコピー
for dir in $SOURCE_DIR*; do
    # ディレクトリ名から日付と名前を取得
    dir_name=$(basename $dir)

    # migration_lock.tomlはコピーしないようにスキップ
    if [[ "$dir_name" == "migration_lock.toml" ]]; then
        continue
    fi

    IFS="_" read -ra parts <<< "$dir_name"
    date="${parts[0]}"
    name="${parts[1]}"

    # ファイルを新しい場所にコピー
    if [[ -f "$dir/migration.sql" ]]; then
        cp "$dir/migration.sql" "$DEST_DIR${date}_${name}.sql"
    fi
done

echo "Migration files have been copied!"

# pnpm prisma migrate dev --create-only
