import { useState, useEffect, useRef } from 'react';

interface SidebarSections {
  include: boolean;
  exclude: boolean;
  labels: boolean;
  searchMethods: boolean;
  publicationTypes: boolean;
  publicationYears: boolean;
  fileStatus: boolean;
  assignees: boolean;
  layout: boolean;
}

const DEFAULT_SECTIONS: SidebarSections = {
  include: true,
  exclude: true,
  labels: true,
  searchMethods: true,
  publicationTypes: true,
  publicationYears: true,
  fileStatus: true,
  assignees: true,
  layout: true,
};

export function useFiltersSidebarState(reviewId: number) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Persist section states in localStorage with reviewId as key
  const [sections, setSections] = useState<SidebarSections>(() => {
    if (typeof window === 'undefined') return DEFAULT_SECTIONS;

    try {
      const stored = localStorage.getItem(
        `filtersSidebar_${reviewId}_sections`
      );
      if (!stored) {
        return DEFAULT_SECTIONS;
      }
      return JSON.parse(stored);
    } catch {
      return DEFAULT_SECTIONS;
    }
  });

  // Persist search filter state
  const [searchFilter, setSearchFilter] = useState(() => {
    if (typeof window === 'undefined') return '';

    try {
      const stored = localStorage.getItem(`filtersSidebar_${reviewId}_search`);
      if (!stored) {
        return '';
      }
      return stored;
    } catch {
      return '';
    }
  });

  // Persist scroll position
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(`filtersSidebar_${reviewId}_scroll`);
    if (stored && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = parseInt(stored, 10);
    }
  }, [reviewId]);

  // Save sections to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      `filtersSidebar_${reviewId}_sections`,
      JSON.stringify(sections)
    );
  }, [sections, reviewId]);

  // Save search filter to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`filtersSidebar_${reviewId}_search`, searchFilter);
  }, [searchFilter, reviewId]);

  // Save scroll position on scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      localStorage.setItem(
        `filtersSidebar_${reviewId}_scroll`,
        scrollPositionRef.current.toString()
      );
    }
  };

  const toggleSection = (section: keyof SidebarSections) => {
    setSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const expandAll = () => {
    setSections({
      include: true,
      exclude: true,
      labels: true,
      searchMethods: true,
      publicationTypes: true,
      publicationYears: true,
      fileStatus: true,
      assignees: true,
      layout: true,
    });
  };

  const collapseAll = () => {
    setSections({
      include: false,
      exclude: false,
      labels: false,
      searchMethods: false,
      publicationTypes: false,
      publicationYears: false,
      fileStatus: false,
      assignees: false,
      layout: false,
    });
  };

  return {
    sections,
    setSections,
    toggleSection,
    expandAll,
    collapseAll,
    searchFilter,
    setSearchFilter,
    scrollContainerRef,
    handleScroll,
  };
}
