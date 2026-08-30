import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, scansTable, type Scan } from "@workspace/db";
import {
  CreateScanBody,
  CreateScanResponse,
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetScanParams,
  GetScanResponse,
  ListScansQueryParams,
  ListScansResponse,
  LookupBarcodeResponse,
} from "@workspace/api-zod";

type Declaration = {
  key: string;
  label: string;
  value: string;
  status: "passed" | "warning" | "failed";
  confidence: number;
  requirement: string;
};

type Finding = {
  id: number;
  severity: "critical" | "major" | "minor";
  title: string;
  detail: string;
  rule: string;
  status: "open" | "resolved";
};

type DeclarationValues = {
  manufacturer?: string | null;
  netQuantity?: string | null;
  mrp?: string | null;
  packedDate?: string | null;
  consumerCare?: string | null;
  countryOfOrigin?: string | null;
};

const normalizedValue = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const declarationFor = (
  key: string,
  label: string,
  value: string | null | undefined,
  requirement: string,
  missingStatus: "warning" | "failed" = "warning",
): Declaration => {
  const actualValue = normalizedValue(value);
  return {
    key,
    label,
    value: actualValue ?? "Not detected",
    status: actualValue ? "passed" : missingStatus,
    confidence: actualValue ? 98 : 0,
    requirement,
  };
};

const declarationsFor = (variant: "compliant" | "review" | "violation", values: DeclarationValues): Declaration[] => [
  declarationFor("manufacturer", "Manufacturer / Packer", values.manufacturer, "Rule 6(1)(a)"),
  declarationFor("netQuantity", "Net quantity", values.netQuantity, "Rule 6(1)(d)"),
  declarationFor("mrp", "Maximum Retail Price", values.mrp, "Rule 6(1)(e)", variant === "violation" ? "failed" : "warning"),
  declarationFor("date", "Month & year", values.packedDate, "Rule 6(1)(d)"),
  declarationFor("consumerCare", "Consumer care", values.consumerCare, "Rule 6(1)(f)", variant === "violation" ? "failed" : "warning"),
  declarationFor("country", "Country of origin", values.countryOfOrigin, "Rule 6(1)(aa)"),
];

const findingsFor = (variant: "compliant" | "review" | "violation", values: DeclarationValues): Finding[] => {
  if (variant === "compliant") return [];
  const hasConsumerCare = Boolean(normalizedValue(values.consumerCare));
  const findings: Finding[] = [
    {
      id: 1,
      severity: "major",
      title: hasConsumerCare ? "Consumer care declaration requires verification" : "Consumer care declaration is missing",
      detail: hasConsumerCare
        ? "Verify the supplied contact details against the package evidence before closing this finding."
        : "No consumer care contact was supplied for this inspection. Verify the package evidence or enter the declaration manually.",
      rule: "Rule 6(1)(f) · Consumer care details",
      status: "open",
    },
  ];
  if (variant === "violation") {
    const hasMrp = Boolean(normalizedValue(values.mrp));
    findings.unshift({
      id: 2,
      severity: "critical",
      title: hasMrp ? "MRP statement requires verification" : "MRP declaration is missing",
      detail: hasMrp
        ? "Verify the supplied MRP and inclusive-tax qualifier against the package evidence."
        : "No MRP value was supplied for this inspection. Verify the package evidence or enter the declaration manually.",
      rule: "Rule 6(1)(e) · MRP declaration",
      status: "open",
    });
  }
  return findings;
};

const variantFor = (productName: string): "compliant" | "review" | "violation" => {
  const normalized = productName.toLowerCase();
  if (normalized.includes("organic") || normalized.includes("basmati")) return "compliant";
  if (normalized.includes("snack") || normalized.includes("soap")) return "violation";
  return "review";
};

