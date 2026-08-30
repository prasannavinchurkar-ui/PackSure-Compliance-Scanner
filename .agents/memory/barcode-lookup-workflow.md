---
name: Barcode lookup workflow
description: Two-phase barcode capture and product enrichment pattern for PackSure.
---

The scanner treats a barcode as an identifier first: camera capture preserves the raw string and symbology, while product claims come only from a server-side catalog lookup and remain editable for officer verification.

**Why:** Barcode payloads usually identify a product but do not contain manufacturer or net-quantity declarations, and browser camera decoding support is not universal.

**How to apply:** Keep a manual GTIN/EAN/UPC fallback, validate checksums before catalog requests, and show not-found or unavailable results instead of inventing package details.