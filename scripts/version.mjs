// アプリ本体のバージョン管理スクリプト。
//   node scripts/version.mjs bump <X.Y.Z>   package.json / package-lock.json / Cargo.toml / Cargo.lock を更新
//   node scripts/version.mjs check [tag]     各ファイルのバージョン一致（と、指定があればタグ名との一致）を検証
// 正は package.json。tauri.conf.json は package.json を参照する（docs/DEVELOPMENT_GUIDE.md 参照）。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (p) => join(root, p);
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const CARGO_TOML_VERSION = /^(\[package\][^[]*?\nversion = ")([^"]+)(")/m;
const CARGO_LOCK_VERSION = /(\[\[package\]\]\nname = "waypoint-tool"\nversion = ")([^"]+)(")/;

function readJson(p) {
  return JSON.parse(readFileSync(path(p), 'utf8'));
}

function writeJson(p, data) {
  writeFileSync(path(p), `${JSON.stringify(data, null, 2)}\n`);
}

function matchOrThrow(text, re, file) {
  const m = text.match(re);
  if (!m) throw new Error(`${file}: version entry not found`);
  return m;
}

function readVersions() {
  const lock = readJson('package-lock.json');
  return {
    'package.json': readJson('package.json').version,
    'package-lock.json': lock.version,
    'package-lock.json (packages[""])': lock.packages[''].version,
    'src-tauri/Cargo.toml': matchOrThrow(
      readFileSync(path('src-tauri/Cargo.toml'), 'utf8'),
      CARGO_TOML_VERSION,
      'Cargo.toml',
    )[2],
    'src-tauri/Cargo.lock': matchOrThrow(
      readFileSync(path('src-tauri/Cargo.lock'), 'utf8'),
      CARGO_LOCK_VERSION,
      'Cargo.lock',
    )[2],
  };
}

function bump(version) {
  if (!SEMVER.test(version)) throw new Error(`invalid version "${version}" (expected X.Y.Z or X.Y.Z-pre)`);

  const pkg = readJson('package.json');
  pkg.version = version;
  writeJson('package.json', pkg);

  const lock = readJson('package-lock.json');
  lock.version = version;
  lock.packages[''].version = version;
  writeJson('package-lock.json', lock);

  for (const [file, re] of [
    ['src-tauri/Cargo.toml', CARGO_TOML_VERSION],
    ['src-tauri/Cargo.lock', CARGO_LOCK_VERSION],
  ]) {
    const text = readFileSync(path(file), 'utf8');
    matchOrThrow(text, re, file);
    writeFileSync(path(file), text.replace(re, `$1${version}$3`));
  }
  console.log(`Bumped to ${version}`);
}

function check(tag) {
  const versions = readVersions();
  const expected = tag ? tag.replace(/^v/, '') : versions['package.json'];
  const mismatched = Object.entries(versions).filter(([, v]) => v !== expected);
  if (mismatched.length > 0) {
    console.error(`Version mismatch (expected ${expected}${tag ? ` from tag ${tag}` : ''}):`);
    for (const [file, v] of Object.entries(versions)) console.error(`  ${file}: ${v}`);
    process.exit(1);
  }
  console.log(`OK: all versions are ${expected}`);
}

const [command, arg] = process.argv.slice(2);
try {
  if (command === 'bump' && arg) bump(arg);
  else if (command === 'check') check(arg);
  else throw new Error('usage: version.mjs bump <X.Y.Z> | check [tag]');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
