'use client';

import { useParams } from 'next/navigation';
import { CertificateTemplateEditorPage } from '@/components/features/certificates/CertificateTemplateEditorPage';

/** /org/certificates/templates/new → a fresh template; any other id → edit that template. */
export default function CertificateTemplateEditorRoute() {
    const { id } = useParams<{ id: string }>();
    return <CertificateTemplateEditorPage key={id === 'new' ? 'new' : id} templateId={id === 'new' ? null : id} />;
}
