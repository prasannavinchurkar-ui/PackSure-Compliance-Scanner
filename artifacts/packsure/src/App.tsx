import { useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Barcode,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  CloudUpload,
  Download,
  FileCheck2,
  FileSearch,
  Filter,
  History,
  Info,
  LayoutDashboard,
  Loader2,
  Menu,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  ScanLine,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetScanQueryKey,
  getHealthCheckQueryKey,
  getListScansQueryKey,
  useCreateScan,
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetScan,
  useHealthCheck,
  useListScans,
  useLookupBarcode,
} from '@workspace/api-client-react';
import type {
  ActivityItem,
  BarcodeProduct,
  DashboardSummary,
  Declaration,
  Finding,
  Scan,
  ScanDetail,
} from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
  Link,
} from 'wouter';

const queryClient = new QueryClient();

const statusStyles: Record<string, string> = {
  compliant: 'bg-[hsl(162_38%_91%)] text-[hsl(162_42%_27%)] border-[hsl(162_32%_75%)]',
  review: 'bg-[hsl(42_82%_88%)] text-[hsl(31_54%_29%)] border-[hsl(42_54%_69%)]',
  violation: 'bg-[hsl(2_67%_94%)] text-[hsl(2_54%_39%)] border-[hsl(2_48%_80%)]',
  neutral: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  passed: 'bg-[hsl(162_38%_91%)] text-[hsl(162_42%_27%)] border-[hsl(162_32%_75%)]',
  warning: 'bg-[hsl(42_82%_88%)] text-[hsl(31_54%_29%)] border-[hsl(42_54%_69%)]',
  failed: 'bg-[hsl(2_67%_94%)] text-[hsl(2_54%_39%)] border-[hsl(2_48%_80%)]',
  open: 'bg-[hsl(2_67%_94%)] text-[hsl(2_54%_39%)] border-[hsl(2_48%_80%)]',
  resolved: 'bg-[hsl(162_38%_91%)] text-[hsl(162_42%_27%)] border-[hsl(162_32%_75%)]',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function StatusBadge({ status }: { status: string }) {
  return <span data-testid={`status-${status}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide ${statusStyles[status] ?? statusStyles.neutral}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}
  </span>;
}

function MetricSkeleton() {
  return <div className="h-[116px] animate-pulse rounded-xl border border-border bg-card p-5"><div className="h-3 w-24 rounded bg-muted" /><div className="mt-5 h-8 w-20 rounded bg-muted" /></div>;
}

function QueryError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-[hsl(2_48%_80%)] bg-[hsl(2_67%_97%)] px-5 py-12 text-center">
    <CircleAlert className="mb-3 h-6 w-6 text-destructive" />
    <p className="font-semibold text-foreground">Could not load {label}</p>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">The service did not return a usable result. Try again before leaving the workspace.</p>
    <button data-testid={`button-retry-${label}`} onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><RefreshCw className="h-4 w-4" />Retry</button>
  </div>;
}

function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof Search; title: string; detail: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-5 py-16 text-center">
    <div className="mb-4 rounded-2xl bg-secondary p-3 text-muted-foreground"><Icon className="h-6 w-6" /></div>
    <h3 className="font-display text-lg font-semibold">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 30000 } });
  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/scan', label: 'New scan', icon: FileSearch },
    { href: '/scans', label: 'Scan history', icon: History },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];
  return <div className="noise min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-30 w-[244px] border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2">
        <Link href="/" data-testid="link-brand" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck className="h-5 w-5" /></span>
          <span><span className="block font-display text-lg font-bold leading-none tracking-tight">PackSure</span><span className="mt-1 block font-mono-ui text-[9px] uppercase tracking-[.16em] text-sidebar-foreground/55">Field intelligence</span></span>
        </Link>
        <button data-testid="button-close-menu" onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-10 px-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-sidebar-foreground/40">Workspace</div>
      <nav className="mt-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? location === '/' : location.startsWith(href);
          return <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
            <Icon className={`h-[17px] w-[17px] ${active ? 'text-sidebar-primary' : ''}`} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
          </Link>;
        })}
      </nav>
      <div className="absolute bottom-5 left-4 right-4">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-destructive' : 'bg-[hsl(162_48%_55%)]'}`} /><span className="font-mono-ui text-[10px] uppercase tracking-wider text-sidebar-foreground/60">{health.isError ? 'Service issue' : 'Ruleset online'}</span></div>
          <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/45">Legal Metrology rules active<br />v2024.11 · India</p>
        </div>
        <div className="mt-4 flex items-center gap-3 px-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary font-display text-xs font-bold text-sidebar-primary-foreground">AS</div><div><p className="text-xs font-semibold">Ananya Sharma</p><p className="font-mono-ui text-[10px] text-sidebar-foreground/45">Inspector · Delhi</p></div><button data-testid="button-notifications" className="ml-auto text-sidebar-foreground/45 hover:text-sidebar-primary"><Bell className="h-4 w-4" /></button></div>
      </div>
    </aside>
    {mobileOpen && <button data-testid="button-overlay-menu" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-[hsl(214_40%_17%/.3)] lg:hidden" />}
    <main className="min-h-[100dvh] lg:pl-[244px]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3"><button data-testid="button-open-menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-secondary lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:block">Delhi enforcement division <span className="mx-2 text-border">/</span> 06 Feb 2025</div></div>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(162_48%_39%)]" />Secure workspace</span><Link href="/scan" data-testid="link-header-new-scan" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"><Upload className="h-3.5 w-3.5" />New scan</Link></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">{children}</div>
    </main>
  </div>;
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</div><h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">{detail}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}

function Overview() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activity = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const data = summary.data as DashboardSummary | undefined;
  const activities = activity.data as ActivityItem[] | undefined;
  return <div className="reveal">
    <PageHeading eyebrow="Inspector workspace / Overview" title="Good morning, Ananya." detail="A clear read on recent packaging compliance across your jurisdiction." action={<Link href="/scan" data-testid="link-start-scan" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><FileSearch className="h-4 w-4" />Start a scan <ChevronRight className="h-4 w-4" /></Link>} />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summary.isLoading ? <><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></> : summary.isError || !data ? <div className="sm:col-span-2 xl:col-span-4"><QueryError label="summary" onRetry={() => summary.refetch()} /></div> : <>
        <MetricCard label="Compliance rate" value={`${data.complianceRate}%`} note={`${data.trend >= 0 ? '+' : ''}${data.trend}% from last period`} trend={data.trend} icon={ShieldCheck} accent="gold" testId="compliance-rate" />
        <MetricCard label="Scans today" value={data.scansToday} note={`${data.totalScans} total records`} icon={FileSearch} accent="navy" testId="scans-today" />
        <MetricCard label="Open findings" value={data.openFindings} note="Require officer review" icon={CircleAlert} accent="red" testId="open-findings" />
        <MetricCard label="Decision split" value={`${data.compliantCount} / ${data.reviewCount} / ${data.violationCount}`} note="Pass / review / violation" icon={BarChart3} accent="teal" testId="decision-split" />
      </>}
    </section>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.28fr_.72fr]">
      <section className="surface-grid rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /><h2 className="font-display text-lg font-semibold">Compliance pulse</h2></div><p className="mt-1 text-sm text-muted-foreground">Your inspection decisions, at a glance.</p></div><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Live summary</span></div>
        {summary.isLoading ? <div className="mt-10 h-40 animate-pulse rounded-xl bg-muted" /> : data ? <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-center"><div className="relative grid h-44 w-44 shrink-0 place-items-center self-center rounded-full" style={{ background: `conic-gradient(hsl(var(--chart-2)) 0 ${data.complianceRate}%, hsl(var(--chart-1)) ${data.complianceRate}% ${Math.min(100, data.complianceRate + 16)}%, hsl(var(--muted)) ${Math.min(100, data.complianceRate + 16)}% 100%)` }}><div className="grid h-32 w-32 place-items-center rounded-full bg-card"><div className="text-center"><div data-testid="text-dashboard-rate" className="font-display text-3xl font-bold">{data.complianceRate}%</div><div className="font-mono-ui text-[9px] uppercase tracking-widest text-muted-foreground">cleared</div></div></div></div><div className="min-w-0 flex-1 space-y-4">{[['Compliant', data.compliantCount, 'bg-[hsl(var(--chart-2))]'], ['Needs review', data.reviewCount, 'bg-[hsl(var(--chart-1))]'], ['Violation', data.violationCount, 'bg-[hsl(var(--chart-3))]']].map(([label, count, color]) => <div key={String(label)} className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="flex-1 text-sm text-muted-foreground">{label}</span><span data-testid={`text-count-${String(label).replace(' ', '-').toLowerCase()}`} className="font-mono-ui text-sm font-medium">{count}</span><div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block"><div className={`h-full rounded-full ${color}`} style={{ width: `${data.totalScans ? (Number(count) / data.totalScans) * 100 : 0}%` }} /></div></div>)}</div></div> : <EmptyState icon={BarChart3} title="No compliance data yet" detail="Your first completed scan will establish the baseline here." /> }
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[hsl(var(--accent))]" /><h2 className="font-display text-lg font-semibold">Recent activity</h2></div><p className="mt-1 text-sm text-muted-foreground">Latest decisions and evidence.</p></div><Link href="/scans" data-testid="link-view-all-activity" className="text-xs font-semibold text-muted-foreground hover:text-foreground">View all</Link></div>
        <div className="mt-6">{activity.isLoading ? <div className="space-y-5">{[1, 2, 3, 4].map(i => <div key={i} className="flex animate-pulse gap-3"><div className="h-8 w-8 rounded-full bg-muted" /><div className="flex-1"><div className="h-3 w-3/4 rounded bg-muted" /><div className="mt-2 h-2.5 w-1/2 rounded bg-muted" /></div></div>)}</div> : activity.isError ? <QueryError label="activity" onRetry={() => activity.refetch()} /> : !activities?.length ? <EmptyState icon={Activity} title="No activity yet" detail="Completed inspection activity will appear here." /> : <div className="space-y-1">{activities.slice(0, 6).map(item => <ActivityRow key={item.id} item={item} />)}</div>}</div>
      </section>
    </div>
    <section className="mt-6 grid gap-3 md:grid-cols-3"><QuickLink href="/scan" icon={CloudUpload} title="Scan new evidence" detail="Upload a package image and extract declarations." /><QuickLink href="/scans" icon={ClipboardCheck} title="Review inspection history" detail="Search decisions, risks, and previous evidence." /><QuickLink href="/settings" icon={SlidersHorizontal} title="Check rule-set" detail="Confirm the active jurisdiction and preferences." /></section>
  </div>;
}

