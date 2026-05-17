import QRCode from 'qrcode';

export interface CertificateData {
  participantName: string;
  score: number;
  rank: number;
  issueDate: string;
  certificateId: string;
}

export async function generateQRCode(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      ...options
    });
  } catch (error) {
    console.error('[v0] QR code generation failed:', error);
    throw error;
  }
}

export async function downloadQRCode(
  text: string,
  filename: string = 'qrcode.png'
): Promise<void> {
  try {
    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    await QRCode.toCanvas(canvas, text, {
      width: 200,
      margin: 2
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('[v0] QR download failed:', error);
    throw error;
  }
}

export function generateCertificateURL(
  baseURL: string,
  certificateId: string,
  participantId: string
): string {
  const params = new URLSearchParams({
    id: certificateId,
    pid: participantId
  });

  return `${baseURL}?${params.toString()}`;
}

export async function generateCertificatePDF(
  data: CertificateData,
  templateId: string
): Promise<Blob> {
  // Placeholder - would integrate with a PDF library like jsPDF
  // For now, return a blob that represents the PDF
  const content = `
    Certificate of Achievement
    
    This is to certify that ${data.participantName}
    has successfully completed the quiz with a score of ${data.score}/100
    and achieved rank ${data.rank}.
    
    Issued on: ${data.issueDate}
    Certificate ID: ${data.certificateId}
  `;

  return new Blob([content], { type: 'application/pdf' });
}

export function getShareableLinks(certificateUrl: string) {
  const encodedUrl = encodeURIComponent(certificateUrl);

  return {
    whatsapp: `https://wa.me/?text=Check out my certificate: ${certificateUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=I just earned a certificate!&url=${encodedUrl}`,
    email: `mailto:?subject=Check my Certificate&body=Check out my certificate: ${certificateUrl}`
  };
}

export function formatCertificateDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
