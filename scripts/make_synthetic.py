"""Generate seeded synthetic datasets for testing distribution charts (raincloud, violin, histogram).

Usage:
    python -I scripts/make_synthetic.py            # all datasets
    python -I scripts/make_synthetic.py --no-large # skip the large_* files (10k, 100k, grid)

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


def basket(rng, mu=3.6, sigma=0.55):
    """A right-skewed basket value (lognormal-ish), in currency units."""
    return fmt(math.exp(rng.gauss(mu, sigma)))


def spikes_grid(rng):
    """Rows x Columns grid where one cell has a big spike: a pile of zeros (abandoned baskets) that, with shared
    scales, squashes every other cell's dots and cloud (user report 2026-11-02). Also a tiny cell, an empty cell
    and a rare segment, for split-cloud sizing."""
    rows = []
    segment = lambda: rng.choices(["Alpha", "Beta", "Gamma"], weights=[60, 35, 5])[0]
    for s in range(1, 13):
        store = f"Store {s:02d}"
        for channel in ("Online", "In store"):
            if (store, channel) == ("Store 10", "Online"):
                continue  # no sales: an empty cell
            n = 8 if (store, channel) == ("Store 07", "In store") else rng.randint(120, 200)
            mu = 3.4 + 0.05 * s + (0.2 if channel == "Online" else 0)
            for _ in range(n):
                rows.append([store, channel, segment(), basket(rng, mu)])
            if (store, channel) == ("Store 03", "Online"):
                for _ in range(1000):
                    rows.append([store, channel, segment(), 0 if rng.random() < 0.85 else basket(rng, mu)])
    write("spikes_grid.csv", ["store", "channel", "segment", "basket_value"], rows)


def large_grid(rng):
    """Dense small multiples with many dots: 40 stores x 3 regions, 4 segments, ~60k records. One 10k-record cell,
    spike cells (zeros, ties at round numbers) and quiet cells side by side."""
    rows = []
    segs, weights = ["Alpha", "Beta", "Gamma", "Delta"], [45, 30, 20, 5]
    for s in range(1, 41):
        store = f"Store {s:02d}"
        for region in ("North", "South", "West"):
            n = 10_000 if (s, region) == (5, "North") else rng.randint(150, 650)
            mu = 3.3 + 0.02 * s + {"North": 0, "South": 0.15, "West": -0.1}[region]
            for _ in range(n):
                if s % 9 == 0 and region == "South" and rng.random() < 0.6:
                    v = 0  # spike of zeros
                elif s % 7 == 0 and region == "West" and rng.random() < 0.5:
                    v = rng.choice([25, 50, 75, 100])  # ties at round prices
                else:
                    v = basket(rng, mu, 0.5)
                rows.append([store, region, rng.choices(segs, weights=weights)[0], v])
    write("large_grid.csv", ["store", "region", "segment", "basket_value"], rows)


# --- Correlation matrix (candidate 6) -------------------------------------------------------------------------------

def corr_customers(rng):
    """The gallery's data: 7 measures with known relationships. Income-Spend strong (+ one outlier), Spend-Visits
    moderate, Visits-Days since visit curved negative, Basket size unrelated, Tenure-Satisfaction negative overall but
    positive within each channel (Simpson's paradox: colour by channel)."""
    rows = []
    for i in range(600):
        channel = "In store" if i % 2 else "Online"
        g = 1 if channel == "In store" else 0
        income = rng.gauss(52, 12) - g * 4
        spend = 0.62 * income + rng.gauss(0, 6)
        visits = max(0.5, 2 + 0.05 * spend + rng.gauss(0, 1.6))
        days = max(0.2, 40 * math.exp(-0.35 * visits) + rng.gauss(0, 2.2))
        basket_size = rng.gauss(30, 7)
        tenure = max(0.2, 2 + g * 6 + rng.gauss(0, 1.6))
        satisfaction = 6.2 + 0.32 * tenure - g * 3.4 + rng.gauss(0, 0.55)
        if i == 0:
            income, spend = 120, 20  # the outlier
        rows.append([channel, rng.choice(REGIONS), fmt(income, 1), fmt(spend, 1), fmt(visits, 1), fmt(days, 1),
                     fmt(basket_size, 1), fmt(tenure, 1), fmt(satisfaction, 2)])
    write("corr_customers.csv", ["channel", "region", "income_k", "spend_k", "visits_per_month", "days_since_visit",
                                 "basket_size", "tenure_years", "satisfaction"], rows)


def corr_health_8(rng):
    """8 measures in two correlated blocks (body: age, BMI, blood pressure, cholesterol; lifestyle: steps, sleep,
    screen time, stress) with a few cross-links (steps lowers BMI, stress raises blood pressure). For legibility at 8
    measures and for variable ordering (clustered order puts each block together)."""
    rows = []
    for _ in range(1000):
        age = rng.uniform(20, 75)
        steps = max(500, rng.gauss(8000, 2800) - 40 * (age - 45))
        screen = max(0.3, rng.gauss(4.5, 1.6) - 0.02 * (age - 45))
        sleep = max(3.5, min(10, rng.gauss(7.2, 0.9) - 0.18 * (screen - 4.5)))
        stress = max(1, min(10, rng.gauss(5, 1.6) + 0.35 * (screen - 4.5) - 0.5 * (sleep - 7.2)))
        bmi = max(16, rng.gauss(26, 3.5) + 0.04 * (age - 45) - 0.00035 * (steps - 8000))
        bp = rng.gauss(122, 10) + 0.45 * (age - 45) + 0.9 * (bmi - 26) + 1.8 * (stress - 5)
        chol = rng.gauss(195, 28) + 0.8 * (age - 45) + 1.6 * (bmi - 26)
        rows.append([rng.choice(["Clinic A", "Clinic B", "Clinic C"]), fmt(age, 0), fmt(bmi, 1), fmt(bp, 0), fmt(chol, 0),
                     fmt(steps, 0), fmt(sleep, 1), fmt(screen, 1), fmt(stress, 1)])
    write("corr_health_8.csv", ["clinic", "age", "bmi", "blood_pressure", "cholesterol", "steps", "sleep_hours",
                                "screen_time_hours", "stress_score"], rows)


def corr_anscombe(_rng):
    """Anscombe's quartet (1973, a published dataset): four x/y pairs with nearly the same mean, variance and
    r (about 0.82) but very different shapes: linear, curved, one outlier, one leverage point."""
    x123 = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5]
    y1 = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]
    y2 = [9.14, 8.14, 8.74, 8.77, 9.26, 8.10, 6.13, 3.10, 9.13, 7.26, 4.74]
    y3 = [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73]
    x4 = [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8]
    y4 = [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.50, 5.56, 7.91, 6.89]
    rows = [[x123[i], y1[i], x123[i], y2[i], x123[i], y3[i], x4[i], y4[i]] for i in range(11)]
    write("corr_anscombe.csv", ["x1", "y1", "x2", "y2", "x3", "y3", "x4", "y4"], rows)


