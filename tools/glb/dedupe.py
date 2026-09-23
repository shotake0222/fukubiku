# -*- coding: utf-8 -*-
"""同じカテゴリの .glb 同士で重複しているデータを、共有ファイル(.bin)へ追い出す。
#
# 1カテゴリには 10等級 + 参加賞 + 焦らし の12ファイルがあり、中身の9割以上
# (形・テクスチャ・動き)は同じで、違うのは結果バッジの画像くらい。
# それを12回ずつ持っていたため、public/presets が 130MB を超えていた。
#
# glTF は1つのモデルが複数のバッファを持てる。
#   buffers[0] … .glb に埋め込み(そのファイルにしか無いデータ。主にバッジ画像)
#   buffers[1] … "<cat>_shared_<hash>.bin"(カテゴリ内で共通のデータ)
# three.js の GLTFLoader は buffers[1] の uri を .glb と同じ場所から読む。
# 共有ファイルは一度読めばブラウザにキャッシュされるので、焦らし→結果の
# 切り替えも速くなる。
#
# ファイル名に中身のハッシュを入れているので、作り直したときに古い .bin が
# キャッシュに残っていても食い違わない(古い .bin は --list-orphans で確認できる)。
#
# 使い方:
#   python3 tools/glb/dedupe.py              # 全カテゴリ
#   python3 tools/glb/dedupe.py dice cake    # カテゴリを絞る
#   python3 tools/glb/dedupe.py --list-orphans
"""
import glob, hashlib, json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "badge"))
from glbedit import read_glb, write_glb  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PRESETS = os.path.join(ROOT, "public", "presets")
MIN_SHARE = 512   # これより小さいデータは埋め込んだままにする(リクエストより安い)


def view_bytes(js, bins, i):
    bv = js["bufferViews"][i]
    buf = bins[bv.get("buffer", 0)]
    o = bv.get("byteOffset", 0)
    return buf[o:o + bv["byteLength"]]


def load(path):
    js, bin0 = read_glb(path)
    bins = [bin0]
    for b in js.get("buffers", [])[1:]:
        uri = b.get("uri")
        bins.append(open(os.path.join(os.path.dirname(path), uri), "rb").read() if uri else b"")
    return js, bins


def dedupe_dir(d):
    files = sorted(glob.glob(os.path.join(d, "*_3d.glb")))
    if len(files) < 2:
        return None
    cat = os.path.basename(d)
    loaded = {}
    count = {}
    for f in files:
        js, bins = load(f)
        loaded[f] = (js, bins)
        seen = set()
        for i in range(len(js.get("bufferViews", []))):
            data = view_bytes(js, bins, i)
            if len(data) < MIN_SHARE:
                continue
            h = hashlib.sha1(data).hexdigest()
            if h not in seen:
                count[h] = count.get(h, 0) + 1
                seen.add(h)
    shared_keys = sorted(h for h, c in count.items() if c >= 2)
    if not shared_keys:
        return None
    # 共有.bin を組み立てる(ハッシュ順に並べて、作り直しても同じ内容なら同じファイルになる)
    blobs = {}
    for f in files:
        js, bins = loaded[f]
        for i in range(len(js["bufferViews"])):
            data = view_bytes(js, bins, i)
            h = hashlib.sha1(data).hexdigest()
            if h in count and count[h] >= 2 and len(data) >= MIN_SHARE:
                blobs[h] = data
    shared = bytearray()
    offsets = {}
    for h in shared_keys:
        if len(shared) % 4:
            shared += b"\x00" * (4 - len(shared) % 4)
        offsets[h] = len(shared)
        shared += blobs[h]
    digest = hashlib.sha1(bytes(shared)).hexdigest()[:10]
    shared_name = "%s_shared_%s.bin" % (cat, digest)
    shared_path = os.path.join(d, shared_name)
    if not os.path.exists(shared_path):
        open(shared_path, "wb").write(bytes(shared))

    before = after = 0
    for f in files:
        js, bins = loaded[f]
        before += os.path.getsize(f)
        own = bytearray()
        for i, bv in enumerate(js["bufferViews"]):
            data = view_bytes(js, bins, i)
            h = hashlib.sha1(data).hexdigest()
            if h in offsets and len(data) >= MIN_SHARE:
                bv["buffer"] = 1
                bv["byteOffset"] = offsets[h]
                bv["byteLength"] = len(data)
            else:
                if len(own) % 4:
                    own += b"\x00" * (4 - len(own) % 4)
                bv["buffer"] = 0
                bv["byteOffset"] = len(own)
                bv["byteLength"] = len(data)
                own += data
        js["buffers"] = [{"byteLength": len(own)}, {"uri": shared_name, "byteLength": len(shared)}]
        write_glb(f, js, bytes(own))
        after += os.path.getsize(f)
    return cat, len(files), before, after, len(shared), shared_name


def list_orphans():
    used = set()
    for f in glob.glob(os.path.join(PRESETS, "*", "*.glb")):
        js, _ = read_glb(f)
        for b in js.get("buffers", []):
            if b.get("uri"):
                used.add(os.path.join(os.path.dirname(f), b["uri"]))
    orphans = [p for p in glob.glob(os.path.join(PRESETS, "*", "*_shared_*.bin")) if p not in used]
    for p in orphans:
        print(os.path.relpath(p, ROOT))
    print("使われていない共有ファイル: %d 件" % len(orphans))


def main():
    if "--list-orphans" in sys.argv:
        return list_orphans()
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    total_b = total_a = 0
    for d in sorted(glob.glob(os.path.join(PRESETS, "*"))):
        if not os.path.isdir(d) or os.path.basename(d) in ("attend",):
            continue
        if only and os.path.basename(d) not in only:
            continue
        r = dedupe_dir(d)
        if not r:
            continue
        cat, n, before, after, sz, name = r
        total_b += before
        total_a += after + sz
        print("%-12s %2d files  %6dKB → %5dKB + 共有 %5dKB" % (cat, n, before // 1024, after // 1024, sz // 1024), flush=True)
    if total_b:
        print("合計: %.1fMB → %.1fMB" % (total_b / 1e6, total_a / 1e6))


if __name__ == "__main__":
    main()
