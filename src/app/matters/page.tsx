import { Metadata } from 'next';
import { MatterList } from '@/components/matter';

export const metadata: Metadata = {
  title: 'Legal Matters | LexiGuide AI',
  description:
    'Organize contracts, amendments, notices, and policies under unified case context with cross-document intelligence.',
};

export default function MattersPage() {
  return <MatterList />;
}
