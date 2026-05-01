#!/bin/sh
set -eu

repo="tomatitito/awb"
install_dir="${INSTALL_DIR:-$HOME/.local/bin}"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

need curl
need tar
need uname

os=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$os" in
  darwin|linux) platform="$os" ;;
  *) fail "unsupported platform: $os" ;;
esac

machine=$(uname -m | tr '[:upper:]' '[:lower:]')
case "$machine" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) fail "unsupported architecture: $machine" ;;
esac

latest_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$repo/releases/latest")
tag=${latest_url##*/}
[ -n "$tag" ] || fail "could not resolve latest release"

asset="awb-${tag}-${platform}-${arch}.tar.gz"
base_url="https://github.com/$repo/releases/download/$tag"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

log "Installing awb $tag for $platform-$arch into $install_dir"
mkdir -p "$install_dir"

curl -fsSL "$base_url/$asset" -o "$tmp_dir/$asset"

checksums="awb-${tag#v}-checksums.txt"
if curl -fsSL "$base_url/$checksums" -o "$tmp_dir/$checksums"; then
  expected=$(grep " $asset\$" "$tmp_dir/$checksums" | awk '{print $1}')
  if [ -n "$expected" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      actual=$(sha256sum "$tmp_dir/$asset" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      actual=$(shasum -a 256 "$tmp_dir/$asset" | awk '{print $1}')
    else
      fail "missing sha256sum or shasum for checksum verification"
    fi
    [ "$actual" = "$expected" ] || fail "checksum verification failed"
    log "Checksum verified"
  fi
fi

tar -xzf "$tmp_dir/$asset" -C "$install_dir" awb
chmod +x "$install_dir/awb"

log "Installed: $install_dir/awb"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) log "Note: $install_dir is not on your PATH" ;;
esac
