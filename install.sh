#!/usr/bin/env bash

set -euo pipefail

REPO="VGLoic/ethoko"
INSTALL_DIR="${ETHOKO_INSTALL_DIR:-$HOME/.ethoko}"
BIN_DIR="$INSTALL_DIR/bin"

detect_platform() {
  local os arch

  case "$(uname -s)" in
    Linux*)
      os="linux"
      ;;
    Darwin*)
      os="darwin"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      os="windows"
      ;;
    *)
      echo "Error: Unsupported OS $(uname -s)"
      exit 1
      ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)
      arch="x64"
      ;;
    aarch64|arm64)
      arch="arm64"
      ;;
    *)
      echo "Error: Unsupported architecture $(uname -m)"
      exit 1
      ;;
  esac

  echo "${os}-${arch}"
}

get_latest_version() {
  curl -s "https://api.github.com/repos/$REPO/releases" \
    | grep '"tag_name"' \
    | grep 'cli-v' \
    | head -n 1 \
    | sed -E 's/.*"cli-v([^"]+)".*/\1/'
}

ensure_path() {
  local path_line="export PATH=\"${BIN_DIR}:\$PATH\""
  local modified_profiles=()
  
  for profile in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$profile" ]; then
      if ! grep -q "$BIN_DIR" "$profile"; then
        echo "$path_line" >> "$profile"
        modified_profiles+=("$profile")
        echo "✓ Added to PATH in $profile"
      fi
    else
      echo "$path_line" >> "$profile"
      modified_profiles+=("$profile")
      echo "✓ Created $profile and added to PATH"
    fi
  done
  
  # Return modified profiles for sourcing
  printf "%s\n" "${modified_profiles[@]}"
}

main() {
  echo "🔍 Detecting platform..."
  local platform
  platform=$(detect_platform)
  echo "✓ Platform: $platform"

  echo "🔍 Finding latest version..."
  local version
  version=$(get_latest_version)
  if [ -z "$version" ]; then
    echo "Error: Could not determine latest version"
    exit 1
  fi
  echo "✓ Latest version: $version"

  local binary_name="ethoko-${platform}"
  local ext=""
  if [[ "$platform" == windows* ]]; then
    ext=".exe"
  fi

  local download_url="https://github.com/$REPO/releases/download/cli-v$version/$binary_name$ext"

  mkdir -p "$BIN_DIR"
  local tmp_file
  tmp_file=$(mktemp)

  echo "⬇️  Downloading $download_url"
  curl -L "$download_url" -o "$tmp_file"

  local target_name="ethoko"
  if [[ "$platform" == windows* ]]; then
    target_name="ethoko.exe"
  fi

  mv "$tmp_file" "$BIN_DIR/$target_name"
  chmod +x "$BIN_DIR/$target_name"

  echo "🔧 Configuring PATH..."
  local modified_profiles
  modified_profiles=$(ensure_path)
  
  echo ""
  echo "✅ Ethoko installed to $BIN_DIR/$target_name"
  
  # Try to activate PATH immediately
  local activated=false
  if [ -n "$modified_profiles" ]; then
    echo "🔄 Attempting to activate PATH in current shell..."
    while IFS= read -r profile; do
      if [ -f "$profile" ]; then
        # shellcheck disable=SC1090
        if source "$profile" 2>/dev/null; then
          activated=true
        fi
      fi
    done <<< "$modified_profiles"
  fi
  
  # Verify installation
  if command -v ethoko >/dev/null 2>&1; then
    echo "✓ ethoko command is now available"
    "$BIN_DIR/$target_name" --version || true
  else
    echo ""
    echo "⚠️  PATH not activated in current shell"
    echo "➡️  Run this command to activate now:"
    echo "    export PATH=\"${BIN_DIR}:\$PATH\""
    echo ""
    echo "Or restart your shell to use ethoko"
  fi
}

main
