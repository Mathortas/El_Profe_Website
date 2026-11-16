"""Arma app/src/data/world.json a partir de transfermarkt-datasets.zip.

Uso:  python data/pipeline/build_world.py [ruta_al_zip]
Requiere: pandas, pycountry.

Salida (compacta, en arreglos):
  nations: [codigo, nombre_es, iso_bandera, confederacion, ranking_fifa]
  leagues: {codigo: [nombre, iso_bandera]}
  players: [id, nombre, nacion, nacion2, anio_nac, mes_nac, puesto, pie, altura,
            valor_k, valor_max_k, valor_hace_un_anio_k, club, liga,
            minutos, partidos, goles, asistencias, caps, goles_seleccion]
"""
import gettext
import io
import json
import sys
import zipfile
from pathlib import Path

import pandas as pd
import pycountry

ROOT = Path(__file__).resolve().parents[2]
ZIP = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/raw/transfermarkt-datasets.zip"
OUT = ROOT / "app/src/data/world.json"
SEASON_START = "2025-07-01"

# Nombres de Transfermarkt que pycountry no resuelve solo: (iso2 para la bandera, codigo, nombre)
SPECIAL = {
    "England": ("gb-eng", "ENG", "Inglaterra"), "Scotland": ("gb-sct", "SCO", "Escocia"),
    "Wales": ("gb-wls", "WAL", "Gales"), "Northern Ireland": ("gb-nir", "NIR", "Irlanda del Norte"),
    "Korea, South": ("kr", "KOR", "Corea del Sur"), "Korea, North": ("kp", "PRK", "Corea del Norte"),
    "Türkiye": ("tr", "TUR", "Turquía"), "Turkey": ("tr", "TUR", "Turquía"),
    "Czech Republic": ("cz", "CZE", "República Checa"), "Russia": ("ru", "RUS", "Rusia"),
    "Iran": ("ir", "IRN", "Irán"), "Syria": ("sy", "SYR", "Siria"),
    "Cote d'Ivoire": ("ci", "CIV", "Costa de Marfil"), "DR Congo": ("cd", "COD", "RD Congo"),
    "Bosnia-Herzegovina": ("ba", "BIH", "Bosnia y Herzegovina"), "Kosovo": ("xk", "KVX", "Kosovo"),
    "Cape Verde": ("cv", "CPV", "Cabo Verde"), "Curacao": ("cw", "CUW", "Curazao"),
    "United States": ("us", "USA", "Estados Unidos"), "Chinese Taipei": ("tw", "TPE", "China Taipéi"),
    "Hongkong": ("hk", "HKG", "Hong Kong"), "Palestine": ("ps", "PLE", "Palestina"),
    "The Gambia": ("gm", "GAM", "Gambia"), "Moldova": ("md", "MDA", "Moldavia"),
    "Tanzania": ("tz", "TAN", "Tanzania"), "Venezuela": ("ve", "VEN", "Venezuela"),
    "Bolivia": ("bo", "BOL", "Bolivia"), "Vietnam": ("vn", "VIE", "Vietnam"),
    "Brunei Darussalam": ("bn", "BRU", "Brunéi"), "Laos": ("la", "LAO", "Laos"),
    "Macedonia": ("mk", "MKD", "Macedonia del Norte"), "North Macedonia": ("mk", "MKD", "Macedonia del Norte"),
    "Ireland": ("ie", "IRL", "Irlanda"), "Netherlands": ("nl", "NED", "Países Bajos"),
    "Algeria": ("dz", "ALG", "Argelia"), "Tunisia": ("tn", "TUN", "Túnez"),
    "Saudi Arabia": ("sa", "KSA", "Arabia Saudita"), "United Arab Emirates": ("ae", "UAE", "Emiratos Árabes"),
}
# ISO alfa-3 -> codigo usado en el futbol cuando difiere
FIFA = {"DEU": "GER", "NLD": "NED", "PRT": "POR", "CHE": "SUI", "HRV": "CRO", "DNK": "DEN", "URY": "URU",
        "PRY": "PAR", "CHL": "CHI", "GRC": "GRE", "BGR": "BUL", "ZAF": "RSA", "SAU": "KSA", "DZA": "ALG",
        "CRI": "CRC", "HND": "HON", "GTM": "GUA", "HTI": "HAI", "IDN": "IDN", "MYS": "MAS", "PHL": "PHI",
        "ARE": "UAE", "KWT": "KUW", "OMN": "OMA", "LVA": "LVA", "SVN": "SVN", "NGA": "NGA", "ZMB": "ZAM",
        "ZWE": "ZIM", "AGO": "ANG", "BFA": "BFA", "GIN": "GUI", "TGO": "TOG", "MRT": "MTN", "LBY": "LBY",
        "SDN": "SDN", "GNQ": "EQG", "MDG": "MAD", "MOZ": "MOZ", "TCD": "CHA", "BHR": "BHR", "LBN": "LBN",
        "NPL": "NEP", "SGP": "SIN", "THA": "THA", "PRI": "PUR", "TTO": "TRI", "SLV": "SLV", "NIC": "NCA",
        "PAN": "PAN", "FJI": "FIJ", "NZL": "NZL", "LIE": "LIE", "MCO": "MON", "AND": "AND", "SMR": "SMR",
        "MLT": "MLT", "BLR": "BLR", "GMB": "GAM", "MMR": "MYA", "KHM": "CAM", "BGD": "BAN", "BTN": "BHU",
        "MNG": "MNG", "TKM": "TKM", "TJK": "TJK", "KGZ": "KGZ", "IRQ": "IRQ", "YEM": "YEM", "JOR": "JOR"}
