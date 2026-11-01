"""Mean sRGB colour of each image, as the 0..1 triple GROUND_SETS records.

    python3 -I scripts/texture-mean.py <image> [<image> ...]

Meant for 8-bit colour maps (the Poly Haven JPGs); 16-bit PNGs are clipped by
Pillow's RGB conversion, so do not read normals or ARM maps with this.
"""

import sys

from PIL import Image, ImageStat

for path in sys.argv[1:]:
    with Image.open(path) as image:
        mean = ImageStat.Stat(image.convert('RGB')).mean
    print(path, ' '.join(f'{channel / 255:.3f}' for channel in mean))
