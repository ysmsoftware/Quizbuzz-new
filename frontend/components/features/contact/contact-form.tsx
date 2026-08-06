'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { SUPPORT_EMAIL } from '@/lib/seo/config';

/**
 * There's no public "contact us" backend endpoint (the only `/contacts` API
 * in the codebase is the organizer's participant-CRM, which requires org
 * auth and isn't for public inquiries). Rather than fake a submission that
 * silently goes nowhere, this composes a real `mailto:` link from what the
 * visitor typed and opens their mail client with it pre-filled — genuinely
 * functional without inventing a backend.
 */
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Please fill in your name, email, and message.');
      return;
    }

    const mailSubject = subject.trim() || `Message from ${name}`;
    const mailBody = `${message}\n\n—\n${name}\n${email}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      mailSubject
    )}&body=${encodeURIComponent(mailBody)}`;

    window.location.href = mailtoUrl;
    toast.success('Opening your email app to send this message…');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-subject">Subject</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What's this about?"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          rows={6}
          required
        />
      </div>
      <Button type="submit" size="lg" className="gap-2">
        <Send className="h-4 w-4" />
        Send message
      </Button>
      <p className="text-xs text-muted-foreground">
        This opens your email app with the message pre-filled and addressed to{' '}
        {SUPPORT_EMAIL} — nothing is sent until you hit send there.
      </p>
    </form>
  );
}
