'use client';

import { useState } from 'react';
import { Download, Share2, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCertificates } from '@/lib/hooks/useCertificates';
import { toast } from 'sonner';

const PARTICIPANT_ID = 'QZCP12345ABC';

export default function CertificatesPage() {
  const { certificates, loading, downloadPDF } =
    useCertificates(PARTICIPANT_ID);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const handleDownload = async (certificateId: string) => {
    try {
      await downloadPDF(certificateId);
      toast.success('Certificate downloaded');
    } catch (err) {
      toast.error('Failed to download certificate');
    }
  };

  const handleShare = async (certificateId: string, platform: 'linkedin' | 'whatsapp' | 'copy') => {
    setSharingId(certificateId);
    try {
      // Share functionality would be implemented here
      // For now, just show a success message
      toast.success(`Shared to ${platform}`);
    } catch (err) {
      toast.error('Failed to share certificate');
    } finally {
      setSharingId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Certificates</h1>
        <p className="text-muted-foreground">Download and share your achievement certificates</p>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Award className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                No certificates yet. Pass a contest to earn your first certificate!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <Card key={cert.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Certificate of Achievement</CardTitle>
                <CardDescription>
                  Earned on {new Date(cert.issuedAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Certificate Preview */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-6 text-center">
                  <Award className="h-12 w-12 mx-auto mb-3 text-yellow-600" />
                  <p className="font-serif text-lg font-bold text-gray-800">Certificate of Achievement</p>
                  <p className="text-sm text-gray-600 mt-2">{cert.participantName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Certificate ID: {cert.id}
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <Button
                    onClick={() => handleDownload(cert.id)}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Certificate
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleShare(cert.id, 'linkedin')}
                      size="sm"
                      variant="outline"
                      disabled={sharingId === cert.id}
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      LinkedIn
                    </Button>
                    <Button
                      onClick={() => handleShare(cert.id, 'whatsapp')}
                      size="sm"
                      variant="outline"
                      disabled={sharingId === cert.id}
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      onClick={() => handleShare(cert.id, 'copy')}
                      size="sm"
                      variant="outline"
                      disabled={sharingId === cert.id}
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
