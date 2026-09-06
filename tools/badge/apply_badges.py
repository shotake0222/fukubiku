# -*- coding: utf-8 -*-
"""生成した結果バッジのテクスチャを、public/presets 配下の全.glbへ埋め込み直す。
#
# .glb は「JSONチャンク + バイナリチャンク」の2つでできていて、
# 埋め込み画像もバイナリチャンクの一部を bufferView で指しているだけ。
# ここでは画像名(badge_1等 など)が一致する bufferView の中身だけを差し替え、
# バイナリチャンクを作り直す(古い画像を残さないのでファイルが無駄に太らない)。
# accessor は bufferView を索引で参照するため、索引の順序を保てば安全。
#
# 使い方: python3 tools/badge/apply_badges.py [--dry-run]
"""
import glob, json, os, struct, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
BADGE_DIR = os.path.join(os.path.dirname(__file__), "out")


def read_glb(path):
    d = open(path, "rb").read()
    assert d[:4] == b"glTF", path
    off, js, binchunk = 12, None, b""
    while off < len(d):
        ln, ty = struct.unpack("<II", d[off:off + 8]); off += 8
        ch = d[off:off + ln]; off += ln
        if ty == 0x4E4F534A:
            js = json.loads(ch.decode("utf-8"))
        else:
            binchunk = ch
    return js, binchunk


def write_glb(path, js, binchunk):
    jb = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = binchunk + b"\x00" * ((4 - len(binchunk) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    out = b"glTF" + struct.pack("<II", 2, total)
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
    out += struct.pack("<II", len(bb), 0x004E4942) + bb
    open(path, "wb").write(out)


def apply_to(path, badges, dry=False):
    js, binchunk = read_glb(path)
    newdata = {}
    names = []
    for im in js.get("images", []):
        n = im.get("name") or ""
        if n in badges and "bufferView" in im:
            newdata[im["bufferView"]] = badges[n]
            im["mimeType"] = "image/png"
            names.append(n)
    if not names:
        return None
    if dry:
        return names
    bvs = js["bufferViews"]
    newbin = bytearray()
    for i, bv in enumerate(bvs):
        data = newdata.get(i)
        if data is None:
            o = bv.get("byteOffset", 0)
            data = binchunk[o:o + bv["byteLength"]]
        if len(newbin) % 4:
            newbin += b"\x00" * (4 - len(newbin) % 4)
        bv["byteOffset"] = len(newbin)
        bv["byteLength"] = len(data)
        newbin += data
    js["buffers"][0]["byteLength"] = len(newbin)
    write_glb(path, js, bytes(newbin))
    return names


def main():
    dry = "--dry-run" in sys.argv
    badges = {}
    for f in glob.glob(os.path.join(BADGE_DIR, "badge_*.png")):
        badges[os.path.basename(f)[:-4]] = open(f, "rb").read()
    if not badges:
        print("バッジ画像が見つかりません。先に gen_badges.py を実行してください。")
        return 1
    print("読み込んだバッジ:", ", ".join(sorted(badges)))
    files = sorted(glob.glob(os.path.join(ROOT, "public", "presets", "*", "*.glb")))
    changed = skipped = 0
    before = after = 0
    for p in files:
        b = os.path.getsize(p)
        names = apply_to(p, badges, dry)
        if names:
            changed += 1
            before += b
            after += os.path.getsize(p)
        else:
            skipped += 1
    print("差し替え: %d ファイル / バッジ無し(スキップ): %d ファイル" % (changed, skipped))
    if not dry and changed:
        print("合計サイズ: %.1fMB → %.1fMB" % (before / 1e6, after / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
