import React from 'react';
import { LegalInfoWorkspace } from '@/components/legal-info';

interface LegalInfoPageProps {
  searchParams?: Promise<{
    topic?: string;
    docId?: string;
    documentId?: string;
    comparisonId?: string;
  }>;
}

export default async function LegalInfoPage({ searchParams }: LegalInfoPageProps) {
  const params = searchParams ? await searchParams : {};
  const effectiveDocId = params.documentId || params.docId;

  return (
    <LegalInfoWorkspace
      initialTopic={params.topic || 'TERMINATION'}
      initialDocId={effectiveDocId}
      initialComparisonId={params.comparisonId}
    />
  );
}
