# `data/` — never commit subscriber data

This directory is `.gitignore`d (see the `data/` line in `.gitignore`) with
one exception: this README, which exists so the directory keeps its shape in
the repo.

Do NOT put GTPL STB lists, customer phone numbers, subscriber id exports,
billing files, or any file identifying a real user in this directory and
push it. The GTPL STB list that used to live at `data/stb_numbers.txt` was
committed to a public repository (Grocerease pre-audit) and enabled the
attack described in `AUDIT_2026-07-03_full.md` §C3 — anyone could scrape
the list and hijack real subscribers' GETV coin subsidies before the
customers linked their own boxes.

The `.github/workflows/upload-stb.yml` job now expects the STB list to be
injected at run time via a GitHub Actions secret, not read from the repo.
Local development: place `stb_numbers.txt` here — the `data/` gitignore rule
keeps it out of commits.
