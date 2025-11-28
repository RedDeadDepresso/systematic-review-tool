import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerPortal,
  DrawerOverlay,
} from '@/components/ui/drawer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useFetchReference } from '@/hooks/use-reference';

interface FetchRequest {
  reviewId?: number;
  referenceId?: number;
}

interface ReferenceDrawerProps {
  fetchRequest?: FetchRequest;
  [key: string]: any;
}

export function ReferenceDrawer({
  fetchRequest,
  ...props
}: ReferenceDrawerProps) {
  const shouldFetch = !!fetchRequest?.reviewId && !!fetchRequest?.referenceId;

  const {
    data: referenceData,
    isLoading,
    isError,
    error,
  } = useFetchReference(fetchRequest ?? {}, { enabled: shouldFetch });

  return (
    <Drawer {...props}>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 bg-black/40 z-40" />
        <DrawerContent className="right-2 top-2 bottom-2 fixed z-50 outline-none w-[360px] flex">
          <div className="h-full w-full grow p-5 flex flex-col rounded-[16px]">
            <DrawerTitle className="text-lg font-semibold mb-3">
              Reference Details
            </DrawerTitle>

            <DrawerDescription className="text-sm mb-4">
              Information about the selected reference.
            </DrawerDescription>

            <ScrollArea className="flex-1 pr-2">
              {isLoading && (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full rounded-md" />
                  ))}
                </div>
              )}

              {isError && (
                <p className="text-red-600 text-sm">
                  {error?.message || 'Failed to load reference data.'}
                </p>
              )}

              {!isLoading && !isError && referenceData && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-medium">
                      {referenceData.title || 'Untitled Reference'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm">Publication Types</Label>
                      <p className="text-sm">
                        {referenceData.publication_types || '—'}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-sm">Authors</Label>
                      <p className="text-sm">{referenceData.authors || '—'}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-sm">Journal</Label>
                      <p className="text-sm">{referenceData.journal || '—'}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-sm">Search Methods</Label>
                      <p className="text-sm">
                        {referenceData.search_methods || '—'}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-sm">Article Customizations</Label>
                      <p className="text-sm">
                        {referenceData.article_customizations || '—'}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-sm">Abstract</Label>
                      <p className="text-sm whitespace-pre-line leading-relaxed">
                        {referenceData.abstract || '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
