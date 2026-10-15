"""Generate synthetic sample assets (images + ground truth) for the AI-Demos playground.

Every generated image ships with ground-truth annotations so the simulated
inference engine can return coherent, deterministic results for the built-in
samples (instead of random noise).

Run:  python3 scripts/gen_samples.py
"""
import json
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "samples")
os.makedirs(OUT, exist_ok=True)

CJK = "/System/Library/Fonts/STHeiti Medium.ttc"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:  # pragma: no cover
        return ImageFont.load_default()


def norm(boxes, w, h):
    return [
        {"label": b[0], "labelEn": b[1], "x": round(b[2] / w, 5), "y": round(b[3] / h, 5),
         "w": round(b[4] / w, 5), "h": round(b[5] / h, 5)}
        for b in boxes
    ]


gt = {}

# ---------------------------------------------------------------- street scene
def street():
    W, H = 640, 480
    img = Image.new("RGB", (W, H), (222, 222, 222))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(226 - 40 * t), int(226 - 40 * t), int(226 - 40 * t)))
    # road
    d.rectangle([0, 300, W, H], fill=(96, 96, 96))
    for i in range(0, W, 80):
        d.rectangle([i + 20, 380, i + 60, 386], fill=(230, 230, 230))
    # sidewalk
    d.rectangle([0, 288, W, 306], fill=(168, 168, 168))
    boxes = []

    def car(x, y, w, h, body):
        d.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=body)
        d.rectangle([x + 8, y + 6, x + w - 8, y + h * 0.42], fill=(58, 58, 58))
        d.ellipse([x + 6, y + h - 14, x + 26, y + h + 2], fill=(28, 28, 28))
        d.ellipse([x + w - 26, y + h - 14, x + w - 6, y + h + 2], fill=(28, 28, 28))

    car(60, 320, 150, 70, (196, 196, 196))
    boxes.append(("汽车", "car", 60, 320, 150, 70))
    car(430, 316, 160, 74, (150, 150, 150))
    boxes.append(("汽车", "car", 430, 316, 160, 74))

    # traffic light
    d.rectangle([300, 150, 316, 260], fill=(70, 70, 70))
    d.rounded_rectangle([292, 120, 324, 200], radius=8, fill=(48, 48, 48))
    for i, c in enumerate([(210, 210, 210), (120, 120, 120), (90, 90, 90)]):
        d.ellipse([300, 130 + i * 24, 316, 146 + i * 24], fill=c)
    boxes.append(("交通灯", "traffic light", 292, 120, 32, 80))

    # person
    px, py = 250, 200
    d.ellipse([px + 8, py, px + 34, py + 28], fill=(206, 178, 158))
    d.rectangle([px + 4, py + 28, px + 38, py + 78], fill=(64, 64, 80))
    d.rectangle([px + 12, py + 78, px + 20, py + 118], fill=(48, 48, 60))
    d.rectangle([px + 24, py + 78, px + 32, py + 118], fill=(48, 48, 60))
    boxes.append(("行人", "person", px, py, 38, 118))

    # bicycle
    bx, by = 380, 330
    d.ellipse([bx, by, bx + 40, by + 40], outline=(40, 40, 40), width=4)
    d.ellipse([bx + 60, by, bx + 100, by + 40], outline=(40, 40, 40), width=4)
    d.line([bx + 20, by + 20, bx + 70, by + 20], fill=(40, 40, 40), width=4)
    boxes.append(("自行车", "bicycle", bx - 4, by - 6, 108, 52))

    # tree
    d.rectangle([540, 210, 552, 300], fill=(110, 92, 70))
    d.ellipse([512, 150, 580, 220], fill=(112, 128, 112))
    boxes.append(("树", "tree", 512, 150, 68, 70))

    img.save(os.path.join(OUT, "street.png"))
    gt["street.png"] = {"type": "detection", "objects": norm(boxes, W, H), "width": W, "height": H}


