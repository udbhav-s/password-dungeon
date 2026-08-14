#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "${script_dir}/.." && pwd)"
cd "${project_dir}"

mkdir -p public/programs

emcc c_levels/room7.c \
  -O0 \
  -o public/programs/room7.js \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createRoom7Module \
  -s ASYNCIFY=1 \
  -s NO_EXIT_RUNTIME=1 \
  -s 'EXPORTED_FUNCTIONS=["_main","_get_buffer_address","_get_buffer_size"]' \
  -s 'EXPORTED_RUNTIME_METHODS=["ccall","HEAPU8"]'