ES = gettext.translation("iso3166-1", pycountry.LOCALES_DIR, languages=["es"])
POS = {"Goalkeeper": "POR", "Centre-Back": "DFC", "Left-Back": "LI", "Right-Back": "LD",
       "Defensive Midfield": "MCD", "Central Midfield": "MC", "Attacking Midfield": "MCO",
       "Left Midfield": "MI", "Right Midfield": "MD", "Left Winger": "EI", "Right Winger": "ED",
       "Centre-Forward": "DC", "Second Striker": "DC"}
POS_BROAD = {"Goalkeeper": "POR", "Defender": "DFC", "Midfield": "MC", "Attack": "DC"}


def resolve(name):
    """Devuelve (iso_bandera, codigo, nombre_es) o None."""
    if name in SPECIAL:
        return SPECIAL[name]
    try:
        c = pycountry.countries.lookup(name)
    except LookupError:
        return None
    es = ES.gettext(c.name)
    return (c.alpha_2.lower(), FIFA.get(c.alpha_3, c.alpha_3), es.split(",")[0])


JUNK = [" S.p.A.", " S.A.D.", " SAD", " Football Club", " Foot-Ball", " Futebol Clube", " Fútbol Club",
        " Club de Fútbol", " Calcio", " Società Sportiva", "Società Sportiva ", "Associazione Sportiva ",
        "Associazione Calcio ", "Club Atlético ", "Sociedade Esportiva ", "Clube de Regatas do ", "Sport Club ",
        "Football Club ", "Futebol Clube do ", " Fußball-Club", "Real Club Deportivo ", "Club de Regatas "]


def short(name):
    for j in JUNK:
        name = name.replace(j, " " if j.startswith(" ") and j.endswith(" ") else "")
    return " ".join(name.split())[:28]


def k(v):
    return 0 if pd.isna(v) else int(round(float(v) / 1000))


