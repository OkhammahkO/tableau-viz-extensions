"""Generate seeded synthetic datasets for testing distribution charts (raincloud, violin, histogram).

Usage:
    python -I scripts/make_synthetic.py            # all datasets
    python -I scripts/make_synthetic.py --no-large # skip the 10k / 100k row files

Writes CSVs to data/synthetic/. Same seed → identical files, so the dev harness and Tableau
see exactly the same data. Every file has a row_id: put it on Detail in Tableau so the view
has one mark per record (otherwise Tableau aggregates and there's no distribution to draw).
"""

import csv
import math
import random
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "synthetic"
SEGMENTS = ["Alpha", "Beta"]
REGIONS = ["North", "South", "East", "West"]


def write(name: str, header: list[str], rows: list[list]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["row_id", *header])
        for i, r in enumerate(rows, 1):
            w.writerow([i, *r])
    print(f"  {name:28} {len(rows):>7,} rows")


def fmt(v: float | None, dp: int = 2):
    return "" if v is None else round(v, dp)


def extras(rng: random.Random) -> list[str]:
    return [rng.choice(SEGMENTS), rng.choice(REGIONS)]


def quirks(rng):
    """The gallery groups: each defeats a box plot in a different way."""
    rows = []
    for _ in range(110):
        rows.append(["Group A (uniform)", fmt(rng.uniform(25, 75)), *extras(rng)])
    rows.append(["Group A (uniform)", 118, *extras(rng)])
    for _ in range(70):
        rows.append(["Group B (gap at median)", fmt(rng.gauss(37, 4.5)), *extras(rng)])
        rows.append(["Group B (gap at median)", fmt(rng.gauss(66, 4.5)), *extras(rng)])
    for _ in range(120):
        rows.append(["Group C (whole numbers)", round(rng.gauss(52, 9)), *extras(rng)])
    rows += [["Group C (whole numbers)", -6, *extras(rng)], ["Group C (whole numbers)", 131, *extras(rng)]]
    write("quirks.csv", ["category", "value", "segment", "region"], rows)


def skewed(rng):
    """Right-skewed delivery times: long tails, where histogram vs density and truncation matter."""
    couriers = {"Courier X": (3.4, 0.35), "Courier Y": (3.6, 0.5), "Courier Z": (3.2, 0.7)}
    rows = []
    for name, (mu, sigma) in couriers.items():
        for _ in range(400):
            rows.append([name, fmt(rng.lognormvariate(mu, sigma), 1), *extras(rng)])
    write("skewed_delivery_minutes.csv", ["courier", "delivery_minutes", "segment", "region"], rows)


def outliers(rng):
    """Response times with ~1% extreme outliers: P1–P99 truncation should rescue the view."""
    rows = []
    for name, mean in {"Server 1": 120, "Server 2": 150, "Server 3": 135}.items():
        for _ in range(500):
            v = rng.gauss(mean, 18)
            if rng.random() < 0.01:
                v *= rng.uniform(8, 25)
            rows.append([name, fmt(max(1, v), 0), *extras(rng)])
    write("outliers_response_ms.csv", ["server", "response_ms", "segment", "region"], rows)


def likert(rng):
    """Discrete 1–5 survey scores: heavy ties, where a histogram cloud and dot stacking shine."""
    weights = {
        "Sales": [5, 10, 25, 40, 20],
        "Support": [20, 25, 20, 20, 15],  # flat-ish
        "Engineering": [3, 7, 15, 35, 40],
        "Finance": [30, 10, 10, 10, 40],  # polarised
    }
    rows = []
    for dept, w in weights.items():
        for _ in range(150):
            rows.append([dept, rng.choices([1, 2, 3, 4, 5], weights=w)[0], *extras(rng)])
    write("likert_satisfaction.csv", ["department", "score", "segment", "region"], rows)


def small_n(rng):
    """Tiny groups and a zero-variance group: density must not pretend to know the shape."""
    rows = []
    for name, n in {"n = 1": 1, "n = 3": 3, "n = 8": 8, "n = 15": 15, "n = 60": 60}.items():
        for _ in range(n):
            rows.append([name, fmt(rng.gauss(50, 10)), *extras(rng)])
    for _ in range(20):
        rows.append(["Constant (all 42)", 42, *extras(rng)])
    write("small_n.csv", ["category", "value", "segment", "region"], rows)


def many_categories(rng):
    """24 categories with varied centre, spread and size: layout, labels and colour pressure."""
    rows = []
    for i in range(24):
        name = f"Store {i + 1:02d}"
        mu, sd, n = rng.uniform(30, 70), rng.uniform(4, 15), rng.randint(20, 150)
        for _ in range(n):
            rows.append([name, fmt(rng.gauss(mu, sd)), *extras(rng)])
    write("many_categories.csv", ["store", "value", "segment", "region"], rows)


def edge_cases(rng):
    """Nulls, negatives, zeros, an all-null group: the extension must not crash or lie."""
    rows = []
    for _ in range(80):
        rows.append(["Mixed sign", fmt(rng.gauss(0, 25)), *extras(rng)])
    for _ in range(60):
        rows.append(["Mostly zero", 0 if rng.random() < 0.7 else fmt(rng.uniform(1, 30)), *extras(rng)])
    for _ in range(50):
        rows.append(["Some nulls", None if rng.random() < 0.3 else fmt(rng.gauss(40, 8)), *extras(rng)])
    for _ in range(10):
        rows.append(["All null", None, *extras(rng)])
    for _ in range(40):
        rows.append([None, fmt(rng.gauss(55, 5)), *extras(rng)])  # null category
    write("edge_cases.csv", ["category", "value", "segment", "region"], rows)


def repeated(rng):
    """40 participants measured three times: for ggrain-style linking lines later."""
    rows = []
    for p in range(1, 41):
        person = rng.gauss(0, 6)
        group = "Treatment" if p % 2 else "Control"
        effect = {"Pre": 0, "Post": 8 if group == "Treatment" else 1, "Follow-up": 5 if group == "Treatment" else 0}
        for t, e in effect.items():
            rows.append([f"P{p:02d}", group, t, fmt(50 + person + e + rng.gauss(0, 3))])
    write("repeated_measures.csv", ["participant", "group", "time", "score"], rows)


def large(rng, total: int, name: str):
    """Performance: 4 categories, mixed shapes."""
    rows = []
    per = total // 4
    for _ in range(per):
        rows.append(["Normal", fmt(rng.gauss(50, 10)), *extras(rng)])
        rows.append(["Skewed", fmt(rng.lognormvariate(3.5, 0.5)), *extras(rng)])
        rows.append(["Bimodal", fmt(rng.gauss(35, 5) if rng.random() < 0.5 else rng.gauss(65, 5)), *extras(rng)])
        rows.append(["Uniform", fmt(rng.uniform(10, 90)), *extras(rng)])
    write(name, ["category", "value", "segment", "region"], rows)


def main() -> None:
    print(f"writing to {OUT}")
    # One generator per dataset, each with its own seed, so adding a dataset never changes the others.
    quirks(random.Random(11))
    skewed(random.Random(12))
    outliers(random.Random(13))
    likert(random.Random(14))
    small_n(random.Random(15))
    many_categories(random.Random(16))
    edge_cases(random.Random(17))
    repeated(random.Random(18))
    if "--no-large" not in sys.argv:
        large(random.Random(19), 10_000, "large_10k.csv")
        large(random.Random(20), 100_000, "large_100k.csv")


if __name__ == "__main__":
    main()
