# -*- coding: utf-8 -*-
"""legacy.py(旧29カテゴリの作り直し)と extra.py(新20カテゴリ)をまとめて書き出す。

  python3 tools/templates/build_v2.py            # 全部
  python3 tools/templates/build_v2.py dice cake  # カテゴリを絞る

各カテゴリにつき 10等級 + cookie(参加賞) + suspense の12ファイル。
(build.py の24カテゴリは従来どおり build.py で作る)

作り直したあとは、必ず次の順に流すこと:
  python3 tools/badge/apply_badges.py     # バッジの画像と見た目をそろえる
  python3 tools/glb/dedupe.py <cat...>    # 等級間で重複するデータを共有 .bin へ(容量が1/2〜1/3になる)
  python3 tools/thumbs/render.py <cat...> # 管理画面用のサムネイル
  python3 tools/glb/dedupe.py --list-orphans  # 使われなくなった古い共有 .bin を確認
"""
import os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "glb"))
sys.path.insert(0, HERE)
import legacy
import extra
from build import TIERS, OUT_ROOT

BUILDERS = dict(legacy.BUILDERS)
BUILDERS.update(extra.BUILDERS)


def main():
    only = sys.argv[1:]
    for cat, fn in BUILDERS.items():
        if only and cat not in only:
            continue
        t0 = time.time()
        outdir = os.path.join(OUT_ROOT, cat)
        os.makedirs(outdir, exist_ok=True)
        total = 0
        for key, label in TIERS + [("suspense", None)]:
            b, roots = fn(cat, key, label)
            total += b.save(os.path.join(outdir, "%s_%s_3d.glb" % (cat, key)), roots)
        print("%-12s %2d files  %5d KB  %.1fs" % (cat, len(TIERS) + 1, total // 1024, time.time() - t0), flush=True)


if __name__ == "__main__":
    main()
