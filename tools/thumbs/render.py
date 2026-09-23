# -*- coding: utf-8 -*-
"""テンプレート一覧用のサムネイル(.glb → PNG)を作る簡易レンダラ。
#
# 管理画面のテンプレート一覧は thumbnail_url があればその画像を、
# 無ければ「3Dモデル」という灰色の箱を出す。つまりサムネイルが無いと
# どのテンプレートがどんな見た目なのか分からない。
#
# ブラウザもBlenderも使わずに済むよう、numpyだけで書いた
# Zバッファ方式のソフトウェアレンダラ。モデルは数百〜数千三角形しか
# 無いので、これで十分速い(1枚あたり0.1秒程度)。
#
# 対応しているもの:
#   ・ノード階層とアニメーション(最終キーフレームの姿勢で描く。
#     結果バッジは scale 0 から始まり、アニメーションで出てくるため)
#   ・baseColorTexture / baseColorFactor
#   ・alphaMode MASK(しきい値で切り抜き) / BLEND(奥から順に合成)
#   ・emissiveFactor(自己発光ぶんを足す)
#
# 使い方:
#   python3 tools/thumbs/render.py                # 全カテゴリ分を作り直す
#   python3 tools/thumbs/render.py darts amida    # カテゴリを絞る
"""
import io, os, struct, sys, math
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "badge"))
from glbedit import read_glb, load_buffers  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PRESETS = os.path.join(ROOT, "public", "presets")

SS = 2            # スーパーサンプリング倍率(描いてから縮めて輪郭をなめらかにする)
OUT = 320         # 出力の一辺。管理画面では高さ80pxで表示されるので十分。
LIGHT = np.array([0.35, 0.72, 0.60])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
AMBIENT = 0.45

COMP = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _buf(bc, bv):
    """bc は埋め込みバッファ(bytes)か、全バッファのリスト。"""
    if isinstance(bc, list):
        return bc[bv.get("buffer", 0)]
    return bc


def accessor(js, bc, idx):
    a = js["accessors"][idx]
    n = NCOMP[a["type"]]
    fmt = COMP[a["componentType"]]
    bv = js["bufferViews"][a["bufferView"]]
    bc = _buf(bc, bv)
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    count = a["count"]
    itemsize = np.dtype(fmt).itemsize * n
    stride = bv.get("byteStride") or itemsize
    raw = bc[off:off + stride * (count - 1) + itemsize]
    arr = np.frombuffer(
        np.frombuffer(raw, dtype=np.uint8)[
            (np.arange(count)[:, None] * stride + np.arange(itemsize)[None, :]).ravel()
        ].tobytes(), dtype=fmt)
    return arr.reshape(count, n).astype(np.float32 if fmt == "f" else np.int64)


def trs(node):
    t = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    r = np.array(node.get("rotation", [0, 0, 0, 1]), dtype=np.float64)
    s = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    x, y, z, w = r
    rot = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = rot * s[None, :]
    m[:3, 3] = t
    return m


def apply_animation(js, bc):
    """アニメーションの最終フレームの姿勢をノードへ焼き込む。

    結果バッジは scale 0(または0.001)で置かれていて、アニメーションで
    拡大されて現れる。静止状態のまま描くとバッジが見えないので、
    各チャンネルの最後のキーフレーム値を採用する。
    """
    for anim in js.get("animations", []):
        for ch in anim["channels"]:
            s = anim["samplers"][ch["sampler"]]
            out = accessor(js, bc, s["output"])
            node = js["nodes"][ch["target"]["node"]]
            path = ch["target"]["path"]
            v = out[-1]
            if path == "translation":
                node["translation"] = [float(x) for x in v[:3]]
            elif path == "scale":
                node["scale"] = [float(x) for x in v[:3]]
            elif path == "rotation":
                node["rotation"] = [float(x) for x in v[:4]]
            node.pop("matrix", None)


def world_matrices(js):
    out = {}
    scenes = js.get("scenes", [{"nodes": list(range(len(js.get("nodes", []))))}])
    roots = scenes[js.get("scene", 0)].get("nodes", [])
    seen = set()

    def walk(i, parent):
        if i in seen:
            return
        seen.add(i)
        m = parent @ trs(js["nodes"][i])
        out[i] = m
        for c in js["nodes"][i].get("children", []):
            walk(c, m)
    for r in roots:
        walk(r, np.eye(4))
    for i in range(len(js.get("nodes", []))):
        if i not in out:
            walk(i, np.eye(4))
    return out