function MetricCard({ label, value, note, trend, icon: Icon, accent, testId }: { label: string; value: ReactNode; note: string; trend?: number; icon: typeof ShieldCheck; accent: string; testId: string }) {
  const accentClass = { gold: 'bg-[hsl(var(--accent)/.18)] text-[hsl(31_54%_29%)]', navy: 'bg-[hsl(var(--primary)/.1)] text-primary', red: 'bg-[hsl(var(--destructive)/.12)] text-destructive', teal: 'bg-[hsl(162_38%_88%)] text-[hsl(162_42%_27%)]' }[accent] ?? '';
  return <div data-testid={`metric-${testId}`} className="group rounded-xl border border-border bg-card p-5 hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/.55)] hover:shadow-md"><div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${accentClass}`}><Icon className="h-4 w-4" /></span></div><div className="mt-4 flex items-end gap-2"><strong data-testid={`value-${testId}`} className="font-display text-3xl font-bold tracking-tight">{value}</strong>{trend !== undefined && <span className={`mb-1 flex items-center text-xs font-semibold ${trend >= 0 ? 'text-[hsl(162_42%_27%)]' : 'text-destructive'}`}>{trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(trend)}%</span>}</div><p className="mt-1.5 text-xs text-muted-foreground">{note}</p></div>;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = item.type === 'finding' ? CircleAlert : item.type === 'report' ? FileCheck2 : FileSearch;
  const content = <div data-testid={`activity-item-${item.id}`} className="flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-secondary/70"><span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${item.status === 'violation' ? 'bg-[hsl(var(--destructive)/.1)] text-destructive' : item.status === 'review' ? 'bg-[hsl(var(--accent)/.2)] text-[hsl(31_54%_29%)]' : 'bg-[hsl(162_38%_88%)] text-[hsl(162_42%_27%)]'}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p></div><div className="shrink-0 text-right"><p className="font-mono-ui text-[10px] text-muted-foreground">{formatTime(item.timestamp)}</p><StatusBadge status={item.status} /></div></div>;
  return item.scanId ? <Link href={`/scans/${item.scanId}`} data-testid={`link-activity-${item.id}`}>{content}</Link> : content;
}

function QuickLink({ href, icon: Icon, title, detail }: { href: string; icon: typeof Search; title: string; detail: string }) {
  return <Link href={href} data-testid={`link-quick-${title.toLowerCase().replaceAll(' ', '-')}`} className="group rounded-xl border border-border bg-card p-4 hover:-translate-y-0.5 hover:border-[hsl(var(--accent)/.7)] hover:shadow-sm"><div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-primary"><Icon className="h-4 w-4" /></span><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></Link>;
}

type BarcodeDetectorResult = { rawValue?: string; format?: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const barcodeFormatLabel = (format?: string) => format ? format.replaceAll('_', ' ').toUpperCase() : 'Detected barcode';

function BarcodeLookupPanel({ onProductFound }: { onProductFound: (product: BarcodeProduct) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const sessionRef = useRef({ active: false });
  const [draftBarcode, setDraftBarcode] = useState('');
  const [rawBarcode, setRawBarcode] = useState('');
  const [detectedFormat, setDetectedFormat] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const barcodeQuery = useLookupBarcode(rawBarcode, { query: { queryKey: ['barcode-lookup', rawBarcode], enabled: Boolean(rawBarcode), retry: false } });

  const stopCamera = () => {
    sessionRef.current.active = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  useEffect(() => () => {
    sessionRef.current.active = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (barcodeQuery.data?.found && barcodeQuery.data.product) onProductFound(barcodeQuery.data.product);
  }, [barcodeQuery.data, onProductFound]);

  const acceptBarcode = (value: string, format?: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRawBarcode(trimmed);
    setDraftBarcode(trimmed);
    setDetectedFormat(format || 'manual entry');
    setCameraError('');
  };

  const startCamera = async () => {
    setCameraError('');
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live barcode scanning is not supported in this browser. Use the manual GTIN / UPC entry below.');
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      sessionRef.current.active = true;
      setCameraActive(true);
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new Detector();
      const scanFrame = async () => {
        if (!sessionRef.current.active || !videoRef.current) return;
        try {
          const detections = await detector.detect(videoRef.current);
          const match = detections.find(item => item.rawValue);
          if (match?.rawValue) {
            acceptBarcode(match.rawValue, match.format);
            stopCamera();
            return;
          }
        } catch {
          setCameraError('The camera is on, but the barcode could not be read yet. Move closer and keep the code centered.');
        }
        if (sessionRef.current.active) frameRef.current = requestAnimationFrame(() => void scanFrame());
      };
      frameRef.current = requestAnimationFrame(() => void scanFrame());
    } catch (error) {
      const reason = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access or use manual entry.'
        : 'The camera could not be started. Use manual entry if the device has no available camera.';
      setCameraError(reason);
      stopCamera();
    }
  };

  const submitManualBarcode = () => {
    const normalized = draftBarcode.trim().replaceAll(' ', '').replaceAll('-', '');
    if (!/^\d+$/.test(normalized) || ![8, 12, 13, 14].includes(normalized.length)) {
      setCameraError('Enter an 8, 12, 13, or 14 digit GTIN, EAN, or UPC barcode.');
      return;
    }
    acceptBarcode(normalized, 'manual entry');
  };

  return <div className="mt-7 space-y-4">
    <section className="rounded-xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.06)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-[hsl(var(--accent))]"><Barcode className="h-5 w-5" /></span><div><div className="flex items-center gap-2"><span className="font-mono-ui text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">Phase 01</span><span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Camera → raw string</span></div><h3 className="mt-1 text-sm font-semibold">Scan the product barcode</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Point the rear camera at the barcode. The raw value is captured without guessing or OCR.</p></div></div>
        {cameraActive && <button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-primary"><X className="h-3.5 w-3.5" />Stop camera</button>}
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-[hsl(214_40%_12%)]">
        <video ref={videoRef} muted playsInline className={cameraActive ? 'block aspect-video h-full w-full object-cover' : 'hidden'} />
        {cameraActive ? <div className="relative aspect-video"><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="h-20 w-[72%] rounded-lg border-2 border-[hsl(var(--accent))] shadow-[0_0_0_999px_rgba(4,20,35,.28)]" /></div><span className="absolute bottom-3 left-0 right-0 text-center font-mono-ui text-[10px] uppercase tracking-wider text-white/80">Align barcode inside the frame</span></div> : <div className="flex aspect-[2.3/1] flex-col items-center justify-center px-5 text-center text-white/70"><ScanLine className="h-9 w-9 text-[hsl(var(--accent))]" /><p className="mt-2 text-sm font-semibold text-white">Camera ready when you are</p><p className="mt-1 text-xs">Use a well-lit, steady view of the barcode.</p></div>}
      </div>
      {!cameraActive && <button type="button" onClick={() => void startCamera()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><ScanLine className="h-4 w-4 text-[hsl(var(--accent))]" />Start camera scanner</button>}
      <div className="mt-4 border-t border-border pt-4">
        <label htmlFor="manual-barcode" className="mb-1.5 block text-xs font-semibold text-foreground">Manual fallback</label>
        <div className="flex gap-2"><input id="manual-barcode" data-testid="input-manual-barcode" inputMode="numeric" value={draftBarcode} onChange={event => setDraftBarcode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submitManualBarcode(); } }} placeholder="Enter GTIN / EAN / UPC" className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 font-mono-ui text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.25)]" /><button type="button" onClick={submitManualBarcode} className="rounded-lg border border-primary bg-background px-3.5 text-xs font-semibold text-primary hover:bg-secondary">Use code</button></div>
      </div>
      {cameraError && <div data-testid="status-barcode-camera-error" className="mt-3 flex items-start gap-2 rounded-lg border border-[hsl(42_54%_69%)] bg-[hsl(42_82%_94%)] p-3 text-xs text-[hsl(31_54%_29%)]"><Info className="mt-0.5 h-4 w-4 shrink-0" />{cameraError}</div>}
    </section>
    {rawBarcode && <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono-ui text-[10px] uppercase tracking-wider text-[hsl(162_42%_27%)]">Phase 02</span><span className="rounded-full bg-[hsl(162_38%_91%)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(162_42%_27%)]">Database API lookup</span></div><h3 className="mt-1 text-sm font-semibold">Product details from the raw value</h3></div><span className="rounded-md bg-secondary px-2.5 py-1 font-mono-ui text-xs font-semibold">{barcodeFormatLabel(detectedFormat)}</span></div>
      <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-3"><p className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Raw barcode string</p><p data-testid="text-raw-barcode" className="mt-1 break-all font-mono-ui text-base font-semibold tracking-wider text-primary">{rawBarcode}</p></div>
      {barcodeQuery.isFetching && <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Querying the product database…</div>}
      {barcodeQuery.isError && <div className="mt-4 flex items-start gap-2 rounded-lg border border-[hsl(2_48%_80%)] bg-[hsl(2_67%_97%)] p-3 text-xs text-[hsl(2_54%_39%)]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />This value is not a supported product identifier or the lookup service is unavailable. Verify the code and enter package details manually.</div>}
      {barcodeQuery.data && <div className="mt-4"><div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${barcodeQuery.data.found ? 'border-[hsl(162_32%_75%)] bg-[hsl(162_38%_95%)] text-[hsl(162_42%_27%)]' : 'border-[hsl(42_54%_69%)] bg-[hsl(42_82%_94%)] text-[hsl(31_54%_29%)]'}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{barcodeQuery.data.message}</div>{barcodeQuery.data.product && <div className="mt-4 grid gap-3 sm:grid-cols-3">{[['Manufacturer', barcodeQuery.data.product.manufacturer], ['Net quantity', barcodeQuery.data.product.netQuantity], ['Brand', barcodeQuery.data.product.brand]].map(([label, value]) => <div key={label} className="rounded-lg border border-border p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value || 'Not provided by database'}</p></div>)}</div>}</div>}
    </section>}
  </div>;
}

function ScanPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const create = useCreateScan();
  const [fileName, setFileName] = useState('');
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [netQuantity, setNetQuantity] = useState('');
  const [category, setCategory] = useState('Packaged commodity');
  const [error, setError] = useState('');
  const onSubmit = (event: FormEvent) => { event.preventDefault(); if (!productName.trim() || !brand.trim()) { setError('Add the product name and brand before starting the analysis.'); return; } setError(''); create.mutate({ data: { productName: productName.trim(), brand: brand.trim(), manufacturer: manufacturer.trim() || null, netQuantity: netQuantity.trim() || null, category, imageName: fileName || null } }, { onSuccess: detail => { queryClient.invalidateQueries({ queryKey: getListScansQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() }); setLocation(`/scans/${detail.id}`); }, onError: () => setError('Analysis could not be completed. Confirm the package details and try again.') }); };
  return <div className="reveal"><PageHeading eyebrow="Evidence intake / New scan" title="Turn a package into a decision." detail="Scan the barcode first, enrich it from the product database, then upload the principal display panel for Legal Metrology analysis." />
    <div className="grid gap-6 xl:grid-cols-[1.06fr_.94fr]"><form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 sm:p-7">
       <div className="mb-6 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Package evidence</h2><p className="mt-1 text-sm text-muted-foreground">Capture the identifier, then verify the declarations.</p></div><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Step 01 / 02</span></div>
      <label htmlFor="package-image" data-testid="dropzone-package-image" className={`group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors ${fileName ? 'border-[hsl(162_38%_58%)] bg-[hsl(162_38%_95%)]' : 'border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.08)] hover:bg-[hsl(var(--accent)/.15)]'}`}><input id="package-image" data-testid="input-package-image" type="file" accept="image/*" className="sr-only" onChange={event => setFileName(event.target.files?.[0]?.name ?? '')} />{fileName ? <><span className="grid h-12 w-12 place-items-center rounded-full bg-[hsl(162_38%_88%)] text-[hsl(162_42%_27%)]"><Check className="h-6 w-6" /></span><strong className="mt-4 text-sm">{fileName}</strong><span className="mt-1 text-xs text-muted-foreground">Ready for analysis · Choose another image</span></> : <><span className="grid h-12 w-12 place-items-center rounded-full bg-card text-primary shadow-sm"><CloudUpload className="h-6 w-6" /></span><strong className="mt-4 text-sm">Drop package image here</strong><span className="mt-1 text-xs text-muted-foreground">or browse from this device · JPG, PNG up to 10 MB</span></>}</label>
       <BarcodeLookupPanel onProductFound={product => { if (product.productName) setProductName(product.productName); if (product.brand) setBrand(product.brand); if (product.manufacturer) setManufacturer(product.manufacturer); if (product.netQuantity) setNetQuantity(product.netQuantity); if (product.category) setCategory(product.category); }} />
       <div className="mt-7 grid gap-4 sm:grid-cols-2"><Field id="product-name" label="Product name" value={productName} onChange={setProductName} placeholder="Filled from database when available" /><Field id="brand-name" label="Brand" value={brand} onChange={setBrand} placeholder="Filled from database when available" /><Field id="manufacturer-name" label="Manufacturer / packer" value={manufacturer} onChange={setManufacturer} placeholder="e.g. Annapurna Foods Pvt. Ltd." /><Field id="net-quantity" label="Net quantity" value={netQuantity} onChange={setNetQuantity} placeholder="e.g. 500 g" /><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-foreground">Commodity category</span><select data-testid="select-category" value={category} onChange={e => setCategory(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.25)]"><option>Packaged commodity</option><option>Food and beverage</option><option>Personal care</option><option>Household goods</option><option>Electrical goods</option></select></label></div>
      {error && <div data-testid="status-scan-error" className="mt-5 flex items-start gap-2 rounded-lg border border-[hsl(2_48%_80%)] bg-[hsl(2_67%_97%)] p-3 text-sm text-[hsl(2_54%_39%)]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <button data-testid="button-start-analysis" type="submit" disabled={create.isPending} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-70">{create.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Reading package evidence…</> : <><Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />Start compliance analysis <ChevronRight className="h-4 w-4" /></>}</button>
    </form>
    <aside className="rounded-2xl border border-border bg-[hsl(var(--primary))] p-6 text-primary-foreground sm:p-7"><div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--accent))]"><ShieldCheck className="h-4 w-4" />Defensible by design</div><h2 className="mt-10 max-w-sm font-display text-2xl font-bold leading-tight">A finding is only useful when you can show your work.</h2><p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/65">PackSure keeps the source image, extracted text, confidence, and exact rule reference together in every report.</p><div className="mt-12 space-y-4 border-t border-primary-foreground/15 pt-5">{[['01', 'Evidence first', 'The package image anchors every declaration.'], ['02', 'Rule-linked', 'Each concern maps to a specific requirement.'], ['03', 'Officer-owned', 'You make the call. PackSure makes it clear.']].map(([n, t, d]) => <div key={n} className="flex gap-3"><span className="font-mono-ui text-[10px] text-[hsl(var(--accent))]">{n}</span><div><p className="text-sm font-semibold">{t}</p><p className="mt-0.5 text-xs text-primary-foreground/55">{d}</p></div></div>)}</div></aside></div>
  </div>;
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span><input data-testid={`input-${id}`} id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.25)]" /></label>;
}

function ScansPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'compliant' | 'review' | 'violation'>('all');
  const params = useMemo(() => ({ q: q || undefined, status, limit: 100 as const }), [q, status]);
  const scansQuery = useListScans(params, { query: { queryKey: getListScansQueryKey(params) } });
  const scans = scansQuery.data as Scan[] | undefined;
  return <div className="reveal"><PageHeading eyebrow="Evidence repository / Scan history" title="Inspection history." detail="Search every scanned package, see the decision trail, and open the evidence behind it." action={<Link href="/scan" data-testid="link-history-new-scan" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Upload className="h-4 w-4" />New scan</Link>} />
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-scans" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search product, brand, or category…" className="h-10 w-full rounded-lg border border-transparent bg-secondary pl-9 pr-3 text-sm outline-none focus:border-[hsl(var(--accent))]" /></div><div className="flex items-center gap-2"><Filter className="ml-1 h-4 w-4 text-muted-foreground" /><select data-testid="select-scan-status" value={status} onChange={e => setStatus(e.target.value as typeof status)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:border-[hsl(var(--accent))]"><option value="all">All decisions</option><option value="compliant">Compliant</option><option value="review">Needs review</option><option value="violation">Violation</option></select></div></div>
    {scansQuery.isLoading ? <ScanTableSkeleton /> : scansQuery.isError ? <QueryError label="scan history" onRetry={() => scansQuery.refetch()} /> : !scans?.length ? <EmptyState icon={FileSearch} title={q || status !== 'all' ? 'No matching scans' : 'Your repository is clear'} detail={q || status !== 'all' ? 'Try a broader search or remove the decision filter.' : 'Start a scan to create your first traceable inspection record.'} action={<Link href="/scan" data-testid="link-empty-start-scan" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Upload className="h-4 w-4" />Start a scan</Link>} /> : <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="hidden grid-cols-[1.7fr_1fr_.7fr_.65fr_.9fr_24px] gap-4 border-b border-border bg-secondary/60 px-5 py-3 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground md:grid"><span>Package</span><span>Decision</span><span>Risk</span><span>Issues</span><span>Inspected</span><span /></div><div className="divide-y divide-border">{scans.map(scan => <ScanRow key={scan.id} scan={scan} />)}</div></div>}
    <div className="mt-4 flex items-center gap-2 px-1 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />Showing {scans?.length ?? 0} records · results reflect the active rule-set at time of inspection.</div>
  </div>;
}

function ScanTableSkeleton() {
  return <div className="space-y-px overflow-hidden rounded-xl border border-border bg-card">{[1, 2, 3, 4, 5].map(i => <div key={i} className="flex animate-pulse items-center gap-4 border-b border-border px-5 py-5"><div className="h-9 w-9 rounded-lg bg-muted" /><div className="flex-1"><div className="h-3 w-1/3 rounded bg-muted" /><div className="mt-2 h-2.5 w-1/4 rounded bg-muted" /></div><div className="h-6 w-20 rounded-full bg-muted" /><div className="hidden h-3 w-14 rounded bg-muted sm:block" /></div>)}</div>;
}

function ScanRow({ scan }: { scan: Scan }) {
  return <Link href={`/scans/${scan.id}`} data-testid={`link-scan-${scan.id}`} className="grid grid-cols-1 gap-3 px-4 py-4 hover:bg-secondary/50 md:grid-cols-[1.7fr_1fr_.7fr_.65fr_.9fr_24px] md:items-center md:gap-4 md:px-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground"><PackageCheck className="h-4 w-4" /></span><div className="min-w-0"><p data-testid={`text-product-${scan.id}`} className="truncate text-sm font-semibold">{scan.productName}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{scan.brand} · {scan.category}</p></div></div><div><span className="mr-2 md:hidden text-xs text-muted-foreground">Decision</span><StatusBadge status={scan.status} /></div><div className="text-sm font-semibold md:text-base"><span className="mr-2 md:hidden text-xs font-normal text-muted-foreground">Risk</span><span data-testid={`text-risk-${scan.id}`} className={scan.riskScore > 60 ? 'text-destructive' : scan.riskScore > 30 ? 'text-[hsl(31_54%_29%)]' : 'text-[hsl(162_42%_27%)]'}>{scan.riskScore}<span className="text-xs font-normal text-muted-foreground"> / 100</span></span></div><div className="text-sm"><span className="mr-2 md:hidden text-xs text-muted-foreground">Issues</span>{scan.issueCount ? <span className="font-semibold">{scan.issueCount}</span> : <span className="text-muted-foreground">None</span>}</div><div className="text-xs text-muted-foreground"><span className="mr-2 md:hidden">Inspected</span>{formatDate(scan.scannedAt)}</div><ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" /></Link>;
}

function DetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const query = useGetScan(id, { query: { enabled: Number.isFinite(id), queryKey: getGetScanQueryKey(id) } });
  const detail = query.data as ScanDetail | undefined;
  const [exported, setExported] = useState(false);
  const exportReport = () => {
    if (!detail) return;
    const text = [`PACKSURE INSPECTION REPORT`, `Scan #${detail.id}`, `${detail.productName} · ${detail.brand}`, `Decision: ${detail.status}`, `Risk score: ${detail.riskScore}/100`, '', 'DECLARATIONS', ...detail.declarations.map(d => `${d.label}: ${d.value} [${d.status}] — ${d.requirement}`), '', 'FINDINGS', ...detail.findings.map(f => `${f.severity.toUpperCase()}: ${f.title} — ${f.rule}`)].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `packsure-report-${detail.id}.txt`; anchor.click(); URL.revokeObjectURL(url); setExported(true);
  };
  if (query.isLoading) return <div className="reveal"><div className="h-4 w-28 animate-pulse rounded bg-muted" /><div className="mt-4 h-10 w-2/3 animate-pulse rounded bg-muted" /><div className="mt-8 h-72 animate-pulse rounded-2xl bg-muted" /></div>;
  if (query.isError || !detail) return <div className="reveal"><PageHeading eyebrow="Inspection record" title="Report unavailable." detail="This evidence record could not be found or is no longer accessible." /><QueryError label="scan report" onRetry={() => query.refetch()} /></div>;
  return <div className="reveal"><div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><Link href="/scans" data-testid="link-back-history" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">← Scan history</Link><div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Inspection report / #{detail.id}</div><h1 data-testid="text-report-product" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{detail.productName}</h1><p className="mt-2 text-sm text-muted-foreground">{detail.brand} · {detail.category} · inspected {formatDate(detail.scannedAt)} by {detail.inspector}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={detail.status} /><button data-testid="button-print-report" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-semibold hover:border-primary hover:bg-secondary"><Printer className="h-4 w-4" />Print / save PDF</button><button data-testid="button-export-report" onClick={exportReport} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-semibold hover:border-primary hover:bg-secondary"><Download className="h-4 w-4" />{exported ? 'Downloaded' : 'Editable export'}</button></div></div>
    <div className="grid gap-6 xl:grid-cols-[.84fr_1.16fr]"><EvidencePanel scan={detail} /><div className="space-y-6"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-[hsl(var(--accent))]" /><h2 className="font-display text-lg font-semibold">Extracted declarations</h2></div><p className="mt-1 text-sm text-muted-foreground">What PackSure read from the package.</p></div><span className="font-mono-ui text-[10px] text-muted-foreground">{detail.declarations.length} checks</span></div><div className="mt-5 divide-y divide-border">{detail.declarations.length ? detail.declarations.map(declaration => <DeclarationRow key={declaration.key} declaration={declaration} />) : <p className="py-8 text-center text-sm text-muted-foreground">No declarations were extracted.</p>}</div></section><Findings findings={detail.findings} /></div></div>
  </div>;
}

