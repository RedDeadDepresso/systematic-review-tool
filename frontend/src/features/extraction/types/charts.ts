interface BarChartData {
  questionId: number;
  question: string;
  columnTitle: string;
  type: string;
  data: Array<{
    label: string;
    count: number;
  }>;
}

interface ScatterPlotData {
  questionX: {
    id: number;
    columnTitle: string;
  };
  questionY: {
    id: number;
    columnTitle: string;
  };
  data: Array<{
    referenceId: number;
    title: string;
    x: number;
    y: number;
    bubbleSize: number;
  }>;
}

interface EvidenceGapMapData {
  questionRow: {
    id: number;
    columnTitle: string;
    options: string[];
  };
  questionCol: {
    id: number;
    columnTitle: string;
    options: string[];
  };
  maxCount: number;
  cells: Array<{
    row: string;
    col: string;
    count: number;
    references: Array<{
      id: number;
      title: string;
    }>;
  }>;
}

interface PublicationTimelineData {
  data: Array<{
    year: number;
    count: number;
  }>;
  totalReferences: number;
  yearRange: {
    min: number;
    max: number;
  } | null;
}
