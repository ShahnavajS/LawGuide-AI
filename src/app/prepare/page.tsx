import React from 'react';
import { PreparationWorkspace } from '@/components/preparation';

interface PreparePageProps {
  searchParams?: Promise<{
    docId?: string;
    documentId?: string;
    comparisonId?: string;
  }>;
}

export default async function PreparePage({ searchParams }: PreparePageProps) {
  const params = searchParams ? await searchParams : {};
  const effectiveDocId = params.documentId || params.docId;

  return (
    <PreparationWorkspace
      initialDocId={effectiveDocId}
      initialComparisonId={params.comparisonId}
    />
  );
}
