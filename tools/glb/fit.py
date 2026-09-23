# -*- coding: utf-8 -*-
"""カテゴリごとにモデルの大きさを揃える(大きすぎるものだけ縮める)。
#
# ビューアは3Dモデルを一律 scale="2 2 2" で表示している(旧Blender製の小さな
# モデルが「小さい」と言われたため2倍にした経緯がある)。作り直したモデルの中には
# 横幅が旧モデルの最大(ダーツ盤 1.7)を大きく超えるもの(雷神 2.8 など)があり、
# マーカーに近づくと画面を覆ってしまう。
#
# 結果表示の最終フレームで測った大きさが
#   横・縦の最大 ≤ MAX_XY、手前(+Z)への張り出し ≤ MAX_Z
# に収まるよう、シーンの一番外側に "fit" ノードを1つ挟んで縮める。
# 同じカテゴリの12ファイルには同じ倍率を掛ける(焦らし→結果で大きさが変わらない)。
# 何度実行しても同じ結果になる(既に "fit" があれば倍率を付け直す)。
#
#   python3 tools/glb/fit.py            # 全カテゴリ
#   python3 tools/glb/fit.py dice cake  # 絞る
"""
import glob, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "badge"))
sys.path.insert(0, os.path.join(HERE, "..", "thumbs"))
from glbedit import read_glb, write_glb, load_buffers  # noqa: E402
import render  # noqa: E402

ROOT = os.path.join(HERE, "..", "..")
PRESETS = os.path.join(ROOT, "public", "presets")
MAX_XY = 1.7   # 旧モデルの最大(ダーツ盤・ルーレット)
MAX_Z = 0.8    # 旧モデルの手前への張り出し(バッジ位置 0.78)


def strip_fit(js):
    """既存の fit ノードを外した状態のコピーを返す(測り直し用)。"""
    import copy
    js = copy.deepcopy(js)
    sc = js["scenes"][js.get("scene", 0)]
    if len(sc["nodes"]) == 1 and js["nodes"][sc["nodes"][0]].get("name") == "fit":
        fit = js["nodes"][sc["nodes"][0]]
        sc["nodes"] = list(fit.get("children", []))
    return js


def measure(path):
    js, b0 = read_glb(path)
    bufs = load_buffers(path, js, b0)
    js = strip_fit(js)
    prims = render.gather(js, bufs)
    a = np.concatenate([p["pos"] for p in prims])
    lo, hi = a.min(0), a.max(0)
    return max(hi[0] - lo[0], hi[1] - lo[1]), hi[2]


def apply(path, s):
    js, b0 = read_glb(path)
    sc = js["scenes"][js.get("scene", 0)]
    top = sc["nodes"]
    if len(top) == 1 and js["nodes"][top[0]].get("name") == "fit":
        js["nodes"][top[0]]["scale"] = [s, s, s]
    else:
        js["nodes"].append({"name": "fit", "scale": [s, s, s], "children": list(top)})
        sc["nodes"] = [len(js["nodes"]) - 1]
    write_glb(path, js, b0)


def main():
    only = sys.argv[1:]
    for d in sorted(glob.glob(os.path.join(PRESETS, "*"))):
        cat = os.path.basename(d)
        if not os.path.isdir(d) or cat in ("attend", "common") or (only and cat not in only):
            continue
        probes = [os.path.join(d, "%s_%s_3d.glb" % (cat, k)) for k in ("1tou", "hazure")]
        probes = [p for p in probes if os.path.exists(p)]
        if not probes:
            continue
        xy = z = 0.0
        for p in probes:
            a, b = measure(p)
            xy, z = max(xy, a), max(z, b)
        s = min(1.0, MAX_XY / xy, MAX_Z / z if z > 0 else 1.0)
        s = round(s, 3)
        for f in sorted(glob.glob(os.path.join(d, "*_3d.glb"))):
            apply(f, s)
        print("%-13s 横縦 %.2f / 手前 %.2f → 倍率 %.3f" % (cat, xy, z, s), flush=True)


if __name__ == "__main__":
    main()