# ------------------------------------------------------------------ desk scene
def desk():
    W, H = 640, 480
    img = Image.new("RGB", (W, H), (206, 204, 200))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 150], fill=(190, 188, 184))  # wall
    d.rectangle([0, 150, W, H], fill=(158, 150, 140))  # desk
    boxes = []
    # laptop
    d.rounded_rectangle([150, 130, 430, 300], radius=6, fill=(120, 120, 124))
    d.rectangle([162, 142, 418, 288], fill=(52, 52, 56))
    d.rounded_rectangle([130, 300, 450, 318], radius=4, fill=(140, 140, 144))
    boxes.append(("笔记本电脑", "laptop", 130, 130, 320, 188))
    # keyboard
    d.rounded_rectangle([180, 330, 400, 372], radius=5, fill=(70, 70, 74))
    for r in range(3):
        for c in range(14):
            d.rectangle([186 + c * 15, 336 + r * 11, 196 + c * 15, 344 + r * 11], fill=(150, 150, 154))
    boxes.append(("键盘", "keyboard", 180, 330, 220, 42))
    # mouse
    d.ellipse([430, 334, 476, 386], fill=(78, 78, 82))
    boxes.append(("鼠标", "mouse", 430, 334, 46, 52))
    # cup
    d.ellipse([60, 300, 140, 380], fill=(238, 238, 238))
    d.ellipse([66, 306, 134, 356], fill=(96, 74, 58))
    d.arc([130, 320, 168, 360], start=270, end=90, fill=(238, 238, 238), width=8)
    boxes.append(("杯子", "cup", 60, 300, 80, 80))
    # notebook
    d.rectangle([480, 300, 600, 400], fill=(232, 228, 214))
    d.rectangle([480, 300, 496, 400], fill=(90, 90, 110))
    boxes.append(("书本", "book", 480, 300, 120, 100))
    img.save(os.path.join(OUT, "desk.png"))
    gt["desk.png"] = {"type": "detection", "objects": norm(boxes, W, H), "width": W, "height": H}


# ------------------------------------------------------------------- portrait
def portrait():
    W, H = 480, 640
    img = Image.new("RGB", (W, H), (200, 200, 202))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        v = int(206 - 46 * t)
        d.line([(0, y), (W, y)], fill=(v, v, v))
    # shoulders
    d.ellipse([70, 470, 410, 700], fill=(68, 72, 88))
    # neck
    d.rectangle([200, 400, 280, 500], fill=(212, 176, 152))
    # head
    d.ellipse([130, 120, 350, 420], fill=(226, 190, 166))
    # hair
    d.ellipse([124, 96, 356, 250], fill=(52, 46, 44))
    d.ellipse([130, 150, 350, 400], outline=(226, 190, 166), width=2)
    # eyes
    for ex in (190, 290):
        d.ellipse([ex - 22, 238, ex + 22, 262], fill=(248, 248, 248))
        d.ellipse([ex - 9, 242, ex + 9, 260], fill=(60, 52, 48))
        d.ellipse([ex - 4, 245, ex + 4, 254], fill=(20, 20, 20))
    # brows
    d.line([168, 220, 214, 214], fill=(48, 42, 40), width=6)
    d.line([266, 214, 312, 220], fill=(48, 42, 40), width=6)
    # nose
    d.line([240, 260, 236, 300], fill=(198, 162, 140), width=5)
    d.line([230, 300, 250, 300], fill=(198, 162, 140), width=4)
    # mouth
    d.arc([210, 316, 270, 352], start=15, end=165, fill=(178, 108, 104), width=6)
    img.save(os.path.join(OUT, "portrait.png"))
    gt["portrait.png"] = {
        "type": "face",
        "objects": norm([("人脸", "face", 130, 120, 220, 300)], W, H),
        "width": W,
        "height": H,
    }