def corr_edge_cases(rng):
    """Robustness: a constant measure (r undefined), nulls in some measures (pairwise n differs), Likert 1-5 ties,
    negative values, a perfect correlation (y = 2x + 3), a perfect negative one, and a 0/1 measure."""
    rows = []
    for _ in range(300):
        a = rng.gauss(0, 10)  # includes negatives
        rows.append([
            rng.choice(SEGMENTS),
            fmt(a, 2),
            fmt(2 * a + 3, 2),                                       # perfect positive with a
            fmt(-0.5 * a + 1, 2),                                    # perfect negative with a
            42,                                                      # constant: no variance
            None if rng.random() < 0.25 else fmt(a + rng.gauss(0, 8), 2),  # 25% nulls
            max(1, min(5, round(3 + a / 8 + rng.gauss(0, 0.9)))),    # Likert ties
            1 if a + rng.gauss(0, 6) > 0 else 0,                     # binary
        ])
    write("corr_edge_cases.csv", ["segment", "a", "a_times_2_plus_3", "minus_half_a", "constant", "a_with_nulls",
                                  "likert_1_5", "binary_0_1"], rows)


def corr_groups(rng):
    """Colour-field cases: `tier` has two unbalanced members (95% Standard, 5% Premium, with an opposite slope: its
    points are easy to lose and its per-group r rests on few records); `store` has 25 members (past Tableau 20: the
    smallest fold into Other); `segment` has nulls (a "Null" member). Rows are SORTED by tier, so a renderer that
    draws points in data order paints Premium on top of everything."""
    rows = []
    for i in range(800):
        premium = rng.random() < 0.05
        x = rng.gauss(50, 10)
        y = (90 - 0.8 * x if premium else 10 + 0.7 * x) + rng.gauss(0, 5)
        z = 0.4 * x + rng.gauss(20, 6)
        store = f"Store {1 + min(24, int(rng.expovariate(0.12))):02d}"  # uneven sizes
        segment = None if rng.random() < 0.08 else rng.choice(["Retail", "Trade", "Online"])
        rows.append(["Premium" if premium else "Standard", store, segment, fmt(x, 1), fmt(y, 1), fmt(z, 1)])
    rows.sort(key=lambda r: r[0] == "Premium")  # Standard first, Premium last
    write("corr_groups.csv", ["tier", "store", "segment", "price", "demand", "margin"], rows)


def large_corr(rng, total, name):
    """Performance and the density-cell switch: 6 related measures, a 3-member group."""
    rows = []
    for _ in range(total):
        g = rng.choice(["North", "South", "West"])
        x = rng.gauss(50, 12)
        y = 0.7 * x + rng.gauss(0, 8)
        z = rng.gauss(30, 6) + (6 if g == "South" else 0)
        w = 100 - 0.5 * y + rng.gauss(0, 7)
        v = math.exp(rng.gauss(2.5, 0.5))  # skewed
        u = 0.3 * x + 0.3 * z + rng.gauss(0, 6)
        rows.append([g, fmt(x, 1), fmt(y, 1), fmt(z, 1), fmt(w, 1), fmt(v, 1), fmt(u, 1)])
    write(name, ["region", "m1", "m2", "m3", "m4", "m5_skewed", "m6"], rows)


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
    spikes_grid(random.Random(21))
    corr_customers(random.Random(23))
    corr_health_8(random.Random(24))
    corr_anscombe(None)
    corr_edge_cases(random.Random(25))
    corr_groups(random.Random(27))
    if "--no-large" not in sys.argv:
        large(random.Random(19), 10_000, "large_10k.csv")
        large(random.Random(20), 100_000, "large_100k.csv")
        large_grid(random.Random(22))
        large_corr(random.Random(26), 100_000, "large_corr_100k.csv")


if __name__ == "__main__":
    main()
