#!/usr/bin/env python3
"""Calcul de rentabilité d'un SaaS : marge par offre, cas du client qui consomme tout, point mort, prix minimum.

Usage : python3 calcul_rentabilite.py chiffres.json [--sortie rentabilite.md]
        python3 calcul_rentabilite.py --modele          (affiche un fichier chiffres.json à remplir)

Tous les montants sont dans la même devise, par mois (sauf « prix » d'une offre à paiement unique).
Les coûts viennent du propriétaire (factures) ou des pages de prix des fournisseurs, jamais de mémoire :
les prix de l'IA, des SMS et des passerelles changent souvent.
"""
import json
import math
import sys
from pathlib import Path

MODELE = {
    "devise": "FCFA",
    "marge_visee_pct": 70,
    "couts_fixes_mensuels": {"serveur (VPS)": 15000, "nom de domaine": 1000, "e-mails (Brevo)": 0, "outils": 5000},
    "frais_paiement": {"pourcentage": 3.5, "fixe_par_paiement": 0},
    "offres": [
        {"nom": "Pro", "prix": 5000, "periode": "mois", "unites": 50000,
         "usage_moyen_pct": 40, "cout_par_unite": 0.03, "cout_fixe_par_client": 100},
        {"nom": "Business", "prix": 20000, "periode": "mois", "unites": 250000,
         "usage_moyen_pct": 30, "cout_par_unite": 0.03, "cout_fixe_par_client": 300},
    ],
    "gratuit": {"clients": 300, "unites": 1000, "usage_moyen_pct": 50, "cout_par_unite": 0.03, "cout_fixe_par_client": 20},
    "clients_payants_actuels": {"Pro": 12, "Business": 2},
    "_aide": {
        "unites": "ce que l'offre donne : crédits, messages, minutes… (0 si illimité : mettre alors une estimation du maximum raisonnable)",
        "usage_moyen_pct": "part des unités réellement consommée par un client moyen (regarder la base si le SaaS tourne déjà)",
        "cout_par_unite": "ce que coûte UNE unité au propriétaire (IA : jetons par action × prix du fournisseur ; SMS ; stockage…)",
        "cout_fixe_par_client": "coût mensuel d'un client même s'il n'utilise rien (stockage, e-mails, support)",
        "periode": "mois, an ou unique (paiement unique : le calcul ramène au mois avec duree_mois, 1 par défaut)",
    },
}


def fmt(x, devise):
    return f"{x:,.0f} {devise}".replace(",", " ")


def per_month(offre):
    p = offre["prix"]
    periode = offre.get("periode", "mois")
    if periode == "an":
        return p / 12
    if periode == "unique":
        return p / max(1, offre.get("duree_mois", 1))
    return p


