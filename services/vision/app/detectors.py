"""OpenCV visual detectors: signature ink in a labelled box, circular professional seals."""
from __future__ import annotations

import re

import cv2
import numpy as np

from .ingest import Line, PageImage, Upload


def _box_below_label(img: PageImage, label: Line) -> tuple[int, int, int, int] | None:
    """Find the rectangle drawn just below/right of a 'SIGNATURE' label (in pixels)."""
    s = img.scale
    x0, y0, x1, y1 = label.bbox
    roi_y0, roi_y1 = int(y0 * s), int(min(img.height, y1 + 70) * s)
    roi_x0, roi_x1 = int(max(0, x0 - 10) * s), int(min(img.width, x0 + 260) * s)
    roi = img.gray[roi_y0:roi_y1, roi_x0:roi_x1]
    if roi.size == 0:
        return None
    _, bw = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    label_bottom = (y1 * s) - roi_y0
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        # the box starts just under (or level with) the label and is a signature-sized rectangle
        if not (60 * s < w < 260 * s and 20 * s < h < 70 * s):
            continue
        if not (-6 * s < y - label_bottom < 18 * s):
            continue
        if best is None or w * h < best[2] * best[3]:
            best = (x, y, w, h)
    if not best:
        return None
    x, y, w, h = best
    return roi_x0 + x, roi_y0 + y, w, h


def signature_ink(up: Upload, label_re: str = r"signature") -> tuple[bool | None, tuple | None, int]:
    """(signed?, bbox in points, page). None when no signature box is found."""
    for img in up.images:
        labels = [l for l in up.lines if l.page == img.page and re.search(label_re, l.text, re.I)]
        for lab in labels:
            box = _box_below_label(img, lab)
            if not box:
                continue
            x, y, w, h = box
            mx, my = max(6, w // 12), max(6, h // 6)  # stay clear of the (possibly skewed) border
            inner = img.gray[y + my : y + h - my, x + mx : x + w - mx]
            if inner.size == 0:
                continue
            _, bw = cv2.threshold(inner, 140, 255, cv2.THRESH_BINARY_INV)
            bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))  # drop scanner speckle
            ink = float(np.count_nonzero(bw)) / bw.size
            s = img.scale
            return ink > 0.01, (x / s, y / s, (x + w) / s, (y + h) / s), img.page
    return None, None, 1


def has_stamp(up: Upload) -> tuple[bool, tuple | None, int]:
    """Two concentric circular contours = a professional seal."""
    for img in up.images:
        s = img.scale
        _, bw = cv2.threshold(cv2.medianBlur(img.gray, 3), 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        cnts, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        circles = []
        for c in cnts:
            area, per = cv2.contourArea(c), cv2.arcLength(c, True)
            if per == 0:
                continue
            (cx, cy), r = cv2.minEnclosingCircle(c)
            if 15 * s < r < 70 * s and 4 * np.pi * area / (per * per) > 0.75:
                circles.append((cx, cy, r))
        for a in circles:
            for b in circles:
                if abs(a[0] - b[0]) < 4 * s and abs(a[1] - b[1]) < 4 * s and abs(a[2] - b[2]) > 3 * s:
                    x, y, r = max(a, b, key=lambda t: t[2])
                    return True, ((x - r) / s, (y - r) / s, (x + r) / s, (y + r) / s), img.page
    return False, None, 1


DATE = re.compile(r"date\s*:?\s*\d{4}[-/]\d{2}[-/]\d{2}|date\s*:?\s*\d{1,2}\s+\w+\s+\d{4}", re.I)


def dated(up: Upload) -> bool:
    return bool(DATE.search(up.text))