def load_texture(js, bc, tex_index):
    if tex_index is None:
        return None
    src = js["textures"][tex_index].get("source")
    if src is None:
        return None
    im = js["images"][src]
    bv = js["bufferViews"][im["bufferView"]]
    off = bv.get("byteOffset", 0)
    data = _buf(bc, bv)[off:off + bv["byteLength"]]
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    if max(img.size) > 256:
        img = img.resize((min(256, img.size[0]), min(256, img.size[1])), Image.LANCZOS)
    return np.asarray(img, dtype=np.float32) / 255.0


def gather(js, bc):
    """全メッシュをワールド座標の三角形リストへ展開する。"""
    apply_animation(js, bc)
    W = world_matrices(js)
    tex_cache = {}
    tris = []
    for ni, node in enumerate(js.get("nodes", [])):
        if node.get("mesh") is None or ni not in W:
            continue
        M = W[ni]
        # scale 0 のノード(アニメーション前のバッジなど)は逆行列が作れない。
        # 法線は近似で構わないので擬似逆行列で代用する。
        try:
            N = np.linalg.inv(M[:3, :3]).T
        except np.linalg.LinAlgError:
            N = np.linalg.pinv(M[:3, :3]).T
        for prim in js["meshes"][node["mesh"]]["primitives"]:
            if prim.get("mode", 4) != 4:
                continue
            attrs = prim["attributes"]
            pos = accessor(js, bc, attrs["POSITION"]).astype(np.float64)
            pos = pos @ M[:3, :3].T + M[:3, 3]
            nrm = (accessor(js, bc, attrs["NORMAL"]).astype(np.float64) @ N.T
                   if "NORMAL" in attrs else None)
            uv = accessor(js, bc, attrs["TEXCOORD_0"]).astype(np.float64) if "TEXCOORD_0" in attrs else None
            idx = (accessor(js, bc, prim["indices"]).ravel()
                   if "indices" in prim else np.arange(len(pos)))
            mi = prim.get("material")
            mat = js["materials"][mi] if mi is not None else {}
            pbr = mat.get("pbrMetallicRoughness", {})
            base = np.array(pbr.get("baseColorFactor", [1, 1, 1, 1]), dtype=np.float32)
            ti = (pbr.get("baseColorTexture") or {}).get("index")
            if ti is not None and ti not in tex_cache:
                tex_cache[ti] = load_texture(js, bc, ti)
            emis = np.array(mat.get("emissiveFactor", [0, 0, 0]), dtype=np.float32)
            tris.append(dict(pos=pos, nrm=nrm, uv=uv, idx=idx, base=base,
                             tex=tex_cache.get(ti), emissive=emis,
                             alpha_mode=mat.get("alphaMode", "OPAQUE"),
                             cutoff=mat.get("alphaCutoff", 0.5)))
    return tris


def sample(tex, u, v):
    h, w = tex.shape[:2]
    x = np.clip((u % 1.0) * (w - 1), 0, w - 1).astype(np.int32)
    y = np.clip((v % 1.0) * (h - 1), 0, h - 1).astype(np.int32)
    return tex[y, x]