def analyse(d):
    devise = d.get("devise", "")
    fee_pct = d.get("frais_paiement", {}).get("pourcentage", 0) / 100
    fee_fix = d.get("frais_paiement", {}).get("fixe_par_paiement", 0)
    target = d.get("marge_visee_pct", 70) / 100
    fixed = sum(d.get("couts_fixes_mensuels", {}).values())
    lines, alerts, rows = [], [], []

    for o in d.get("offres", []):
        revenue = per_month(o)
        payments_per_month = 1 / 12 if o.get("periode") == "an" else (1 / max(1, o.get("duree_mois", 1)) if o.get("periode") == "unique" else 1)
        fees = o["prix"] * fee_pct * payments_per_month + fee_fix * payments_per_month
        unit_cost = o.get("cout_par_unite", 0)
        base_cost = o.get("cout_fixe_par_client", 0)
        avg_cost = o.get("unites", 0) * o.get("usage_moyen_pct", 100) / 100 * unit_cost + base_cost
        max_cost = o.get("unites", 0) * unit_cost + base_cost
        margin = revenue - fees - avg_cost
        margin_max = revenue - fees - max_cost
        pct = margin / revenue * 100 if revenue else 0
        # Prix qui laisse la marge visée même si le client consomme TOUT ce que l'offre donne.
        min_price = (max_cost + fee_fix * payments_per_month) / (1 - fee_pct - target) if (1 - fee_pct - target) > 0 else float("inf")
        rows.append((o, revenue, fees, avg_cost, margin, pct, margin_max, min_price))
        if margin_max < 0:
            alerts.append(("CRITIQUE", f"« {o['nom']} » perd {fmt(-margin_max, devise)} par mois sur un client qui consomme tout ce que l'offre donne. "
                                        f"Prix minimum pour {target * 100:.0f} % de marge : {fmt(min_price, devise)} (ou moins d'unités, ou un coût par unité plus bas)."))
        elif pct < target * 100:
            alerts.append(("HAUTE" if pct < 40 else "MOYENNE", f"« {o['nom']} » : marge de {pct:.0f} % pour un client moyen, sous l'objectif de {target * 100:.0f} %. "
                                                              f"Prix qui tient l'objectif même au maximum : {fmt(min_price, devise)}."))

    free = d.get("gratuit") or {}
    free_cost = 0
    if free:
        per_free = free.get("unites", 0) * free.get("usage_moyen_pct", 100) / 100 * free.get("cout_par_unite", 0) + free.get("cout_fixe_par_client", 0)
        free_cost = per_free * free.get("clients", 0)

    lines += [f"# Rentabilité : calcul", "", f"Devise : {devise}. Montants ramenés au mois.", "",
              "## Par offre", "",
              "| Offre | Encaissé / mois | Frais de paiement | Coût d'un client moyen | Marge | Marge % | Marge si tout est consommé | Prix minimum (marge visée, consommation maximale) |",
              "|---|---|---|---|---|---|---|---|"]
    for o, revenue, fees, avg_cost, margin, pct, margin_max, min_price in rows:
        lines.append(f"| {o['nom']} | {fmt(revenue, devise)} | {fmt(fees, devise)} | {fmt(avg_cost, devise)} | {fmt(margin, devise)} | {pct:.0f} % | {fmt(margin_max, devise)} | {fmt(min_price, devise)} |")

    lines += ["", "## Coûts du mois sans aucune vente", "",
              f"- Coûts fixes : {fmt(fixed, devise)} ({', '.join(f'{k} {fmt(v, devise)}' for k, v in d.get('couts_fixes_mensuels', {}).items())})",
              f"- Clients gratuits : {fmt(free_cost, devise)} ({free.get('clients', 0)} comptes)" if free else "- Pas d'offre gratuite déclarée",
              f"- **Total à couvrir : {fmt(fixed + free_cost, devise)} par mois**", ""]

    current = d.get("clients_payants_actuels") or {}
    if rows:
        to_cover = fixed + free_cost
        weights = {o["nom"]: current.get(o["nom"], 0) for o, *_ in rows}
        total_w = sum(weights.values())
        if total_w:
            avg_margin = sum(r[4] * weights[r[0]["nom"]] for r in rows) / total_w
            mix = "répartition actuelle des clients"
        else:
            avg_margin = rows[0][4]
            mix = f"tous sur « {rows[0][0]['nom']} »"
        lines += ["## Point mort", ""]
        if avg_margin > 0:
            need = to_cover / avg_margin
            lines.append(f"Il faut **{math.ceil(need)} clients payants** ({mix}) pour couvrir les coûts du mois.")
        else:
            lines.append("Aucun nombre de clients ne couvre les coûts : chaque vente fait perdre de l'argent.")
            alerts.append(("CRITIQUE", "La marge moyenne par client payant est négative : plus il y a de clients, plus la perte grandit."))
        if total_w:
            result = sum(r[4] * weights[r[0]["nom"]] for r in rows) - to_cover
            lines.append(f"Aujourd'hui ({total_w} clients payants) : **{'bénéfice' if result >= 0 else 'perte'} de {fmt(abs(result), devise)} par mois**.")
        if free and free_cost > 0 and avg_margin > 0:
            lines.append(f"Les {free.get('clients', 0)} comptes gratuits coûtent l'équivalent de {free_cost / avg_margin:.1f} clients payants.")
            if free_cost > fixed:
                alerts.append(("HAUTE", "Les comptes gratuits coûtent plus que tout le reste des coûts fixes : réduire ce que le gratuit donne, ou exiger une confirmation d'e-mail."))
        lines.append("")

    lines += ["## Alertes", ""] + ([f"- **{lvl}** : {txt}" for lvl, txt in alerts] or ["- Aucune : chaque offre tient la marge visée."]) + [""]
    lines += ["## Hypothèses (à vérifier avec le propriétaire)", "", "```json", json.dumps({k: v for k, v in d.items() if not k.startswith("_")}, ensure_ascii=False, indent=2), "```", ""]
    return "\n".join(lines), alerts


def main():
    if "--modele" in sys.argv:
        print(json.dumps(MODELE, ensure_ascii=False, indent=2))
        return
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    text, alerts = analyse(data)
    if "--sortie" in sys.argv:
        dest = Path(sys.argv[sys.argv.index("--sortie") + 1])
        dest.write_text(text, encoding="utf-8")
        print(f"Calcul écrit : {dest}")
    else:
        print(text)
    print(f"Alertes : {len(alerts)}", file=sys.stderr)


if __name__ == "__main__":
    main()