const publicScan = (scan: Scan) => ({
  id: scan.id,
  productName: scan.productName,
  brand: scan.brand,
  manufacturer: scan.manufacturer,
  netQuantity: scan.netQuantity,
  mrp: scan.mrp,
  packedDate: scan.packedDate,
  consumerCare: scan.consumerCare,
  countryOfOrigin: scan.countryOfOrigin,
  barcodeValue: scan.barcodeValue,
  barcodeFormat: scan.barcodeFormat,
  barcodeSource: scan.barcodeSource,
  category: scan.category,
  imageName: scan.imageName,
  status: scan.status as "compliant" | "review" | "violation",
  riskScore: scan.riskScore,
  issueCount: scan.issueCount,
  topIssue: scan.topIssue,
  scannedAt: scan.scannedAt,
  inspector: scan.inspector,
});

const detailScan = (scan: Scan) => ({
  ...publicScan(scan),
  declarations: (scan.declarations ?? []) as Declaration[],
  findings: (scan.findings ?? []) as Finding[],
});

type BarcodeProduct = {
  productName: string | null;
  manufacturer: string | null;
  netQuantity: string | null;
  brand: string | null;
  category: string | null;
  source: string;
};

const barcodeFormat = (value: string): string => {
  if (value.length === 8) return "EAN-8";
  if (value.length === 12) return "UPC-A";
  if (value.length === 13) return "EAN-13 / GTIN-13";
  if (value.length === 14) return "GTIN-14";
  return "Unknown";
};

const isValidBarcode = (value: string): boolean => {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
};

