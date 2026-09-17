import React from 'react';
import { ComparisonWorkspace } from '@/components/comparison';

interface ComparePageProps {
  searchParams?: Promise<{
    baseDocId?: string;
    targetDocId?: string;
  }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = searchParams ? await searchParams : {};
  return (
    <ComparisonWorkspace
      initialBaseDocId={params.baseDocId}
      initialTargetDocId={params.targetDocId}
    />
  );
}
