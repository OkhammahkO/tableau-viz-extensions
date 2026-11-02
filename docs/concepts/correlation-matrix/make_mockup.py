"""Static design mock-up for candidate 6 (correlation / scatterplot matrix). Writes mockup.html next to this file.

Run: python -I docs/concepts/correlation-matrix/make_mockup.py
Synthetic, seeded data: five measures with known relationships (strong, weak, negative, none, and a curved one where
Spearman and Pearson differ), plus one outlier. Pure Python, no dependencies; the page is self-contained SVG.
"""

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent / "mockup.html"
rng = random.Random(7)
N = 220

# --- data ----------------------------------------------------------------------------------------------------------
income = [rng.gauss(52, 12) for _ in range(N)]
spend = [0.62 * i + rng.gauss(0, 6) for i in income]  # strong positive
visits = [max(0.5, 2 + 0.05 * s + rng.gauss(0, 1.6)) for s in spend]  # moderate positive
days_since = [max(0.2, 40 * math.exp(-0.35 * v) + rng.gauss(0, 2.2)) for v in visits]  # curved negative
basket = [rng.gauss(30, 7) for _ in range(N)]  # unrelated
income[0], spend[0] = 118.0, 22.0  # one outlier, to show why rank correlation is offered
VARS = [("Income", income), ("Spend", spend), ("Visits", visits), ("Days since visit", days_since), ("Basket size", basket)]
HIGHLIGHT = 37  # one record, shown highlighted in every scatter (linked hover/selection)


def pearson(a, b):
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return cov / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))


def ranks(a):
    order = sorted(range(len(a)), key=lambda i: a[i])
    r = [0.0] * len(a)
    for k, i in enumerate(order):
        r[i] = k + 1.0
    return r


def spearman(a, b):
    return pearson(ranks(a), ranks(b))


# --- drawing ---------------------------------------------------------------------------------------------------------
CELL, GAP, LEFT, TOP = 118, 10, 44, 14
n = len(VARS)
W = LEFT + n * CELL + (n - 1) * GAP + 12
H = TOP + n * CELL + (n - 1) * GAP + 34
POINT, TEXT, MUTED, GRID = "#4e79a7", "#333333", "#6b7280", "#e5e7eb"
POS, NEG, ACCENT = "#2f6aa3", "#c2512b", "#f28e2b"


def rng_of(vals):
    lo, hi = min(vals), max(vals)
    pad = (hi - lo) * 0.04
    return lo - pad, hi + pad


RANGES = [rng_of(v) for _, v in VARS]


def nice_ticks(lo, hi, count=3):
    step = 10 ** math.floor(math.log10((hi - lo) / count))
    for m in (1, 2, 5, 10):
        if (hi - lo) / (step * m) <= count:
            step *= m
            break
    t = math.ceil(lo / step) * step
    out = []
    while t <= hi:
        out.append(round(t, 6))
        t += step
    return out


def cell_xy(i, j):
    return LEFT + j * (CELL + GAP), TOP + i * (CELL + GAP)


def sx(j, v, x0):
    lo, hi = RANGES[j]
    return x0 + (v - lo) / (hi - lo) * CELL


def sy(i, v, y0):
    lo, hi = RANGES[i]
    return y0 + CELL - (v - lo) / (hi - lo) * CELL


def scatter(i, j, method):
    x0, y0 = cell_xy(i, j)
    xs, ys = VARS[j][1], VARS[i][1]
    parts = [f'<rect x="{x0}" y="{y0}" width="{CELL}" height="{CELL}" fill="#fafafa"/>']
    parts += [f'<circle cx="{sx(j, a, x0):.1f}" cy="{sy(i, b, y0):.1f}" r="1.7" fill="{POINT}" fill-opacity="0.38"/>' for a, b in zip(xs, ys)]
    # Thin least-squares line: direction at a glance, little ink.
    mx, my = sum(xs) / N, sum(ys) / N
    slope = sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sum((a - mx) ** 2 for a in xs)
    lo, hi = RANGES[j]
    ya, yb = my + slope * (lo - mx), my + slope * (hi - mx)
    parts.append(f'<line x1="{x0}" y1="{sy(i, ya, y0):.1f}" x2="{x0 + CELL}" y2="{sy(i, yb, y0):.1f}" stroke="{TEXT}" stroke-opacity="0.45" stroke-width="1" clip-path="url(#c{i}{j})"/>')
    parts.insert(0, f'<clipPath id="c{i}{j}"><rect x="{x0}" y="{y0}" width="{CELL}" height="{CELL}"/></clipPath>')
    hx, hy = sx(j, xs[HIGHLIGHT], x0), sy(i, ys[HIGHLIGHT], y0)
    parts.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="3.6" fill="{ACCENT}" stroke="#fff" stroke-width="1.2"/>')
    return "".join(parts)