const productFromOpenFoodFacts = async (value: string): Promise<BarcodeProduct | null> => {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(value)}.json?fields=product_name,brands,quantity,categories,manufacturing_places,manufacturers`,
      { headers: { "User-Agent": "PackSure/1.0 (compliance scanner)" } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        quantity?: string;
        categories?: string;
        manufacturing_places?: string;
        manufacturers?: string;
      };
    };
    if (body.status !== 1 || !body.product) return null;
    const product = body.product;
    return {
      productName: product.product_name?.trim() || null,
      manufacturer: product.manufacturers?.trim() || product.manufacturing_places?.trim() || null,
      netQuantity: product.quantity?.trim() || null,
      brand: product.brands?.split(",")[0]?.trim() || null,
      category: product.categories?.split(",")[0]?.trim() || null,
      source: "Open Food Facts",
    };
  } catch {
    return null;
  }
};

const seedScans = [
  {
    productName: "Organic Basmati Rice",
    brand: "EarthBasket",
    category: "Staples",
    imageName: "earthbasket-rice-front.jpg",
    status: "compliant",
    riskScore: 8,
    issueCount: 0,
    topIssue: null,
    inspector: "Aarav Mehta",
    declarations: declarationsFor("compliant", {}),
    findings: findingsFor("compliant", {}),
  },
  {
    productName: "Classic Masala Tea",
    brand: "Kaveri Foods",
    category: "Beverages",
    imageName: "kaveri-tea-label.jpg",
    status: "review",
    riskScore: 42,
    issueCount: 1,
    topIssue: "Consumer care declaration is missing",
    inspector: "Aarav Mehta",
    declarations: declarationsFor("review", {}),
    findings: findingsFor("review", {}),
  },
  {
    productName: "Crispy Millet Snacks",
    brand: "GrainGood",
    category: "Packaged foods",
    imageName: "graingood-snacks-front.jpg",
    status: "violation",
    riskScore: 78,
    issueCount: 2,
    topIssue: "MRP declaration is missing",
    inspector: "Meera Iyer",
    declarations: declarationsFor("violation", {}),
    findings: findingsFor("violation", {}),
  },
  {
    productName: "Neem & Aloe Bath Soap",
    brand: "Natura",
    category: "Personal care",
    imageName: "natura-soap-pack.jpg",
    status: "violation",
    riskScore: 66,
    issueCount: 2,
    topIssue: "MRP declaration is missing",
    inspector: "Meera Iyer",
    declarations: declarationsFor("violation", {}),
    findings: findingsFor("violation", {}),
  },
  {
    productName: "Toor Dal Premium",
    brand: "Harvest Home",
    category: "Staples",
    imageName: "harvest-dal-pack.jpg",
    status: "review",
    riskScore: 31,
    issueCount: 1,
    topIssue: "Consumer care declaration is missing",
    inspector: "Aarav Mehta",
    declarations: declarationsFor("review", {}),
    findings: findingsFor("review", {}),
  },
];

let seedPromise: Promise<void> | undefined;
const ensureSeeded = async (): Promise<void> => {
  if (!seedPromise) {
    seedPromise = (async () => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(scansTable);
      if (Number(count) === 0) {
        await db.insert(scansTable).values(seedScans);
      }
    })();
  }
  await seedPromise;
};

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  await ensureSeeded();
  const scans = await db.select().from(scansTable);
  const compliantCount = scans.filter((scan) => scan.status === "compliant").length;
  const reviewCount = scans.filter((scan) => scan.status === "review").length;
  const violationCount = scans.filter((scan) => scan.status === "violation").length;
  const openFindings = scans.reduce((total, scan) => total + ((scan.findings as Finding[] | null) ?? []).filter((finding) => finding.status === "open").length, 0);
  const scansToday = scans.filter((scan) => scan.scannedAt.toDateString() === new Date().toDateString()).length;
  res.json(GetDashboardSummaryResponse.parse({
    totalScans: scans.length,
    compliantCount,
    reviewCount,
    violationCount,
    complianceRate: scans.length ? Math.round((compliantCount / scans.length) * 100) : 0,
    openFindings,
    scansToday,
    trend: 12.4,
  }));
});

router.get("/activity", async (req, res): Promise<void> => {
  await ensureSeeded();
  const scans = await db.select().from(scansTable).orderBy(desc(scansTable.scannedAt)).limit(8);
  const activity = scans.map((scan) => ({
    id: scan.id,
    type: "scan" as const,
    title: `${scan.brand} · ${scan.productName}`,
    description: scan.status === "compliant"
      ? "Scan completed with no open findings"
      : `${scan.issueCount} ${scan.issueCount === 1 ? "finding" : "findings"} require attention`,
    timestamp: scan.scannedAt,
    status: scan.status as "compliant" | "review" | "violation",
    scanId: scan.id,
  }));
  res.json(GetRecentActivityResponse.parse(activity));
});

router.get("/barcodes/:value", async (req, res): Promise<void> => {
  const rawValue = req.params.value;
  const normalizedValue = rawValue.replace(/\D/g, "");
  const valid = isValidBarcode(normalizedValue);

  if (!valid) {
    res.status(400).json({
      error: "Barcode must be a valid EAN-8, UPC-A, EAN-13, or GTIN-14 value.",
    });
    return;
  }

  const product = await productFromOpenFoodFacts(normalizedValue);
  res.json(LookupBarcodeResponse.parse({
    rawValue,
    normalizedValue,
    format: barcodeFormat(normalizedValue),
    valid,
    found: Boolean(product),
    product,
    message: product
      ? "Product details found. Verify the package declarations against the physical evidence."
      : "No product record was found. Enter the package details manually and continue with evidence analysis.",
  }));
});

router.get("/scans", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = ListScansQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { q, status, limit } = parsed.data;
  const conditions = [];
  if (status && status !== "all") conditions.push(eq(scansTable.status, status));
  if (q) {
    conditions.push(or(ilike(scansTable.productName, `%${q}%`), ilike(scansTable.brand, `%${q}%`)));
  }
  const scans = await db
    .select()
    .from(scansTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(scansTable.scannedAt))
    .limit(limit);
  res.json(ListScansResponse.parse(scans.map(publicScan)));
});

router.post("/scans", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const variant = variantFor(parsed.data.productName);
  const findings = findingsFor(variant, parsed.data);
  const [created] = await db.insert(scansTable).values({
    ...parsed.data,
    status: variant,
    riskScore: variant === "compliant" ? 8 : variant === "review" ? 42 : 78,
    issueCount: findings.length,
    topIssue: findings[0]?.title ?? null,
    inspector: "Aarav Mehta",
    declarations: declarationsFor(variant, parsed.data),
    findings,
  }).returning();
  res.status(201).json(CreateScanResponse.parse(detailScan(created)));
});

router.get("/scans/:id", async (req, res): Promise<void> => {
  await ensureSeeded();
  const params = GetScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, params.data.id));
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetScanResponse.parse(detailScan(scan)));
});

export default router;