# ------------------------------------------------------------------- document
def document():
    W, H = 620, 800
    img = Image.new("RGB", (W, H), (250, 250, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 8], fill=(70, 70, 70))
    lines = []
    y = 60
    f_big = font(CJK, 34)
    f_mid = font(CJK, 22)
    f_en = font(SANS, 22)

    def put(text, x, size_font, fill=(30, 30, 30)):
        nonlocal y
        d.text((x, y), text, font=size_font, fill=fill)
        bb = d.textbbox((x, y), text, font=size_font)
        return bb

    bb = put("INVOICE / 发票", 48, f_big)
    lines.append({"text": "INVOICE / 发票", "x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1]})
    y = 120
    d.line([48, y, W - 48, y], fill=(180, 180, 180), width=2)
    y = 140
    rows = [
        "发票号码 Invoice No.  INV-2026-1008",
        "开票日期 Date        2026-10-08",
        "客户名称 Customer    Acme Technologies Ltd.",
        "地址 Address         上海市浦东新区世纪大道 100 号",
    ]
    for r in rows:
        bb = put(r, 48, f_mid)
        lines.append({"text": r, "x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1]})
        y += 44
    y += 20
    d.line([48, y, W - 48, y], fill=(180, 180, 180), width=2)
    y += 26
    bb = put("Item  Description              Qty   Price", 48, f_en)
    lines.append({"text": "Item  Description              Qty   Price", "x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1]})
    y += 40
    items = [
        "01    Cloud GPU Hours          120   3,600.00",
        "02    Model Fine-tuning         4    1,280.00",
        "03    Storage (TB/month)        12     720.00",
    ]
    for it in items:
        bb = put(it, 48, f_en)
        lines.append({"text": it, "x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1]})
        y += 38
    y += 24
    d.line([48, y, W - 48, y], fill=(120, 120, 120), width=2)
    y += 26
    bb = put("合计 Total (CNY)            5,600.00", 48, font(CJK, 26))
    lines.append({"text": "合计 Total (CNY)            5,600.00", "x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1]})
    y += 70
    bb = put("Thank you for your business.", 48, f_en, fill=(110, 110, 110))
    lines.append({"text": "Thank you for your business.", "x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1]})

    gt_lines = [
        {"text": l["text"], "x": round(l["x"] / W, 5), "y": round(l["y"] / H, 5),
         "w": round(l["w"] / W, 5), "h": round(l["h"] / H, 5)}
        for l in lines
    ]
    img.save(os.path.join(OUT, "document.png"))
    gt["document.png"] = {
        "type": "ocr",
        "lines": gt_lines,
        "text": "\n".join(l["text"] for l in lines),
        "fields": {
            "document_type": "invoice",
            "invoice_no": "INV-2026-1008",
            "date": "2026-10-08",
            "customer": "Acme Technologies Ltd.",
            "address": "上海市浦东新区世纪大道 100 号",
            "currency": "CNY",
            "total": "5,600.00",
            "line_items": [
                {"item": "01", "description": "Cloud GPU Hours", "qty": "120", "price": "3,600.00"},
                {"item": "02", "description": "Model Fine-tuning", "qty": "4", "price": "1,280.00"},
                {"item": "03", "description": "Storage (TB/month)", "qty": "12", "price": "720.00"},
            ],
        },
        "width": W,
        "height": H,
    }


# --------------------------------------------------------------- poster (wm)
def poster():
    W, H = 640, 480
    img = Image.new("RGB", (W, H), (240, 240, 240))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=(int(236 - 70 * y / H), int(238 - 60 * y / H), int(240 - 40 * y / H)))
    d.ellipse([120, 60, 520, 360], fill=(118, 126, 138))
    d.polygon([(80, 400), (300, 200), (560, 400)], fill=(88, 92, 100))
    d.rectangle([0, 400, W, H], fill=(58, 62, 68))
    f = font(SANS, 30)
    d.text((430, 420), "SAMPLE.STUDIO", font=f, fill=(235, 235, 235))
    img.save(os.path.join(OUT, "poster.png"))
    gt["poster.png"] = {"type": "inpainting", "masks": [{"x": 0.66, "y": 0.83, "w": 0.32, "h": 0.14}],
                        "width": W, "height": H}


# ----------------------------------------------------------------- pose body
def fullbody():
    W, H = 480, 720
    img = Image.new("RGB", (W, H), (214, 214, 216))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=(int(219 - 30 * y / H),) * 3)
    d.rectangle([0, 620, W, H], fill=(150, 148, 146))
    cx = 240
    # head
    d.ellipse([cx - 38, 96, cx + 38, 176], fill=(226, 190, 166))
    d.ellipse([cx - 40, 88, cx + 40, 150], fill=(56, 48, 46))
    # torso
    d.rounded_rectangle([cx - 66, 176, cx + 66, 372], radius=26, fill=(72, 78, 96))
    # arms
    d.line([cx - 60, 200, cx - 150, 330], fill=(72, 78, 96), width=30)
    d.line([cx - 150, 330, cx - 190, 450], fill=(72, 78, 96), width=26)
    d.line([cx + 60, 200, cx + 150, 320], fill=(72, 78, 96), width=30)
    d.line([cx + 150, 320, cx + 200, 250], fill=(72, 78, 96), width=26)
    d.ellipse([cx - 216, 436, cx - 164, 480], fill=(226, 190, 166))
    d.ellipse([cx + 180, 224, cx + 226, 266], fill=(226, 190, 166))
    # legs
    d.line([cx - 34, 372, cx - 58, 560], fill=(48, 50, 62), width=38)
    d.line([cx - 58, 560, cx - 66, 654], fill=(48, 50, 62), width=34)
    d.line([cx + 34, 372, cx + 56, 560], fill=(48, 50, 62), width=38)
    d.line([cx + 56, 560, cx + 66, 654], fill=(48, 50, 62), width=34)
    d.ellipse([cx - 104, 640, cx - 28, 672], fill=(36, 36, 38))
    d.ellipse([cx + 28, 640, cx + 104, 672], fill=(36, 36, 38))
    img.save(os.path.join(OUT, "pose.png"))
    gt["pose.png"] = {"type": "pose", "objects": norm([("人体", "person", 24, 88, 432, 588)], W, H),
                      "width": W, "height": H}


def hand():
    W, H = 480, 480
    img = Image.new("RGB", (W, H), (216, 216, 218))
    d = ImageDraw.Draw(img)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=(int(221 - 26 * y / H),) * 3)
    skin = (230, 194, 170)
    d.rounded_rectangle([176, 300, 300, 430], radius=26, fill=skin)   # palm
    angles = [(-58, 92, 58), (-30, 60, 56), (-4, 40, 56), (20, 52, 50)]
    for dx, top, wdt in angles:
        x = 196 + (dx + 58) * 1.05
        d.rounded_rectangle([x, top, x + wdt, 320], radius=wdt // 2, fill=skin)
    # thumb
    d.line([186, 340, 96, 296], fill=skin, width=54)
    d.ellipse([64, 270, 128, 330], fill=skin)
    img.save(os.path.join(OUT, "hand.png"))
    gt["hand.png"] = {"type": "hand", "objects": norm([("手部", "hand", 60, 30, 250, 402)], W, H),
                      "width": W, "height": H}


# --------------------------------------------------------- degraded variants
def degraded():
    src = Image.open(os.path.join(OUT, "street.png")).convert("RGB")
    noise = Image.effect_noise(src.size, 34).convert("L")
    noisy = Image.merge("RGB", [
        Image.blend(Image.blend(src.getchannel(c), src.getchannel(c), 0.0), noise, 0.42)
        for c in ("R", "G", "B")
    ])
    noisy = noisy.filter(ImageFilter.GaussianBlur(1.1))
    noisy.save(os.path.join(OUT, "street-noisy.png"))
    gt["street-noisy.png"] = {"type": "restoration", "reference": "street.png", "width": src.width, "height": src.height}

    small = src.resize((src.width // 3, src.height // 3), Image.BILINEAR).resize(src.size, Image.BILINEAR)
    small.save(os.path.join(OUT, "street-lowres.png"))
    gt["street-lowres.png"] = {"type": "restoration", "reference": "street.png", "width": src.width, "height": src.height}

    port = Image.open(os.path.join(OUT, "portrait.png")).convert("RGB")
    pn = Image.merge("RGB", [
        Image.blend(port.getchannel(c), Image.effect_noise(port.size, 26).convert("L"), 0.35) for c in ("R", "G", "B")
    ])
    pn.save(os.path.join(OUT, "portrait-noisy.png"))
    gt["portrait-noisy.png"] = {"type": "restoration", "reference": "portrait.png", "width": port.width, "height": port.height}


street()
desk()
portrait()
document()
poster()
fullbody()
hand()
degraded()

with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib", "data", "sample-gt.json"), "w") as fh:
    json.dump(gt, fh, ensure_ascii=False, indent=2)

print("generated:", sorted(gt.keys()))