def diagonal(i):
    x0, y0 = cell_xy(i, i)
    vals = VARS[i][1]
    lo, hi = RANGES[i]
    bins = 16
    counts = [0] * bins
    for v in vals:
        counts[min(bins - 1, int((v - lo) / (hi - lo) * bins))] += 1
    top = max(counts)
    bw = CELL / bins
    parts = []
    for k, c in enumerate(counts):
        if not c:
            continue
        h = c / top * (CELL - 30)
        parts.append(f'<rect x="{x0 + k * bw + 0.5:.1f}" y="{y0 + CELL - h:.1f}" width="{bw - 1:.1f}" height="{h:.1f}" fill="{POINT}" fill-opacity="0.55"/>')
    parts.append(f'<line x1="{x0}" x2="{x0 + CELL}" y1="{y0 + CELL}" y2="{y0 + CELL}" stroke="{MUTED}" stroke-width="0.8"/>')
    # The variable name lives on the diagonal: it labels its row and its column, so no separate headers are needed.
    parts.append(f'<text x="{x0 + 2}" y="{y0 + 13}" font-size="12" font-weight="600" fill="{TEXT}">{VARS[i][0]}</text>')
    return "".join(parts)


def coefficient(i, j, method):
    x0, y0 = cell_xy(i, j)
    a, b = VARS[i][1], VARS[j][1]
    r = spearman(a, b) if method == "spearman" else pearson(a, b)
    mag = abs(r)
    colour = MUTED if mag < 0.1 else POS if r > 0 else NEG
    size = 13 + 17 * mag
    txt = ("−" if r < 0 else "") + f"{mag:.2f}".lstrip("0")
    tint = f'<rect x="{x0}" y="{y0}" width="{CELL}" height="{CELL}" fill="{colour}" fill-opacity="{0.04 + 0.16 * mag:.3f}"/>'
    return tint + f'<text x="{x0 + CELL / 2}" y="{y0 + CELL / 2 + size * 0.35:.1f}" text-anchor="middle" font-size="{size:.1f}" font-weight="600" fill="{colour}" style="font-variant-numeric: tabular-nums">{txt}</text>'


def axes():
    parts = []
    for j in range(n):  # bottom row: x ticks
        x0, y0 = cell_xy(n - 1, j)
        for t in nice_ticks(*RANGES[j]):
            px = sx(j, t, x0)
            parts.append(f'<text x="{px:.1f}" y="{y0 + CELL + 13}" text-anchor="middle" font-size="9.5" fill="{MUTED}">{t:g}</text>')
    for i in range(1, n):  # left column: y ticks (row 0's left cell is the diagonal histogram, which has no y scale)
        x0, y0 = cell_xy(i, 0)
        for t in nice_ticks(*RANGES[i]):
            py = sy(i, t, y0)
            parts.append(f'<text x="{x0 - 5}" y="{py + 3:.1f}" text-anchor="end" font-size="9.5" fill="{MUTED}">{t:g}</text>')
    return "".join(parts)


def matrix(method):
    body = []
    for i in range(n):
        for j in range(n):
            body.append(diagonal(i) if i == j else scatter(i, j, method) if i > j else coefficient(i, j, method))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">{"".join(body)}{axes()}</svg>'


page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Correlation matrix mock-up</title>
<style>
body {{ margin: 0; padding: 24px; background: #f3f4f6; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #222; }}
h1 {{ font-size: 19px; margin: 0 0 4px; }} h2 {{ font-size: 15px; margin: 0 0 8px; }}
p {{ margin: 0 0 14px; color: #555; max-width: 980px; }}
.row {{ display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }}
figure {{ margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 14px; }}
figcaption {{ font-size: 13px; color: #555; margin-top: 8px; max-width: 640px; }}
ul {{ margin: 0 0 14px; color: #555; max-width: 980px; }}
</style></head><body>
<h1>Correlation matrix · design mock-up (candidate 6)</h1>
<p>Synthetic data, 220 records, five measures with known relationships: strong (Income–Spend), moderate
(Spend–Visits), curved negative (Visits–Days since visit), none (Basket size), and one outlier (top-right of
Income–Spend). Below the diagonal: every pair as a scatter with a thin least-squares line. On the diagonal: each
measure's histogram, labelled with its name (it labels the row and the column, so no headers). Above the diagonal:
the coefficient, sized and tinted by strength, blue positive, orange-red negative, grey near zero.
The orange dot is one record, highlighted in every scatter (what hover or selection would do).</p>
<ul>
<li>Ink: no cell borders or gridlines; tick labels only on the outer edges; points small and translucent.</li>
<li>Pearson vs Spearman: compare Visits–Days since visit (curved) and Income–Spend (outlier).</li>
</ul>
<div class="row">
<figure>{matrix("pearson")}<figcaption><b>Pearson r</b> (linear). Default in most tools.</figcaption></figure>
<figure>{matrix("spearman")}<figcaption><b>Spearman ρ</b> (rank). Robust to the outlier and catches the curved, monotonic
Visits–Days relationship more fully.</figcaption></figure>
</div>
</body></html>"""
OUT.write_text(page, encoding="utf-8")
print(f"wrote {OUT}")
