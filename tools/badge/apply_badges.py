# -*- coding: utf-8 -*-
"""結果バッジのテクスチャと見た目を、public/presets 配下の全.glbへ反映する。
#
# 2026-09 改訂で、バッジは「トゲトゲの星形」から「文字＋光」に変わった。
# .glb側にも次の3つの手当てが要る:
#
#  1) 埋め込み画像(badge_〜)を新しいPNGへ差し替える
#  2) マテリアルを MASK → BLEND へ変える
#     星形のときは「切り抜き(MASK)」で足りたが、光はなめらかに消えるので
#     切り抜くと光の縁に硬い輪が出てしまう。
#     あわせて emissive(自己発光)を入れ、照明に関係なく文字が明るく出るようにする。
#  3) 旧カテゴリのモデルにある badge_〜_rim(星の裏の単色の四角い板)を削除する
#     星の谷間からこの四角がのぞいていた。文字だけを出す以上、不要。
#
# 使い方: python3 tools/badge/apply_badges.py [--dry-run]
"""
import glob, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbedit import read_glb, write_glb, repack  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
BADGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

# 自己発光の強さ。1.0にすると白飛びするので、文字が浮き上がる程度に留める。
EMISSIVE = 0.55


def load_badges():
    badges = {}
    for f in glob.glob(os.path.join(BADGE_DIR, "badge_*.png")):
        name = os.path.basename(f)[:-4]
        if name.startswith("badge_") and not name.startswith("badge__"):
            badges[name] = open(f, "rb").read()
    return badges


def texture_index_for_image(js, image_index):
    for i, t in enumerate(js.get("textures", [])):
        if t.get("source") == image_index:
            return i
    return None


def tune_badge_materials(js):
    """バッジのマテリアルを BLEND + emissive に揃え、rim(裏板)を取り除く。"""
    changed = False
    rim_materials = set()
    for i, m in enumerate(js.get("materials", [])):
        name = m.get("name") or ""
        if not name.startswith("badge_"):
            continue
        if name.endswith("_rim"):
            rim_materials.add(i)
            continue
        m["alphaMode"] = "BLEND"
        m.pop("alphaCutoff", None)
        m["doubleSided"] = True
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"] = 0.0
        # 1.0にするとカメラ映像の光を拾って白くギラつくので、つや消し寄りにする
        pbr["roughnessFactor"] = 0.9
        tex = pbr.get("baseColorTexture")
        if tex:
            m["emissiveTexture"] = {"index": tex["index"]}
            m["emissiveFactor"] = [EMISSIVE, EMISSIVE, EMISSIVE]
        changed = True

    if rim_materials:
        for mesh in js.get("meshes", []):
            prims = [p for p in mesh["primitives"] if p.get("material") not in rim_materials]
            if len(prims) != len(mesh["primitives"]):
                # プリミティブが全部消えるケースは無いはずだが、念のため守る
                if prims:
                    mesh["primitives"] = prims
                    changed = True
    return changed


def rename_badge(js, new_label):
    """バッジの画像名・マテリアル名・ノード名を別の等級へ付け替える。"""
    old = None
    for im in js.get("images", []):
        n = im.get("name") or ""
        if n.startswith("badge_"):
            old = n[len("badge_"):]
            im["name"] = "badge_" + new_label
            break
    if old is None:
        return None
    for m in js.get("materials", []):
        n = m.get("name") or ""
        if n.startswith("badge_" + old):
            m["name"] = "badge_" + new_label + n[len("badge_" + old):]
    for nd in js.get("nodes", []):
        n = nd.get("name") or ""
        if n.startswith("badge_" + old):
            nd["name"] = "badge_" + new_label + n[len("badge_" + old):]
    return old


def apply_to(path, badges, dry=False, rename_to=None):
    js, binchunk = read_glb(path)
    if rename_to:
        if rename_badge(js, rename_to) is None:
            return None
    target = None
    image_index = None
    for i, im in enumerate(js.get("images", [])):
        n = im.get("name") or ""
        if n in badges and "bufferView" in im:
            target, image_index = n, i
            im["mimeType"] = "image/png"
            break
    if target is None:
        return None
    if dry:
        return [target]
    tune_badge_materials(js)
    bv = js["images"][image_index]["bufferView"]
    if js["bufferViews"][bv].get("buffer", 0) != 0:
        print("  ! バッジ画像が共有.binにあるため差し替えられません:", os.path.basename(path))
        return None
    binchunk = repack(js, binchunk, {bv: badges[target]})
    write_glb(path, js, binchunk)
    return [target]


def main():
    dry = "--dry-run" in sys.argv
    badges = load_badges()
    if not badges:
        print("バッジ画像が見つかりません。先に gen_badges.py を実行してください。")
        return 1
    print("読み込んだバッジ:", ", ".join(sorted(badges)))
    files = sorted(glob.glob(os.path.join(ROOT, "public", "presets", "*", "*.glb")))
    changed = skipped = 0
    before = after = 0
    missing = set()
    for p in files:
        b = os.path.getsize(p)
        names = apply_to(p, badges, dry)
        if names:
            changed += 1
            before += b
            after += os.path.getsize(p)
        else:
            skipped += 1
            js, _ = read_glb(p)
            for im in js.get("images", []):
                n = im.get("name") or ""
                if n.startswith("badge_") and n not in badges:
                    missing.add(n)
    print("差し替え: %d ファイル / バッジ無し(スキップ): %d ファイル" % (changed, skipped))
    if missing:
        print("※ 対応するPNGが無いバッジ:", ", ".join(sorted(missing)))
    if not dry and changed:
        print("合計サイズ: %.1fMB → %.1fMB" % (before / 1e6, after / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
