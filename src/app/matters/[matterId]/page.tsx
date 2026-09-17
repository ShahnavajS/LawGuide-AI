import { Metadata } from 'next';
import { MatterWorkspace } from '@/components/matter';

export const metadata: Metadata = {
  title: 'Matter Workspace | LexiGuide AI',
  description:
    'Multi-document legal case context, cross-document relationships, consistency checks, and attorney consultation preparation.',
};

interface MatterDetailPageProps {
  params: Promise<{
    matterId: string;
  }>;
}

export default async function MatterDetailPage({ params }: MatterDetailPageProps) {
  const { matterId } = await params;
  return <MatterWorkspace matterId={matterId} />;
}
