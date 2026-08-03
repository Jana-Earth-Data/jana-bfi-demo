#!/usr/bin/env bash
#
# download.sh — regulatory source pack fetcher for the Jana BFI demo.
#
# Run this on your Mac (not inside a VM) to populate every subfolder under
# docs/regulatory-sources/ with the source PDFs cited by the demo. Only
# missing files are re-fetched; existing files are skipped.
#
# Usage:
#   ./download.sh                # fetch everything
#   ./download.sh --dry-run      # print the plan, don't download
#   ./download.sh --force        # re-fetch even if the local file exists
#
# See README.md in this folder for what each source is and how the demo
# uses it. See HOW_THE_DEMO_USES_THESE.md for the source-to-code mapping.
#
# Constraint reminder: some URLs are behind login walls, have moved, or
# were never published as a stable direct download. Anything the script
# can't fetch is listed at the end under NEEDS MANUAL RETRIEVAL. Do not
# panic — the manifest tells you where to look for each one by hand.

set -euo pipefail

# ---------------------------------------------------------------------------
# argv
# ---------------------------------------------------------------------------

DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# state
# ---------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

OK_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
MANUAL_COUNT=0
FAILED_LIST=()
MANUAL_LIST=()

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

# fetch <url> <local_path> [<one-line-description>]
#
# Downloads url into local_path. Prints a status line either way. Uses curl
# -L to follow redirects; --fail causes a non-zero exit on HTTP >= 400 so
# the script can distinguish "server returned 404" from "network worked".
fetch() {
  local url="$1"
  local dest="$2"
  local desc="${3:-}"

  local rel="${dest#./}"
  local label="${desc:-$rel}"

  if [ "$FORCE" -eq 0 ] && [ -s "$dest" ]; then
    printf "  [skip]  %s (already present)\n" "$rel"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    printf "  [plan]  %s\n           %s\n" "$rel" "$url"
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  printf "  [get ]  %s ... " "$rel"
  if curl -sSL --fail --max-time 60 -A "jana-bfi-demo/download.sh" -o "$dest" "$url"; then
    local size
    size=$(wc -c < "$dest" | tr -d ' ')
    printf "ok (%s bytes)\n" "$size"
    OK_COUNT=$((OK_COUNT + 1))
  else
    printf "FAILED\n"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_LIST+=("$rel  ($url)")
    rm -f "$dest"
  fi
}

# manual <local_path> <reason>
#
# Records that a source can't be fetched automatically. Doesn't touch the
# filesystem. Reason is printed in the summary so the analyst knows what
# to do next.
manual() {
  local rel="$1"
  local reason="$2"
  MANUAL_COUNT=$((MANUAL_COUNT + 1))
  MANUAL_LIST+=("$rel  --  $reason")
  printf "  [manual] %s  (%s)\n" "$rel" "$reason"
}

section() {
  printf "\n== %s ==\n" "$1"
}

# ---------------------------------------------------------------------------
# 01 — NRB ESRM
# ---------------------------------------------------------------------------

section "01 — NRB ESRM (Environmental & Social Risk Management)"

# The operative 2022 edition of the NRB ESRM Guideline. Foundational document
# — the ESDD wizard, PF screening, CAP panel, monitoring, and annual NRB
# report all trace back to this PDF.
fetch \
  "https://www.nrb.org.np/contents/uploads/2022/02/Final-ESRM-with-cover.pdf" \
  "01-nrb-esrm/nrb-esrm-guideline-2022.pdf" \
  "NRB ESRM Guideline (Feb 2022)"

# The 2018 predecessor. Superseded but kept for the 2018-vs-2022 diff.
fetch \
  "https://www.nrb.org.np/contents/uploads/2018/05/Environment-Social-Risk-Management-Guidelines-2018.pdf" \
  "01-nrb-esrm/nrb-esrm-guideline-2018.pdf" \
  "NRB ESRM Guideline (May 2018)"

# The NRB circular pages that bind the guideline on all A/B/C BFIs.
fetch \
  "https://www.nrb.org.np/bfr/circular_22-attachment_to_guideline_on_environmental__social_risk_management_for_banks_and_financial_institutions_related/" \
  "01-nrb-esrm/circular-22-attachment-page.html" \
  "NRB Circular 22 attachment page"

