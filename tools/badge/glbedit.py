# -*- coding: utf-8 -*-
"""GLB(バイナリglTF)を読み書きするための最小限のユーティリティ。

.glb は「ヘッダ + JSONチャンク + バイナリチャンク」という単純な構造で、
メッシュの頂点も埋め込み画像も、すべてバイナリチャンクの一部を
bufferView(オフセットと長さ)で指しているだけ。
accessor は bufferView を索引で参照するので、索引の並びさえ保てば
中身の差し替えや再梱包は安全に行える。
"""
import json, struct

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path):
    d = open(path, "rb").read()
    if d[:4] != b"glTF":
        raise ValueError("glTFではありません: %s" % path)
    off, js, binchunk = 12, None, b""
    while off < len(d):
        ln, ty = struct.unpack("<II", d[off:off + 8]); off += 8
        ch = d[off:off + ln]; off += ln
        if ty == JSON_CHUNK:
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
    out += struct.pack("<II", len(jb), JSON_CHUNK) + jb
    out += struct.pack("<II", len(bb), BIN_CHUNK) + bb
    open(path, "wb").write(out)


def repack(js, binchunk, replacements=None):
    """bufferViewを先頭から詰め直す。

    replacements: {bufferViewの索引: 新しいbytes}
    差し替えで長さが変わっても、索引の並びを保ったまま
    オフセットと長さを整合させる(古いデータは残らない)。
    """
    replacements = replacements or {}
    newbin = bytearray()
    for i, bv in enumerate(js["bufferViews"]):
        data = replacements.get(i)
        if data is None:
            o = bv.get("byteOffset", 0)
            data = binchunk[o:o + bv["byteLength"]]
        if len(newbin) % 4:
            newbin += b"\x00" * (4 - len(newbin) % 4)
        bv["byteOffset"] = len(newbin)
        bv["byteLength"] = len(data)
        newbin += data
    js["buffers"][0]["byteLength"] = len(newbin)
    js["buffers"][0].pop("uri", None)
    return bytes(newbin)


def badge_image_index(js):
    """埋め込み画像のうち、結果バッジ(badge_〜)のものを返す。"""
    for i, im in enumerate(js.get("images", [])):
        if (im.get("name") or "").startswith("badge_"):
            return i
    return None


def badge_label(js):
    i = badge_image_index(js)
    if i is None:
        return None
    return (js["images"][i]["name"] or "")[len("badge_"):]
