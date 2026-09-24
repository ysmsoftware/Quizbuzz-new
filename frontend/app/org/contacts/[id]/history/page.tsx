import { redirect } from 'next/navigation';

/** Participation history lives on the contact profile (it's the same table) — this route
 *  opens the profile scrolled to that section instead of duplicating it. */
export default async function ContactHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/org/contacts/${id}#participation-history`);
}