fetch \
  "https://www.nrb.org.np/bfr/circular-22-checklist-to-guideline-on-environmental-social-risk-management-for-banks-and-financial-institutions-related/" \
  "01-nrb-esrm/circular-22-checklist-page.html" \
  "NRB Circular 22 checklist page"

# ---------------------------------------------------------------------------
# 02 — NRB Green Finance Taxonomy
# ---------------------------------------------------------------------------

section "02 — NRB Green Finance Taxonomy (2024)"

# The 2024 taxonomy — the classification wedge that runs after ESRM steps
# 1 and 2. Drives the Taxonomy wizard, activities catalogue, DNSH cards.
fetch \
  "https://www.nrb.org.np/contents/uploads/2024/10/Nepal-Green-Finance-Taxonomy-2024-V1.pdf" \
  "02-nrb-taxonomy/nepal-green-finance-taxonomy-2024-v1.pdf" \
  "Nepal Green Finance Taxonomy 2024 V1"

# Same content, alternative NRB CDN path — kept as backup.
fetch \
  "https://www.nrb.org.np/contents/uploads/2024/10/Nepal-Green-Finance-Taxonomy-2024.pdf" \
  "02-nrb-taxonomy/nepal-green-finance-taxonomy-2024-alt.pdf" \
  "Nepal Green Finance Taxonomy 2024 (alt URL)"

# ---------------------------------------------------------------------------
# 03 — NFRS S1 & S2 (ASB Nepal / ICAN)
# ---------------------------------------------------------------------------

section "03 — NFRS S1 & S2 (ASB Nepal exposure drafts, April 2026)"

# The exposure drafts drive the NFRS tab and PCAF wedge framing. Research
# transcribed them verbatim but did not capture stable ASB Nepal PDF URLs.
# Start at asbnepal.gov.np and look under Notices / Exposure Drafts.
manual \
  "03-nfrs-icann/nfrs-s1-exposure-draft-2026.pdf" \
  "no stable ASB Nepal URL — start at https://asbnepal.gov.np/ notices page or email secretariat@asbnepal.gov.np"

manual \
  "03-nfrs-icann/nfrs-s2-exposure-draft-2026.pdf" \
  "no stable ASB Nepal URL — start at https://asbnepal.gov.np/ notices page or email secretariat@asbnepal.gov.np"

# ---------------------------------------------------------------------------
# 04 — PCAF
# ---------------------------------------------------------------------------

section "04 — PCAF Global GHG Accounting for Financial Industry"

# Part A — the load-bearing standard for financed emissions. 3rd edition
# (Dec 2025) is currently authoritative.
fetch \
  "https://carbonaccountingfinancials.com/files/standard-launch-2025/PCAF-PartA-2025-V3-15012026.pdf" \
  "04-pcaf/pcaf-part-a-3rd-edition-2025.pdf" \
  "PCAF Part A — Financed Emissions 3rd Edition (Dec 2025)"

fetch \
  "https://carbonaccountingfinancials.com/files/standard-launch-2025/PCAF-PartA-2025-Executive-Summary-Clean.pdf" \
  "04-pcaf/pcaf-part-a-3rd-edition-executive-summary.pdf" \
  "PCAF Part A Executive Summary (3rd Edition)"

# 2nd edition — historical reference, still cited by many bank disclosures
# including NMB's 2022 report.
fetch \
  "https://carbonaccountingfinancials.com/files/downloads/PCAF-Global-GHG-Standard.pdf" \
  "04-pcaf/pcaf-part-a-2nd-edition-2022.pdf" \
  "PCAF Part A — Financed Emissions 2nd Edition (Dec 2022)"

# CDP × PCAF alignment paper — score mapping reference.
fetch \
  "https://carbonaccountingfinancials.com/files/Importance-of-data-quality-CDP-PCAF.pdf" \
  "04-pcaf/cdp-pcaf-data-quality-importance-2023.pdf" \
  "CDP x PCAF — Importance of Data Quality (June 2023)"

# CDFI process documentation — the cleanest verbatim reproduction of the
# 2nd-edition PCAF Annex score-option tables.
fetch \
  "https://www.self-help.org/docs/default-source/PDFs/pcaf-working-guide-for-cdfis_20220418.pdf" \
  "04-pcaf/pcaf-cdfi-process-documentation-2022.pdf" \
  "PCAF Working Guide for CDFIs (CEI / PCAP / Self-Help, April 2022)"

