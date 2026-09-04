import { customAlphabet } from "nanoid";

// 紛らわしい文字(0/O, 1/l/I など)を避けたURL用ハッシュ
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
export const generateHash = customAlphabet(alphabet, 10);
