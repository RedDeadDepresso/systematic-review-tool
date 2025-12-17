import { useState } from 'react';
import { Document } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import { PDFPage } from './pdf-page';
import type { Code } from '@/types/code';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { Spinner } from '../ui/spinner';

// Required worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export function PDFViewer({
  fileUrl,
  codes,
}: {
  fileUrl: string;
  codes: Code[];
}) {
  const [numPages, setNumPages] = useState<number>(0);

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      loading={
        <div className="w-full h-[80vh] flex items-center justify-center">
          <Spinner className="size-12" />
        </div>
      }
      error={
        <div className="w-full h-[80vh] flex flex-col items-center justify-center text-red-500">
          <p className="text-lg font-semibold">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please try again later or upload a new file.
          </p>
        </div>
      }
      className="flex flex-col items-center justify-center overflow-auto"
    >
      {Array.from({ length: numPages }, (_, index) => (
        <PDFPage
          key={index}
          pageNumber={index + 1}
          codes={codes.filter((c) => c.page_number === index + 1)}
        />
      ))}
    </Document>
  );
}