# PCAF disclosure checklist — column-set reference for what a compliant
# Part A disclosure must contain.
fetch \
  "https://carbonaccountingfinancials.com/files/disclosure_checklist/PCAF-Disclosure-Checklist-Part-A-Financed-Emissions-May-2025.pdf" \
  "04-pcaf/pcaf-disclosure-checklist-part-a-may-2025.pdf" \
  "PCAF Disclosure Checklist — Part A (May 2025)"

# NMB Bank Nepal — the only Nepali PCAF signatory disclosure to date.
# Reference implementation.
fetch \
  "https://carbonaccountingfinancials.com/files/institutions_downloads/nmb-carbon-disclosure-report-2022-akm.pdf" \
  "04-pcaf/nmb-bank-carbon-disclosure-2022.pdf" \
  "NMB Bank Carbon Footprint Accounting 2022 (Nepal signatory)"

# ---------------------------------------------------------------------------
# 05 — IFC Performance Standards
# ---------------------------------------------------------------------------

section "05 — IFC Performance Standards"

# The 2012 Performance Standards Handbook covers PS1-PS8. The Annex 5b PF
# screening wizard tags every question to a specific PS paragraph. The
# research pack references PS1-PS8 by paragraph but does not include a
# stable direct download URL — search www.ifc.org for "Performance
# Standards Handbook" if the below fails.
manual \
  "05-ifc-performance-standards/ifc-performance-standards-handbook-2012-en.pdf" \
  "IFC hosts on a rotating URL — search www.ifc.org for 'Performance Standards Handbook 2012 English' or start at https://www.ifc.org/en/insights-reports/sustainability-framework"

# ---------------------------------------------------------------------------
# 06 — IFC EHS Guidelines
# ---------------------------------------------------------------------------

section "06 — IFC EHS Guidelines"

# Hub pages. Grab as HTML because the sub-sector PDFs are linked from them.
fetch \
  "https://www.ifc.org/en/insights-reports/general-environmental-health-and-safety-guidelines" \
  "06-ifc-ehs-guidelines/00-general-ehs-guidelines-hub.html" \
  "IFC General EHS Guidelines (hub)"

fetch \
  "https://www.ifc.org/wps/wcm/connect/topics_ext_content/ifc_external_corporate_site/sustainability-at-ifc/policies-standards/ehs-guidelines" \
  "06-ifc-ehs-guidelines/00-ehs-guidelines-hub-alt.html" \
  "IFC EHS Guidelines hub (legacy permalink)"

# Hydropower — the flagship sector guideline for project finance.
fetch \
  "https://www.ifc.org/en/insights-reports/2018/publications-gpn-ehshydropwer" \
  "06-ifc-ehs-guidelines/hydropower-gpn-2018.pdf" \
  "IFC EHS Good Practice Note — Hydropower (March 2018)"

# Cement — anchors the cement supplement questions.
fetch \
  "https://www.ifc.org/content/dam/ifc/doc/2022/2022-cement-lime-manufacturing-ehs-guidelines-en.pdf" \
  "06-ifc-ehs-guidelines/cement-and-lime-manufacturing-2022.pdf" \
  "IFC EHS Guidelines — Cement and Lime Manufacturing (2022)"

# Textiles — the direct PDF isn't linked from a stable URL. Hub HTML instead;
# the analyst navigates from there.
fetch \
  "https://www.ifc.org/en/insights-reports/general-environmental-health-and-safety-guidelines/ehs-guidelines-general-manufacturing" \
  "06-ifc-ehs-guidelines/textile-manufacturing-hub.html" \
  "IFC EHS Guidelines — Textile Manufacturing (hub)"

# Steel — Integrated Steel Mills for large plants.
fetch \
  "https://www.ifc.org/content/dam/ifc/doc/2000/2007-integrated-steel-mills-ehs-guidelines-en.pdf" \
  "06-ifc-ehs-guidelines/integrated-steel-mills-2007.pdf" \
  "IFC EHS Guidelines — Integrated Steel Mills (2007)"

