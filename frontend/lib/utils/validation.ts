export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
}

export function validateParticipantId(id: string): boolean {
  return id.length > 0 && id.length <= 50;
}

export function validateDateRange(
  from: string | Date,
  to: string | Date
): boolean {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;

  return fromDate < toDate;
}

export function validateFileSize(file: File, maxSizeMB: number = 5): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

export function validateCSVData(data: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(data) || data.length === 0) {
    errors.push('CSV data is empty or invalid');
    return { valid: false, errors };
  }

  data.forEach((row, index) => {
    if (!row.participantId) {
      errors.push(`Row ${index + 1}: Missing participant ID`);
    }
    if (!row.email || !validateEmail(row.email)) {
      errors.push(`Row ${index + 1}: Invalid email format`);
    }
    if (!row.fullName || row.fullName.trim().length === 0) {
      errors.push(`Row ${index + 1}: Missing full name`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^"(.*)"$/, '$1'));

  return lines.slice(1).map(line => {
    const values = line
      .split(',')
      .map(v => v.trim().replace(/^"(.*)"$/, '$1'));

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return row;
  });
}
