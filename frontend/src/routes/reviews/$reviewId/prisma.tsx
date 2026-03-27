// PRISMA flow diagram page for a review.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateReviewPrisma } from '@/features/reviews/hooks/use-reviews';
import { createFileRoute } from '@tanstack/react-router';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AppLayoutContext } from '@/context/app-layout-context';

export const Route = createFileRoute('/reviews/$reviewId/prisma')({
  component: RouteComponent,
});

function Stat({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip: string;
  value?: number;
}) {
  return (
    <div className="flex justify-between text-sm py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground underline">{label}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      <span className="font-semibold">{value ?? 0}</span>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function severityStyles(severity = '') {
  const s = severity.toLowerCase();

  if (s.includes('error')) {
    return 'border-destructive bg-destructive/10';
  }

  if (s.includes('warning')) {
    return 'border-yellow-500 bg-yellow-500/10';
  }

  return 'border-muted bg-muted/40';
}

function PrismaSkeletonLoader() {
  return (
    <div className="space-y-6">
      {/* Diagram Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="mx-auto aspect-[2670/2370] max-h-[700px] rounded-xl" />
        </CardContent>
      </Card>

      {/* Stats Grid Skeleton */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl shadow-sm">
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: i === 2 ? 3 : 2 }).map((_, j) => (
                <div key={j} className="flex justify-between py-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-6" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RouteComponent() {
  const reviewId = Number(Route.useParams().reviewId);
  const { data, isLoading, error } = useCreateReviewPrisma(reviewId);
  const [copied, setCopied] = useState(false);
  const { setPageTitle, setIsAuthenticated, setScroll } =
    useContext(AppLayoutContext);

  useEffect(() => {
    setPageTitle('PRISMA');
    setIsAuthenticated(true);
    setScroll(true);
  }, []);

  if (isLoading) {
    return <PrismaSkeletonLoader />;
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center text-destructive">
        Error loading prisma diagram
      </div>
    );
  }

  const prisma = data.data;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data.fileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Validation Issues Top Banner */}
        {data?.validationIssues && (
          <div className="space-y-3">
            {data.validationIssues.map((issue, i) => (
              <Alert
                key={i}
                className={`rounded-xl border ${severityStyles(issue.severity)}`}
              >
                <AlertTitle className="flex items-center gap-2">
                  {issue.severity}
                </AlertTitle>
                <AlertDescription className="whitespace-pre-wrap text-sm">
                  {issue.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Diagram Preview */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>PRISMA Diagram</CardTitle>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" asChild>
                <a href={data.fileUrl} download>
                  Download Image
                </a>
              </Button>

              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy Link'}
              </Button>

              {data.interactiveUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(data.interactiveUrl, '_blank')}
                >
                  Open Interactive
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {data.fileUrl && (
              <img
                src={data.fileUrl}
                alt="PRISMA flow diagram"
                className="max-h-[700px] w-full object-contain mx-auto rounded-xl"
                loading="lazy"
              />
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SectionCard title="Identification">
            <Stat
              label="Database results"
              tooltip="Total number of records identified from all databases and registers searched (records extracted from bib files)"
              value={prisma?.dbRegisters?.identification?.databases}
            />
            <Stat
              label="Duplicates removed"
              tooltip="Number of duplicate records removed before screening based on matching titles, authors, or DOIs (records with duplicate status removed)"
              value={prisma?.dbRegisters?.removedBeforeScreening?.duplicates}
            />
          </SectionCard>

          <SectionCard title="Screening">
            <Stat
              label="Records screened"
              tooltip="Number of unique records screened based on title and abstract after duplicate removal (records in screening section)"
              value={prisma?.dbRegisters?.records?.screened}
            />
            <Stat
              label="Records excluded"
              tooltip="Number of records excluded during title/abstract screening that did not meet inclusion criteria (records in screening section - records in full-text screening section)"
              value={prisma?.dbRegisters?.records?.excluded}
            />
          </SectionCard>

          <SectionCard title="Eligibility">
            <Stat
              label="Reports sought"
              tooltip="Number of full-text reports sought for retrieval after passing title/abstract screening (records in full-text screening section)"
              value={prisma?.dbRegisters?.reports?.sought}
            />
            <Stat
              label="Not retrieved"
              tooltip="Number of full-text reports that could not be retrieved despite attempts to locate them (records in full-text screening without any opinion)"
              value={prisma?.dbRegisters?.reports?.notRetrieved}
            />
            <Stat
              label="Assessed"
              tooltip="Number of full-text reports successfully retrieved and assessed for eligibility against inclusion criteria (records in full-text screening with at least one opinion)"
              value={prisma?.dbRegisters?.reports?.assessed}
            />
          </SectionCard>

          <SectionCard title="Included">
            <Stat
              label="Studies"
              tooltip="Total number of unique studies included in the systematic review after full-text assessment (records in data extraction)"
              value={prisma?.included?.studies}
            />
            <Stat
              label="Reports"
              tooltip="Total number of publications (reports) describing the included studies. A single study may have multiple reports. (set default to records in data extraction)"
              value={prisma?.included?.reports}
            />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