def main():
    z = zipfile.ZipFile(ZIP)
    rd = lambda n, **kw: pd.read_csv(io.BytesIO(z.read(n)), compression="gzip", low_memory=False, **kw)
    teams, players, clubs, comps = rd("national_teams.csv.gz"), rd("players.csv.gz"), rd("clubs.csv.gz"), rd("competitions.csv.gz")

    # Rendimiento de la ultima temporada
    app = rd("appearances.csv.gz", usecols=["player_id", "date", "goals", "assists", "minutes_played"])
    app = app[app.date >= SEASON_START]
    stats = app.groupby("player_id").agg(m=("minutes_played", "sum"), g=("goals", "sum"), a=("assists", "sum"), n=("date", "count"))

    # Valor de hace un ano, para estimar la trayectoria
    val = rd("player_valuations.csv.gz", usecols=["player_id", "date", "market_value_in_eur"])
    old = val[val.date < SEASON_START].sort_values("date").groupby("player_id").market_value_in_eur.last()

    club_name = dict(zip(clubs.club_id, clubs.name))
    unresolved, nations, nat_of = set(), [], {}
    for _, t in teams.iterrows():
        r = resolve(t.country_name)
        if not r or not isinstance(t.confederation, str):
            unresolved.add(t.country_name)
            continue
        nat_of[t.country_name] = r[1]
        nations.append([r[1], r[2], r[0], t.confederation, int(t.fifa_ranking) if pd.notna(t.fifa_ranking) else 200, t.country_name])

    act = players[(players.last_season >= 2025) | ((players.last_season == 2024) & players.market_value_in_eur.notna())].copy()
    act["score"] = act.market_value_in_eur.fillna(0) + act.international_caps.fillna(0) * 20000
    rows, kept_nations, leagues_used = [], [], set()
    for code, name_es, iso, conf, rank, tm_name in sorted(nations, key=lambda n: n[4]):
        pool = act[act.country_of_citizenship == tm_name].sort_values("score", ascending=False)
        if len(pool) < 26:
            continue
        size, gks = (110, 9) if conf == "CONMEBOL" else (46, 5)
        gk = pool[pool.position == "Goalkeeper"].head(gks)
        field = pool[pool.position != "Goalkeeper"].head(size - len(gk))
        kept_nations.append([code, name_es, iso, conf, rank])
        for _, p in pd.concat([gk, field]).iterrows():
            born = pd.to_datetime(p.date_of_birth, errors="coerce")
            if pd.isna(born):
                continue
            pos = POS.get(p.sub_position) or POS_BROAD.get(p.position, "MC")
            n2 = nat_of.get(p.country_of_birth, "")
            s = stats.loc[p.player_id] if p.player_id in stats.index else None
            league = p.current_club_domestic_competition_id if isinstance(p.current_club_domestic_competition_id, str) else ""
            club = club_name.get(p.current_club_id) or (p.current_club_name if isinstance(p.current_club_name, str) else "")
            club = short(club)
            leagues_used.add(league)
            rows.append([
                int(p.player_id), p["name"], code, n2 if n2 != code else "", int(born.year), int(born.month), pos,
                {"left": "I", "right": "D", "both": "A"}.get(p.foot, "D"),
                0 if pd.isna(p.height_in_cm) else int(p.height_in_cm),
                k(p.market_value_in_eur), k(p.highest_market_value_in_eur), k(old.get(p.player_id)),
                club, league,
                int(s.m) if s is not None else 0, int(s.n) if s is not None else 0,
                int(s.g) if s is not None else 0, int(s.a) if s is not None else 0,
                0 if pd.isna(p.international_caps) else int(p.international_caps),
                0 if pd.isna(p.international_goals) else int(p.international_goals),
            ])

    leagues = {}
    for _, c in comps.iterrows():
        if c.competition_id in leagues_used:
            r = resolve(c.country_name) if isinstance(c.country_name, str) else None
            leagues[c.competition_id] = [str(c["name"]).replace("-", " ").title(), r[0] if r else ""]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"asof": "2026-07-06", "nations": kept_nations, "leagues": leagues, "players": rows},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"naciones {len(kept_nations)} · jugadores {len(rows)} · ligas {len(leagues)} · {OUT.stat().st_size/1e6:.2f} MB")
    if unresolved:
        print("sin resolver:", sorted(unresolved))


if __name__ == "__main__":
    main()