# Foundries — better fit for Nepal's small re-rolling mills.
fetch \
  "https://www.ifc.org/content/dam/ifc/doc/2000/2007-foundries-ehs-guidelines-en.pdf" \
  "06-ifc-ehs-guidelines/foundries-2007.pdf" \
  "IFC EHS Guidelines — Foundries (2007)"

# Chemicals — hub only; sub-sector PDFs (pesticides, bulk terminals, coal
# processing) are behind the hub.
fetch \
  "https://www.ifc.org/en/insights-reports/general-environmental-health-and-safety-guidelines/ehs-guidelines-chemicals" \
  "06-ifc-ehs-guidelines/chemicals-hub.html" \
  "IFC EHS Guidelines — Chemicals (hub)"

# Agriculture — annual and perennial crops both matter for Nepal.
fetch \
  "https://www.ifc.org/content/dam/ifc/doc/2010/2016-annual-crop-production-ehs-guidelines-en.pdf" \
  "06-ifc-ehs-guidelines/annual-crop-production-2016.pdf" \
  "IFC EHS Guidelines — Annual Crop Production (2016)"

fetch \
  "https://www.ifc.org/content/dam/ifc/doc/2010/2016-perennial-crop-production-ehs-guidelines-en.pdf" \
  "06-ifc-ehs-guidelines/perennial-crop-production-2016.pdf" \
  "IFC EHS Guidelines — Perennial Crop Production (2016)"

# Brick — GAP. No dedicated IFC guideline. See README for composite anchor.
manual \
  "06-ifc-ehs-guidelines/ceramic-tile-sanitary-ware-ehs.pdf" \
  "no stable URL captured — search www.ifc.org for 'Ceramic Tile Sanitary Ware EHS'"

manual \
  "06-ifc-ehs-guidelines/construction-materials-extraction-ehs.pdf" \
  "no stable URL captured — search www.ifc.org for 'Construction Materials Extraction EHS'"

# ---------------------------------------------------------------------------
# 07 — Nepal legislation
# ---------------------------------------------------------------------------

section "07 — Nepal legislation"

# MoFE Hydropower EIA Manual — cited by the NRB Annex 2 hydropower supplement.
fetch \
  "https://mofe.gov.np/downloadfile/Hydropower%20Environmental%20Impact%20Assessment%20Manual_1537854204.pdf" \
  "07-nepal-legislation/mofe-hydropower-eia-manual-2018.pdf" \
  "MoFE Hydropower EIA Manual (2018)"

# EPR 2020 — no direct government PDF URL captured in research. Fetch two
# widely-cited secondary explainers as HTML; ask the user to source the
# authoritative Gazette PDF manually from moljpa.gov.np.
fetch \
  "https://sadalaw.com.np/news-publication/nepal-environment-protection-act-2019-extended-rules-2020" \
  "07-nepal-legislation/sadalaw-epa-epr-overview.html" \
  "Sada Law — EPA 2019 + EPR 2020 overview"

fetch \
  "https://lawsagar.com/2025/10/01/environmental-clearance-for-industries-nepal-eia-iee/" \
  "07-nepal-legislation/lawsagar-environmental-clearance.html" \
  "Lawsagar — Environmental clearance for industries (Nepal EIA/IEE)"

manual \
  "07-nepal-legislation/nepal-epr-2020.pdf" \
  "authoritative Gazette PDF not captured — source manually from moljpa.gov.np or mofe.gov.np"

# ---------------------------------------------------------------------------
# 08 — Sector context
# ---------------------------------------------------------------------------

section "08 — Sector context"

# MinErgy / ICIMOD Brick Sector Policy Framework — Nepal-specific brick
# context. Composite anchor with IFC General EHS Guidelines because there
# is no dedicated IFC EHS Guideline for brick.
fetch \
  "https://www.ccacoalition.org/sites/default/files/resources/2017_bricks-sector-nepal_minergy-icimod.pdf" \
  "08-sector-context/nepal-brick-sector-policy-framework-2017.pdf" \
  "Nepal Brick Sector National Policy Framework (MinErgy/ICIMOD 2017)"

# ---------------------------------------------------------------------------
# 09 — NBA industry publications
# ---------------------------------------------------------------------------

section "09 — Nepal Bankers' Association"

