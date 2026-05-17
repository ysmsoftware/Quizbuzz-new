'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Award, 
  Download, 
  ChevronLeft, 
  ShieldCheck, 
  ExternalLink,
  Loader2,
  Trophy,
  CheckCircle2,
  Calendar,
  Building
} from 'lucide-react';
import { certificatesApi } from '@/lib/api/results-certs.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function ParticipantCertificatePage() {
  const { id: participantId, slug } = useParams() as { id: string, slug: string };
  const router = useRouter();

  const { data: certData, isLoading, error } = useQuery({
    queryKey: ['participant-certificate', participantId],
    queryFn: () => certificatesApi.getParticipantCertificate(participantId),
    retry: false,
  });

  const certificate = certData?.data;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Fetching your certificate...</p>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-6">
          <Award className="h-10 w-10 text-muted-foreground opacity-20" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Certificate Not Ready</h1>
        <p className="text-muted-foreground max-w-sm">
          Your certificate is still being generated or is not yet available. Please try again in a few minutes.
        </p>
        <Button variant="ghost" className="mt-8 rounded-xl" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="max-w-xl w-full space-y-8 animate-in fade-in zoom-in duration-700">
        {/* Celebration Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex h-20 w-20 rounded-[2rem] bg-primary/10 items-center justify-center text-primary shadow-2xl shadow-primary/20 mb-2">
            <Trophy className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">Congratulations!</h1>
          <p className="text-muted-foreground text-lg font-medium">
            You've successfully completed the <span className="text-foreground font-bold">{certificate.contest?.title}</span>.
          </p>
        </div>

        {/* Certificate Card */}
        <Card className="bg-background/80 backdrop-blur-2xl border-primary/20 rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          
          <CardContent className="p-10 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Official Document</p>
                <p className="text-sm font-mono text-muted-foreground">{certificate.certificateId}</p>
              </div>
              <Badge className="bg-green-500/10 text-green-500 border-none px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-widest">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </Badge>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <Building className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Issued By</p>
                  <p className="text-lg font-black">{certificate.contest?.organizationName || 'QuizBuzz Organization'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Issue Date</p>
                  <p className="text-lg font-black">{certificate.generatedAt ? format(new Date(certificate.generatedAt), 'MMMM dd, yyyy') : '--'}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50 flex flex-col gap-3">
              <Button 
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
                asChild
              >
                <a href={certificate.fileUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-5 w-5 mr-2" />
                  Download Certificate PDF
                </a>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-14 rounded-2xl border-border/50 bg-background hover:bg-secondary/50 font-bold"
                onClick={() => certificate.fileUrl && window.open(certificate.fileUrl)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview in Browser
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This certificate is uniquely generated and cryptographically signed. <br />
          You can share this link or the downloaded PDF as proof of your accomplishment.
        </p>
      </div>
    </div>
  );
}
