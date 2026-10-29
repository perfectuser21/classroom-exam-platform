#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
python=${CLASSROOM_XLSX_PYTHON:-/opt/homebrew/bin/python3.14}
target="$root/.venv-xlsx"
if [[ -e "$target" ]]; then printf '表格运行环境已存在，不覆盖。\n' >&2; exit 1; fi
"$python" -c 'import sys; assert sys.version_info[:2] == (3, 14)'
"$python" -m venv "$target"
"$target/bin/python" -m pip install --disable-pip-version-check --no-input --only-binary=:all: -r "$root/xlsx-requirements.txt"