# Press release for the Feb 2026 ESRM Implementation Handbook.
fetch \
  "https://nepalbankers.com.np/nba-released-esrm-implementation-handbook/" \
  "09-nba-industry/nba-esrm-handbook-press-release.html" \
  "NBA — ESRM Implementation Handbook press release (Feb 2026)"

# The handbook PDF itself has no direct URL.
manual \
  "09-nba-industry/nba-esrm-implementation-handbook-2026.pdf" \
  "no direct URL — ask Laxmi Sunrise ESRM team for a member-bank copy, or email nba@nepalbankers.com.np, or check https://nepalbankers.com.np/publications/"

fetch \
  "https://nepalbankers.com.np/publications/" \
  "09-nba-industry/nba-publications-index.html" \
  "NBA Publications index"

fetch \
  "https://nepalbankers.com.np/release-of-the-assessing-climate-transition-maturity-of-nepali-commercial-banks-2025-report/" \
  "09-nba-industry/nba-climate-transition-maturity-2025.html" \
  "NBA — Climate Transition Maturity of Nepali Commercial Banks 2025 release"

# ---------------------------------------------------------------------------
# 10 — Secondary references
# ---------------------------------------------------------------------------

section "10 — Secondary references"

fetch \
  "https://data.sbfnetwork.org/country/nepal" \
  "10-secondary-references/sbfn-nepal-country-page.html" \
  "SBFN Nepal country page"

fetch \
  "https://www.greenfinanceplatform.org/policies-and-regulations/guideline-environmental-social-risk-management-esrm-banks-and-financial" \
  "10-secondary-references/greenfinanceplatform-nepal-esrm.html" \
  "Green Finance Platform — Nepal ESRM entry"

fetch \
  "https://afi-global.org/news/nepal-rastra-bank-issues-a-comprehensive-green-finance-taxonomy/" \
  "10-secondary-references/afi-nrb-taxonomy-announcement.html" \
  "AFI — NRB Green Finance Taxonomy announcement"

fetch \
  "https://www.investforimpactnepal.com/wp-content/uploads/2024/05/ESG-Landscape-Analysis-Report.pdf" \
  "10-secondary-references/iin-esg-landscape-analysis-2024.pdf" \
  "IIN ESG Landscape Analysis Report (May 2024)"

fetch \
  "https://cadmusgroup.com/are-nepals-banks-ready-for-climate-transition/" \
  "10-secondary-references/cadmus-nepal-banks-climate-transition.html" \
  "Cadmus — Are Nepal's banks ready for climate transition?"

fetch \
  "https://cadmusgroup.com/accelerating-dfi-investments-in-nepals-financial-service-industry/" \
  "10-secondary-references/cadmus-dfi-nepal.html" \
  "Cadmus — Accelerating DFI investments in Nepal's financial service industry"

fetch \
  "https://myrepublica.nagariknetwork.com/news/environmental-and-social-risk-management-in-nepali-banking-policy-implementation-and-status/" \
  "10-secondary-references/myrepublica-esrm-nepal-opinion.html" \
  "MyRepublica — ESRM in Nepali banking (opinion)"

# ---------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------

printf "\n============================================================\n"
printf "Summary\n"
printf "============================================================\n"
printf "  fetched OK   : %d\n" "$OK_COUNT"
printf "  skipped      : %d (already present; use --force to re-fetch)\n" "$SKIP_COUNT"
printf "  failed       : %d\n" "$FAIL_COUNT"
printf "  manual only  : %d\n" "$MANUAL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  printf "\nFAILED downloads (URL may have moved or is behind a login wall):\n"
  for entry in "${FAILED_LIST[@]}"; do
    printf "  - %s\n" "$entry"
  done
fi

if [ "$MANUAL_COUNT" -gt 0 ]; then
  printf "\nNEEDS MANUAL RETRIEVAL:\n"
  for entry in "${MANUAL_LIST[@]}"; do
    printf "  - %s\n" "$entry"
  done
fi

if [ "$FAIL_COUNT" -gt 0 ] || [ "$MANUAL_COUNT" -gt 0 ]; then
  printf "\nSee docs/regulatory-sources/README.md for retrieval hints on each item.\n"
fi

# Non-zero exit if any download failed outright (manual-only is not a failure).
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