function EvidencePanel({ scan }: { scan: ScanDetail }) {
  return <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-semibold">Image evidence</h2><p className="mt-1 text-xs text-muted-foreground">Source retained with this record.</p></div><span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Original</span></div><div className="surface-grid relative flex min-h-[330px] items-center justify-center bg-[hsl(214_40%_17%)] p-8"><div className="relative w-full max-w-[280px] rotate-[-3deg] rounded-md border-[10px] border-[hsl(38_24%_82%)] bg-[hsl(41_45%_90%)] px-6 py-9 text-center shadow-2xl"><div className="absolute inset-x-0 top-0 h-2 bg-[hsl(var(--accent))]" /><span className="font-mono-ui text-[9px] uppercase tracking-[.24em] text-[hsl(214_40%_17%)]/50">Package evidence</span><div className="mt-7 font-display text-xl font-bold text-[hsl(214_40%_17%)]">{scan.brand || 'Product'}</div><div className="mt-2 text-[11px] text-[hsl(214_40%_17%)]/65">{scan.productName}</div><div className="mx-auto mt-8 h-px w-20 bg-[hsl(214_40%_17%)]/25" /><div className="mt-4 font-mono-ui text-[9px] text-[hsl(214_40%_17%)]/60">DECLARATIONS CAPTURED</div></div><div className="absolute bottom-4 left-5 right-5 flex items-center justify-between font-mono-ui text-[9px] uppercase tracking-wider text-primary-foreground/50"><span>{scan.imageName || 'Image name not supplied'}</span><span>Evidence #{scan.id}</span></div></div><div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-[hsl(162_42%_27%)]" />Image retained as part of the inspection record</div></section>;
}