def render(path, size=OUT):
    js, bc = read_glb(path)
    bc = load_buffers(path, js, bc)
    prims = gather(js, bc)
    if not prims:
        return None
    allpos = np.concatenate([p["pos"] for p in prims], axis=0)
    lo, hi = allpos.min(axis=0), allpos.max(axis=0)
    center = (lo + hi) / 2.0
    radius = max(np.linalg.norm(hi - lo) / 2.0, 1e-6)

    S = size * SS
    # 正面すこし上から見る平行投影。等倍で収まるよう余白を1割取る。
    eye_dir = np.array([0.0, 0.22, 1.0]); eye_dir /= np.linalg.norm(eye_dir)
    up = np.array([0.0, 1.0, 0.0])
    right = np.cross(up, eye_dir); right /= np.linalg.norm(right)
    up2 = np.cross(eye_dir, right)
    scale = (S / 2.0) / (radius * 1.1)

    color = np.zeros((S, S, 3), dtype=np.float32)
    alpha = np.zeros((S, S), dtype=np.float32)
    depth = np.full((S, S), -1e18, dtype=np.float64)

    order = sorted(range(len(prims)), key=lambda i: 0 if prims[i]["alpha_mode"] != "BLEND" else 1)
    for pi in order:
        p = prims[pi]
        rel = p["pos"] - center
        sx = rel @ right * scale + S / 2.0
        sy = -(rel @ up2) * scale + S / 2.0
        sz = rel @ eye_dir
        idx = p["idx"].reshape(-1, 3)
        nrm = p["nrm"]
        for tri in idx:
            xs = sx[tri]; ys = sy[tri]; zs = sz[tri]
            x0 = max(int(math.floor(xs.min())), 0); x1 = min(int(math.ceil(xs.max())) + 1, S)
            y0 = max(int(math.floor(ys.min())), 0); y1 = min(int(math.ceil(ys.max())) + 1, S)
            if x1 <= x0 or y1 <= y0:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            d = ((ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]))
            if abs(d) < 1e-12:
                continue
            w0 = ((ys[1] - ys[2]) * (X - xs[2]) + (xs[2] - xs[1]) * (Y - ys[2])) / d
            w1 = ((ys[2] - ys[0]) * (X - xs[2]) + (xs[0] - xs[2]) * (Y - ys[2])) / d
            w2 = 1.0 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
            col = np.tile(p["base"][:3], (inside.shape[0], inside.shape[1], 1)).astype(np.float32)
            a = np.full(inside.shape, float(p["base"][3]), dtype=np.float32)
            if p["tex"] is not None and p["uv"] is not None:
                uu = w0 * p["uv"][tri[0], 0] + w1 * p["uv"][tri[1], 0] + w2 * p["uv"][tri[2], 0]
                vv = w0 * p["uv"][tri[0], 1] + w1 * p["uv"][tri[1], 1] + w2 * p["uv"][tri[2], 1]
                t = sample(p["tex"], uu, vv)
                col = col * t[..., :3]
                a = a * t[..., 3]
            if nrm is not None:
                n = (w0[..., None] * nrm[tri[0]] + w1[..., None] * nrm[tri[1]]
                     + w2[..., None] * nrm[tri[2]])
                ln = np.linalg.norm(n, axis=-1, keepdims=True)
                n = n / np.where(ln < 1e-9, 1.0, ln)
                lam = np.abs(n @ LIGHT)
                shade = (AMBIENT + (1 - AMBIENT) * lam).astype(np.float32)
            else:
                shade = np.float32(1.0)
            lit = np.clip(col * shade[..., None] + p["emissive"][None, None, :] * col, 0, 1)

            if p["alpha_mode"] == "MASK":
                inside = inside & (a >= p["cutoff"])
                a = np.where(inside, 1.0, 0.0).astype(np.float32)
            elif p["alpha_mode"] == "OPAQUE":
                a = np.where(inside, 1.0, 0.0).astype(np.float32)

            sub_d = depth[y0:y1, x0:x1]
            vis = inside & (z > sub_d) & (a > 0.003)
            if not vis.any():
                continue
            if p["alpha_mode"] == "BLEND":
                av = np.where(vis, a, 0.0)[..., None]
                depth[y0:y1, x0:x1] = np.where(vis & (a > 0.98), z, sub_d)
            else:
                av = np.where(vis, 1.0, 0.0)[..., None]
                depth[y0:y1, x0:x1] = np.where(vis, z, sub_d)
            sc = color[y0:y1, x0:x1]
            sa = alpha[y0:y1, x0:x1]
            color[y0:y1, x0:x1] = lit * av + sc * (1 - av)
            alpha[y0:y1, x0:x1] = av[..., 0] + sa * (1 - av[..., 0])

    rgba = np.concatenate([np.clip(color, 0, 1), np.clip(alpha, 0, 1)[..., None]], axis=-1)
    img = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
    return img.resize((size, size), Image.LANCZOS)


def main():
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    cats = sorted(d for d in os.listdir(PRESETS) if os.path.isdir(os.path.join(PRESETS, d)))
    if only:
        cats = [c for c in cats if c in only]
    made = 0
    for cat in cats:
        if cat == "attend":
            continue
        for f in sorted(os.listdir(os.path.join(PRESETS, cat))):
            if not f.endswith("_3d.glb") or f.endswith("_suspense_3d.glb"):
                continue
            src = os.path.join(PRESETS, cat, f)
            dst = src[:-4] + "_thumb.png"
            try:
                img = render(src)
            except Exception as e:  # 1つ失敗しても残りは作る
                print("  失敗:", f, e)
                continue
            if img is None:
                print("  描けません:", f)
                continue
            img.quantize(colors=255, method=Image.FASTOCTREE).save(dst, "PNG", optimize=True)
            made += 1
        print("%-14s 完了" % cat)
    print("サムネイル: %d 枚" % made)


if __name__ == "__main__":
    main()
