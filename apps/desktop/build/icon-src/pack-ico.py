#!/usr/bin/env python3
"""Pack PNGs into a Windows .ico. Standard library only.

Usage: pack-ico.py OUT.ico IN1.png IN2.png ...

Entries are stored PNG-compressed, which is what Windows Vista+ (and
electron-builder's own icon pipeline) expect. Sizes are read from each PNG's
IHDR chunk rather than the filename.
"""
import struct
import sys
from pathlib import Path


def png_size(data: bytes) -> tuple[int, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("not a PNG (or no leading IHDR chunk)")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    out = Path(argv[1])
    images = []
    for name in argv[2:]:
        data = Path(name).read_bytes()
        width, height = png_size(data)
        if not (1 <= width <= 256 and 1 <= height <= 256):
            raise SystemExit(f"{name}: {width}x{height} is out of range for .ico (1-256)")
        images.append((width, height, data))

    images.sort(key=lambda i: i[0])

    header = struct.pack("<HHH", 0, 1, len(images))
    offset = len(header) + 16 * len(images)

    directory = bytearray()
    for width, height, data in images:
        directory += struct.pack(
            "<BBBBHHII",
            width % 256,   # 0 means 256
            height % 256,
            0,             # palette size: 0 for truecolour
            0,             # reserved
            1,             # colour planes
            32,            # bits per pixel
            len(data),
            offset,
        )
        offset += len(data)

    out.write_bytes(bytes(header) + bytes(directory) + b"".join(d for _, _, d in images))
    print(f"{out}  ({len(images)} entries: {', '.join(str(i[0]) for i in images)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
