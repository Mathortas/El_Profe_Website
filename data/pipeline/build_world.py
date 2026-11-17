"""Arma app/src/data/world.json a partir de transfermarkt-datasets.zip.

Uso:  python data/pipeline/build_world.py [ruta_al_zip]
Requiere: pandas, pycountry, numpy.

Fuentes opcionales en data/raw (si no están, se omiten):
  elprofe_fbref_2026.csv            club, partidos y minutos de las ligas sudamericanas (FBref, temporada 2026)
  elprofe_wikidata_ciudadanias.csv  ciudadanías por ID de Transfermarkt (Wikidata)

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
import unicodedata
from difflib import SequenceMatcher
import zipfile
import zlib
from pathlib import Path

import numpy as np
import pandas as pd
import pycountry

ROOT = Path(__file__).resolve().parents[2]
ZIP = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/raw/transfermarkt-datasets.zip"
OUT = ROOT / "app/src/data/world.json"
SEASON_START = "2025-07-01"
FBREF = ROOT / "data/raw/elprofe_fbref_2026.csv"
WIKIDATA = ROOT / "data/raw/elprofe_wikidata_ciudadanias.csv"
FBREF_ASOF = pd.Timestamp("2026-11-16")        # día en que se leyeron las tablas; la edad viene en años-días
CONMEBOL = ["ARG", "BRA", "URU", "COL", "CHI", "PER", "ECU", "PAR", "BOL", "VEN"]
# Competición de FBref -> (código de liga, nombre, bandera, nivel de referencia para estimar valor)
FB_LEAGUE = {
    44: ("PER1", "Liga 1", "pe", 0.55), 41: ("COL1", "Primera A", "co", 0.62), 35: ("CHI1", "Liga de Primera", "cl", 0.58),
    58: ("ECU1", "LigaPro Serie A", "ec", 0.6), 45: ("URU1", "Liga AUF Uruguaya", "uy", 0.6),
    61: ("PAR1", "Copa de Primera", "py", 0.58), 74: ("BOL1", "División Profesional", "bo", 0.5),
    105: ("VEN1", "Liga FUTVE", "ve", 0.5), 21: ("ARG1", "Torneo Apertura", "ar", 0.74),
    24: ("BRA1", "Campeonato Brasileiro Serie A", "br", 0.8), 38: ("BRA2", "Série B", "br", 0.62),
}
# Código de país de FBref -> código del juego, cuando difieren
FB_NAT = {"KVX": "KVX", "SUI": "SUI"}

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


def norm(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode().lower()
    return " ".join("".join(ch if ch.isalnum() else " " for ch in text).split())


def stable(key, n):
    """Entero estable entre 0 y n-1 a partir de un texto."""
    return zlib.crc32(str(key).encode()) % n


def load_fbref():
    """Una fila por jugador: club y liga donde más jugó, y totales de la temporada."""
    if not FBREF.exists():
        return None
    fb = pd.read_csv(FBREF, dtype={"edad": str, "fbref_id": str, "nacion": str}).fillna({"edad": "", "nacion": "", "fbref_id": ""})
    fb = fb[fb.liga.isin(FB_LEAGUE)].copy()
    fb["key"] = np.where(fb.fbref_id != "", fb.fbref_id, fb.jugador + fb.anio.astype(str))
    out = []
    for key, g in fb.groupby("key"):
        top = g.sort_values("minutos", ascending=False).iloc[0]
        years, _, days = top.edad.partition("-")
        dob = FBREF_ASOF - pd.Timedelta(days=int(days)) - pd.DateOffset(years=int(years)) if years.isdigit() and days.isdigit() else pd.NaT
        out.append(dict(fid=key, name=top.jugador, nat=FB_NAT.get(top.nacion, top.nacion), pos=top.puesto if isinstance(top.puesto, str) else "",
                        club=top.club, liga=int(top.liga), dob=dob, year=int(top.anio) if pd.notna(top.anio) else 0,
                        games=int(g.partidos.sum()), mins=int(g.minutos.sum()), goals=int(g.goles.sum()), ast=int(g.asistencias.sum())))
    return pd.DataFrame(out)


GENERIC = {"club", "atletico", "deportivo", "deportes", "sport", "sporting", "esporte", "clube", "futebol", "football", "futbol",
           "real", "union", "nacional", "universidad", "univ", "independiente", "social", "cultural", "associacao", "sociedade"}


def club_words(name):
    return {w for w in norm(name).split() if len(w) >= 4 and w not in GENERIC}


def match_fbref(fb, players, club_name, nat_of):
    """Empareja jugadores de FBref con los de Transfermarkt por fecha de nacimiento y nombre. Devuelve {fid: player_id}."""
    by_day, by_name = {}, {}
    dobs = pd.to_datetime(players.date_of_birth, errors="coerce")
    for pid, name, dob in zip(players.player_id, players["name"], dobs):
        words = norm(name).split()
        toks = set(words)
        if pd.notna(dob) and words:
            by_day.setdefault(dob.toordinal(), []).append((pid, toks, words[-1]))
            by_name.setdefault((norm(name), dob.year), []).append(pid)
    found = {}
    for r in fb.itertuples():
        words = norm(r.name).split()
        toks, cands = set(words), []
        if pd.notna(r.dob) and words:
            day = r.dob.toordinal()
            for d in range(day - 1, day + 2):
                for pid, t, last in by_day.get(d, []):
                    common = [x for x in toks & t if len(x) >= 3]
                    # Misma fecha y mismo nombre de pila no alcanza: tiene que coincidir un apellido o dos palabras.
                    if common and (words[-1] in t or last in toks or len(common) >= 2):
                        cands.append((-abs(d - day), len(common) / max(len(toks), 1), pid))
        if cands:
            found[r.fid] = max(cands)[2]
        elif len(by_name.get((norm(r.name), r.year), [])) == 1:
            found[r.fid] = by_name[(norm(r.name), r.year)][0]
    # Segunda pasada, para apodos y nombres escritos distinto: misma fecha exacta y misma nacionalidad,
    # y además el mismo club o un nombre muy parecido.
    taken, loose = set(found.values()), {}
    for pid, name, dob, country, cid, lg in zip(players.player_id, players["name"], dobs, players.country_of_citizenship,
                                                players.current_club_id, players.current_club_domestic_competition_id):
        if pd.notna(dob) and pid not in taken and nat_of.get(country):
            loose.setdefault((dob.toordinal(), nat_of[country]), []).append((pid, norm(name).split(), club_words(club_name.get(cid, "")), lg))
    for r in fb.itertuples():
        if r.fid in found or pd.isna(r.dob):
            continue
        words, club, best = norm(r.name).split(), club_words(r.club), None
        for pid, tw, tc, lg in loose.get((r.dob.toordinal(), r.nat), []):
            same_club = lg == FB_LEAGUE[r.liga][0] and bool(club & tc)
            a, c = (words[1:] or words), (tw[1:] or tw)
            if len(words) == 1 or len(tw) == 1:
                a, c = words, tw
            like = max((SequenceMatcher(None, x, y).ratio() for x in a for y in c), default=0)
            if same_club or like >= (0.66 if len(words) == 1 or len(tw) == 1 else 0.8):
                best = (same_club, like, pid) if best is None or (same_club, like) > best[:2] else best
        if best:
            found[r.fid] = best[2]
    # Un jugador de Transfermarkt no puede quedar asignado a dos de FBref: se queda el que más jugó.
    mins, owner = dict(zip(fb.fid, fb.mins)), {}
    for fid, pid in found.items():
        if pid not in owner or mins[fid] > mins[owner[pid]]:
            owner[pid] = fid
    return {fid: pid for pid, fid in owner.items()}


def fit_value(fb, tm_of, players):
    """Ajusta log10(valor) con nivel de liga, minutos, edad y producción, usando a los jugadores que sí tienen valor."""
    val = dict(zip(players.player_id, players.market_value_in_eur))

    def feats(r):
        age = (FBREF_ASOF - r.dob).days / 365.25 if pd.notna(r.dob) else 2026 - r.year
        share = min(1.0, r.mins / 2700)
        return [1.0, FB_LEAGUE[r.liga][3], share, age - 26, (age - 26) ** 2, min(1.0, (r.goals + r.ast) / max(r.mins / 90, 6))]

    X, y = [], []
    for r in fb.itertuples():
        v = val.get(tm_of.get(r.fid))
        if v and v > 0:
            X.append(feats(r)); y.append(np.log10(v / 1000))
    # Con pocos casos el ajuste no es confiable: se usa una fórmula fija.
    coef = np.linalg.lstsq(np.array(X), np.array(y), rcond=None)[0] if len(y) >= 60 else np.array([1.2, 2.0, 0.55, -0.03, -0.004, 0.3])
    # Quien nunca pasó por una liga con valores publicados suele valer menos que quien sí: se descuenta.
    return lambda r: float(np.clip(10 ** (np.dot(coef, feats(r)) - 0.3), 25, 3000)) * 1000, len(y)


SUB = {  # puesto general de FBref -> puestos posibles con su peso
    "GK": [("Goalkeeper", 1)], "DF": [("Centre-Back", 5), ("Left-Back", 2), ("Right-Back", 3)],
    "MF": [("Central Midfield", 4), ("Defensive Midfield", 3), ("Attacking Midfield", 2), ("Left Midfield", 1), ("Right Midfield", 1)],
    "FW": [("Centre-Forward", 5), ("Left Winger", 2), ("Right Winger", 3)],
    "DF,MF": [("Defensive Midfield", 3), ("Left-Back", 2), ("Right-Back", 3), ("Centre-Back", 2)],
    "MF,DF": [("Defensive Midfield", 5), ("Right-Back", 2), ("Left-Back", 1), ("Central Midfield", 2)],
    "MF,FW": [("Attacking Midfield", 4), ("Left Winger", 2), ("Right Winger", 3), ("Central Midfield", 1)],
    "FW,MF": [("Right Winger", 3), ("Left Winger", 3), ("Attacking Midfield", 2), ("Centre-Forward", 2)],
    "DF,FW": [("Right-Back", 1), ("Left-Back", 1)], "FW,DF": [("Right Winger", 1), ("Left Winger", 1)],
}
BROAD = {"Goalkeeper": "Goalkeeper", "Centre-Back": "Defender", "Left-Back": "Defender", "Right-Back": "Defender",
         "Centre-Forward": "Attack", "Left Winger": "Attack", "Right Winger": "Attack"}


def guess_sub(fid, pos, goals90=0.0):
    """FBref solo da arquero, defensa, medio o delantero: el puesto fino se reparte de forma estable."""
    if pos.startswith("FW") and goals90 >= 0.35:                                  # el que hace goles seguido es centrodelantero
        return "Centre-Forward"
    opts = SUB.get(pos) or SUB.get(pos.split(",")[0]) or SUB["MF"]
    n = stable(fid + "pos", sum(w for _, w in opts))
    for name, w in opts:
        if n < w:
            return name
        n -= w
    return opts[0][0]


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
    tm_name_of = {n[0]: n[5] for n in nations}
    rank_of = {n[0]: n[4] for n in nations}

    # --- Ligas sudamericanas (FBref): club y minutos de quienes ya están, y jugadores nuevos ---
    fb, fb_of, added = load_fbref(), {}, 0
    if fb is not None:
        tm_of = match_fbref(fb, players, club_name, nat_of)
        estimate, sample = fit_value(fb, tm_of, players)
        # Nombre de club de Transfermarkt para cada equipo de FBref, por mayoría entre los emparejados de la misma liga
        tm_club = {pid: short(club_name.get(cid) or "") for pid, cid in zip(players.player_id, players.current_club_id)}
        tm_lg = dict(zip(players.player_id, players.current_club_domestic_competition_id))
        votes = {}
        for r in fb.itertuples():
            pid = tm_of.get(r.fid)
            if pid and tm_lg.get(pid) == FB_LEAGUE[r.liga][0] and tm_club.get(pid):
                votes.setdefault((r.liga, r.club), {}).setdefault(tm_club[pid], 0)
                votes[(r.liga, r.club)][tm_club[pid]] += 1
        club_fix = {key: max(v, key=v.get) for key, v in votes.items() if max(v.values()) >= 3}
        new = []
        for r in fb.itertuples():
            club = club_fix.get((r.liga, r.club), r.club)
            rec = dict(club=club, league=FB_LEAGUE[r.liga][0], m=r.mins, n=r.games, g=r.goals, a=r.ast)
            pid = tm_of.get(r.fid)
            if pid:
                fb_of[pid] = rec
                continue
            if r.nat not in tm_name_of or pd.isna(r.dob) or r.mins < 180:               # con menos de dos partidos no hay de dónde estimar
                continue
            pid = 2_000_000_000 + int(r.fid, 16) % 2_000_000_000 if all(c in "0123456789abcdef" for c in r.fid) else 2_000_000_000 + stable(r.fid, 2_000_000_000)
            sub = guess_sub(r.fid, r.pos, r.goals / max(r.mins / 90, 6))
            left = sub.startswith("Left")
            foot = "left" if stable(r.fid + "pie", 100) < (80 if sub == "Left-Back" else 55 if left else 18) else "right"
            v = estimate(r)
            fb_of[pid] = rec
            new.append(dict(player_id=pid, name=r.name, last_season=2026, country_of_citizenship=tm_name_of[r.nat], date_of_birth=r.dob,
                            sub_position=sub, position=BROAD.get(sub, "Midfield"), foot=foot, market_value_in_eur=v, highest_market_value_in_eur=v))
        added = len(new)
        players = pd.concat([players, pd.DataFrame(new)], ignore_index=True)
        print(f"fbref: {len(fb)} jugadores · emparejados {len(tm_of)} · nuevos {added} · muestra para el valor {sample}")

    # --- Ciudadanías (Wikidata) ---
    citizen = {}
    if WIKIDATA.exists():
        iso3 = {}
        for code, _, iso, *_ in nations:
            c = pycountry.countries.get(alpha_2=iso.upper()) if len(iso) == 2 else None
            if c:
                iso3[c.alpha_3] = code
        iso3["XKS"] = "KVX"
        wd = pd.read_csv(WIKIDATA, dtype=str)
        for tm, isos in zip(wd.tm_id, wd.ciudadanias):
            if str(tm).isdigit():
                codes = {iso3[i] for i in str(isos).split("|") if i in iso3}
                if codes:
                    citizen[int(tm)] = codes

    def second(pid, code, birth):
        """Segunda selección posible: primero las de Conmebol, después la mejor ubicada en el ranking."""
        opts = sorted(citizen.get(pid, set()) - {code}, key=lambda c: (c not in CONMEBOL, rank_of.get(c, 999)))
        if opts:
            return opts[0]
        born = nat_of.get(birth, "") if isinstance(birth, str) else ""
        return born if born != code else ""

    active = (players.last_season >= 2025) | ((players.last_season == 2024) & players.market_value_in_eur.notna()) | players.player_id.isin(fb_of)
    act = players[active].copy()
    act["score"] = act.market_value_in_eur.fillna(0) + act.international_caps.fillna(0) * 20000
    fb_codes = {v[0] for v in FB_LEAGUE.values()}
    rows, kept_nations, leagues_used, taken = [], [], set(), set()

    def add(p, code, n2):
        born = pd.to_datetime(p.date_of_birth, errors="coerce")
        if pd.isna(born):
            return
        pos = POS.get(p.sub_position) or POS_BROAD.get(p.position, "MC")
        s = stats.loc[p.player_id] if p.player_id in stats.index else None
        league = p.current_club_domestic_competition_id if isinstance(p.current_club_domestic_competition_id, str) else ""
        club = club_name.get(p.current_club_id) or (p.current_club_name if isinstance(p.current_club_name, str) else "")
        club = short(club)
        mins, games, goals, ast = (int(s.m), int(s.n), int(s.g), int(s.a)) if s is not None else (0, 0, 0, 0)
        f = fb_of.get(p.player_id)
        # FBref manda cuando la liga es una de las suyas, cuando no hay liga o cuando no hay minutos registrados.
        if f and (not league or league in fb_codes or mins == 0):
            if not (league == f["league"] and club):
                club = short(f["club"])
            league, mins, games, goals, ast = f["league"], f["m"], f["n"], f["g"], f["a"]
        leagues_used.add(league)
        taken.add(p.player_id)
        rows.append([
            int(p.player_id), p["name"], code, n2, int(born.year), int(born.month), pos,
            {"left": "I", "right": "D", "both": "A"}.get(p.foot, "D"),
            0 if pd.isna(p.height_in_cm) else int(p.height_in_cm),
            k(p.market_value_in_eur), k(p.highest_market_value_in_eur), k(old.get(p.player_id)),
            club, league, mins, games, goals, ast,
            0 if pd.isna(p.international_caps) else int(p.international_caps),
            0 if pd.isna(p.international_goals) else int(p.international_goals),
        ])

    for code, name_es, iso, conf, rank, tm_name in sorted(nations, key=lambda n: n[4]):
        pool = act[act.country_of_citizenship == tm_name].sort_values("score", ascending=False)
        if len(pool) < 26:
            continue
        size, gks = (140, 12) if conf == "CONMEBOL" else (46, 5)
        gk = pool[pool.position == "Goalkeeper"].head(gks)
        field = pool[pool.position != "Goalkeeper"].head(size - len(gk))
        kept_nations.append([code, name_es, iso, conf, rank])
        for _, p in pd.concat([gk, field]).iterrows():
            add(p, code, second(p.player_id, code, p.country_of_birth))

    # Jugadores de otras selecciones con ciudadanía de un país de Conmebol que quedaron fuera de su grupo
    kept = {n[0] for n in kept_nations}
    extra = 0
    for target in CONMEBOL:
        cands = act[act.player_id.map(lambda i: target in citizen.get(i, ())) & ~act.player_id.isin(taken) & (act.market_value_in_eur >= 300_000)]
        for _, p in cands.sort_values("score", ascending=False).head(15).iterrows():
            code = nat_of.get(p.country_of_citizenship)
            if code in kept and code != target:
                add(p, code, target)
                extra += 1

    leagues = {}
    for _, c in comps.iterrows():
        if c.competition_id in leagues_used:
            r = resolve(c.country_name) if isinstance(c.country_name, str) else None
            leagues[c.competition_id] = [str(c["name"]).replace("-", " ").title(), r[0] if r else ""]
    for code, name, iso, _ in FB_LEAGUE.values():
        if code in leagues_used and code not in leagues:
            leagues[code] = [name, iso]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"asof": "2026-07-06", "nations": kept_nations, "leagues": leagues, "players": rows},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"naciones {len(kept_nations)} · jugadores {len(rows)} · ligas {len(leagues)} · {OUT.stat().st_size/1e6:.2f} MB")
    print(f"con segunda selección {sum(1 for r in rows if r[3])} · elegibles agregados {extra}")
    if unresolved:
        print("sin resolver:", sorted(unresolved))


if __name__ == "__main__":
    main()
