# -*- coding: utf-8 -*-
"""どのカテゴリでも1等〜6等・大当たり/当たり/クーポン/はずれを選べるようにする。
#
# 【背景】
# 旧カテゴリ(Blenderで作った29種)は、6等級だけ用意されたものと、
# 当たり外れ4種だけ用意されたものに分かれていた。
# そのため「ダーツで1等」「あみだくじで当たり」が選べなかった。
#
# 【仕組み】
# 同じカテゴリの.glbは、埋め込んであるバッジ画像とその名前以外は
# まったく同じ(頂点もアニメーションも一致することを確認済み)。
# つまり既存のtierを1つ複製し、バッジの名前と画像を差し替えれば、
# 不足しているtierをそのまま作れる。Blenderは要らない。
#
# 使い方:
#   python3 tools/badge/gen_badges.py      # 先にバッジPNGを用意
#   python3 tools/badge/expand_tiers.py    # 不足tierを生成
#   python3 tools/badge/apply_badges.py    # 全.glbへバッジと見た目を反映
"""
import os, shutil, sys, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apply_badges as A  # noqa: E402
from glbedit import read_glb  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PRESETS = os.path.join(ROOT, "public", "presets")

# ファイル名のキー → バッジの文字
TIERS = [
    ("1tou", "1等"), ("2tou", "2等"), ("3tou", "3等"),
    ("4tou", "4等"), ("5tou", "5等"), ("6tou", "6等"),
    ("ohatari", "大当たり"), ("atari", "当たり"),
    ("coupon", "クーポン"), ("hazure", "はずれ"),
]
# 複製元に選ぶ優先順位(どれを選んでも中身は同じだが、結果を再現可能にする)
SOURCE_PREFERENCE = ["1tou", "atari", "ohatari", "2tou", "coupon", "hazure"]

SKIP_DIRS = {"attend"}


def main():
    dry = "--dry-run" in sys.argv
    badges = A.load_badges()
    if not badges:
        print("バッジ画像が見つかりません。先に gen_badges.py を実行してください。")
        return 1

    created = 0
    for d in sorted(os.listdir(PRESETS)):
        cat = d
        if cat in SKIP_DIRS or not os.path.isdir(os.path.join(PRESETS, d)):
            continue
        have = {}
        for key, _ in TIERS:
            p = os.path.join(PRESETS, cat, "%s_%s_3d.glb" % (cat, key))
            if os.path.exists(p):
                have[key] = p
        if not have:
            print("  (バッジ付きの.glbが無いので対象外)", cat)
            continue
        src_key = next((k for k in SOURCE_PREFERENCE if k in have), sorted(have)[0])
        src = have[src_key]
        missing = [(k, ja) for k, ja in TIERS if k not in have]
        if not missing:
            continue
        print("%-14s 既存%2d / 追加%2d  (複製元: %s)" % (cat, len(have), len(missing), src_key))
        for key, ja in missing:
            dst = os.path.join(PRESETS, cat, "%s_%s_3d.glb" % (cat, key))
            if dry:
                created += 1
                continue
            shutil.copy2(src, dst)
            if A.apply_to(dst, badges, rename_to=ja) is None:
                os.remove(dst)
                print("   ! 失敗:", os.path.basename(dst))
                continue
            created += 1
    print("生成: %d ファイル%s" % (created, "(dry-run)" if dry else ""))

    # 検算: 全カテゴリが10tier + cookie + suspense を持っているか
    bad = []
    for d in sorted(os.listdir(PRESETS)):
        if d in SKIP_DIRS or not os.path.isdir(os.path.join(PRESETS, d)):
            continue
        for key, _ in TIERS:
            if not os.path.exists(os.path.join(PRESETS, d, "%s_%s_3d.glb" % (d, key))):
                bad.append("%s/%s" % (d, key))
    if bad and not dry:
        print("※ まだ足りないもの:", ", ".join(bad))
    elif not dry:
        print("全カテゴリで10等級すべてがそろいました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
