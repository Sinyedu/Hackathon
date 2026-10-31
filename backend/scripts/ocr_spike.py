"""OCR spike: print recognised text boxes for an image. Usage: python scripts/ocr_spike.py IMAGE"""

import sys
import time

from rapidocr import RapidOCR

engine = RapidOCR()
start = time.time()
result = engine(sys.argv[1])
print(f"{time.time() - start:.2f}s")
for box, text, score in zip(result.boxes, result.txts, result.scores):
    print(f"{score:.2f}  y={box[0][1]:.0f} x={box[0][0]:.0f}  {text}")