function DeclarationRow({ declaration }: { declaration: Declaration }) {
  return <div data-testid={`declaration-${declaration.key}`} className="py-4 first:pt-5 last:pb-1"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{declaration.label}</p><p className="mt-1 text-sm text-foreground/75">{declaration.value || 'Not detected'}</p></div><StatusBadge status={declaration.status} /></div><div className="mt-3 flex items-center gap-3"><div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${declaration.status === 'failed' ? 'bg-destructive' : declaration.status === 'warning' ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--chart-2))]'}`} style={{ width: `${Math.min(100, Math.max(0, declaration.confidence))}%` }} /></div><span className="font-mono-ui text-[10px] text-muted-foreground">{Math.round(declaration.confidence)}% confidence</span></div><p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" />{declaration.requirement}</p></div>;
}

function Findings({ findings }: { findings: Finding[] }) {
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-destructive" /><h2 className="font-display text-lg font-semibold">Findings</h2></div><p className="mt-1 text-sm text-muted-foreground">Items requiring an officer decision.</p></div><span className="font-mono-ui text-[10px] text-muted-foreground">{findings.length} total</span></div>{findings.length ? <div className="mt-5 space-y-3">{findings.map(finding => <div key={finding.id} data-testid={`finding-${finding.id}`} className="rounded-xl border border-border bg-secondary/45 p-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-1 font-mono-ui text-[9px] font-medium uppercase tracking-wider ${finding.severity === 'critical' ? 'bg-destructive text-destructive-foreground' : finding.severity === 'major' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'bg-muted text-muted-foreground'}`}>{finding.severity}</span><StatusBadge status={finding.status} /></div><h3 className="mt-3 text-sm font-semibold">{finding.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.detail}</p><p className="mt-3 border-t border-border pt-2 font-mono-ui text-[10px] text-muted-foreground">{finding.rule}</p></div>)}</div> : <div className="mt-5 flex items-center gap-3 rounded-xl border border-[hsl(162_32%_75%)] bg-[hsl(162_38%_95%)] p-4 text-sm text-[hsl(162_42%_27%)]"><CheckCircle2 className="h-5 w-5" />No findings recorded for this package.</div>}</section>;
}

function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [digest, setDigest] = useState(true);
  const [highRisk, setHighRisk] = useState(true);
  const [language, setLanguage] = useState('English');
  const save = () => { localStorage.setItem('packsure-settings', JSON.stringify({ digest, highRisk, language })); setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  return <div className="reveal"><PageHeading eyebrow="Workspace controls / Settings" title="Keep the workspace yours." detail="Preferences for how PackSure presents evidence, alerts, and rule-set context." action={<button data-testid="button-save-settings-top" onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Check className="h-4 w-4" />{saved ? 'Saved' : 'Save changes'}</button>} />
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><section className="space-y-6"><SettingsCard title="Inspector profile" detail="Shown on generated inspection reports."><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-[hsl(var(--accent))] font-display text-lg font-bold text-[hsl(var(--primary))]">AS</div><div><p className="font-semibold">Ananya Sharma</p><p className="mt-1 text-sm text-muted-foreground">Inspector · Delhi enforcement division</p><p className="mt-1 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">Inspector ID · DL-LM-0428</p></div><button data-testid="button-edit-profile" onClick={() => setSaved(true)} className="ml-auto rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">Edit profile</button></div></SettingsCard>
      <SettingsCard title="Notifications" detail="Quiet by default. Loud when an inspection needs you."><ToggleRow id="toggle-digest" label="Daily inspection digest" detail="A morning summary of activity and open findings." enabled={digest} onChange={() => setDigest(!digest)} /><ToggleRow id="toggle-high-risk" label="High-risk findings" detail="Notify me when a scan scores above the review threshold." enabled={highRisk} onChange={() => setHighRisk(!highRisk)} /></SettingsCard>
      <SettingsCard title="Display language" detail="Used for interface labels and exported report headings."><div className="flex flex-wrap gap-2">{['English', 'हिन्दी'].map(option => <button key={option} data-testid={`button-language-${option}`} onClick={() => setLanguage(option)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${language === option ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.2)]' : 'border-border bg-background hover:bg-secondary'}`}>{option}</button>)}</div></SettingsCard>
    </section><aside className="space-y-6"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-[hsl(var(--accent-foreground))] bg-[hsl(var(--accent))] rounded p-0.5 box-content" /><h2 className="font-display text-lg font-semibold">Active rule-set</h2></div><p className="mt-1 text-sm text-muted-foreground">The source of truth for every decision.</p><div className="mt-6 rounded-xl bg-primary p-4 text-primary-foreground"><div className="flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--accent))]">Current</span><span className="flex items-center gap-1.5 text-xs text-[hsl(162_48%_65%)]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(162_48%_65%)]" />Active</span></div><h3 className="mt-5 font-display text-lg font-semibold">Legal Metrology Packaged Commodities</h3><p className="mt-1 text-xs text-primary-foreground/55">India · Central ruleset</p><div className="mt-5 grid grid-cols-2 gap-3 border-t border-primary-foreground/15 pt-4"><div><p className="font-mono-ui text-[10px] text-primary-foreground/45">VERSION</p><p className="mt-1 text-sm font-semibold">2024.11</p></div><div><p className="font-mono-ui text-[10px] text-primary-foreground/45">UPDATED</p><p className="mt-1 text-sm font-semibold">Nov 18, 2024</p></div></div></div><p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Rules are centrally maintained. Your report preserves the version used at inspection time.</p></section><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[hsl(162_42%_27%)]" /><h2 className="font-display text-lg font-semibold">Data & privacy</h2></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Package evidence and findings are retained in your secure enforcement workspace. Exports contain only the record you choose.</p><button data-testid="button-view-data-policy" onClick={() => setSaved(true)} className="mt-4 text-xs font-semibold text-primary underline decoration-[hsl(var(--accent))] underline-offset-4">View data handling note</button></section></aside></div>
  </div>;
}

function SettingsCard({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p><div className="mt-5">{children}</div></section>;
}

function ToggleRow({ id, label, detail, enabled, onChange }: { id: string; label: string; detail: string; enabled: boolean; onChange: () => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{detail}</p></div><button data-testid={id} role="switch" aria-checked={enabled} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full ${enabled ? 'bg-[hsl(var(--primary))]' : 'bg-muted'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[hsl(var(--accent))] shadow-sm ${enabled ? 'left-6' : 'left-1'}`} /></button></div>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/scan" component={ScanPage} />
        <Route path="/scans" component={ScansPage} />
        <Route path="/scans/:id" component={DetailPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Shell><Router /></Shell>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
