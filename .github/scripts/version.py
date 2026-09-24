"""Version a publier, et les deux conditions sans lesquelles on ne publie pas.

Lu par .github/workflows/release.yml. Ecrit sur la sortie standard la version
de build.gradle, ou s'arrete avec une annotation d'erreur GitHub si :
  - frontend/package.json porte un autre numero (build.gradle exige qu'ils
    concordent : deux numeros dans un seul livrable, c'est deux versions) ;
  - CHANGELOG.md n'a pas de section "## vX.Y.Z", qui sert de notes de release.

Separe du workflow pour pouvoir etre lance a l'identique sur un poste :
    python .github/scripts/version.py
"""
import json
import re
import sys


def erreur(message):
    print(f"::error::{message}", file=sys.stderr)
    sys.exit(1)


gradle = open("build.gradle", encoding="utf-8").read()
m = re.search(r"^version = '([^']+)'", gradle, re.M)
if not m:
    erreur("Version introuvable dans build.gradle")
version = m.group(1)

front = json.load(open("frontend/package.json", encoding="utf-8"))["version"]
if front != version:
    erreur(f"build.gradle dit {version}, frontend/package.json dit {front}")

changelog = open("CHANGELOG.md", encoding="utf-8").read()
if not re.search(rf"^## v{re.escape(version)}(\s|$)", changelog, re.M):
    erreur(f'Aucune section "## v{version}" dans CHANGELOG.md')

print(version)
