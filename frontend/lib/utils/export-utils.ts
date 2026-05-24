/**
 * Premium Export Utilities for QuizBuzz Admin Dashboard
 * Supports High-Performance CSV compilation and Beautiful Print-optimized PDF exports.
 */

import { Registration } from '@/lib/types';
import { format } from 'date-fns';

export interface ExportDataOptions {
  contestTitle: string;
  registrations: Registration[];
}

/**
 * Escapes fields for CSV compliance (RFC 4180)
 */
function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Downloads a string payload as a CSV file
 */
export function exportToCSV({ contestTitle, registrations }: ExportDataOptions) {
  const headers = [
    'Participant ID',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Institution / College',
    'City',
    'State',
    'Registration Date',
    'Registration Status',
    'Payment Status',
    'Amount Paid (₹)',
    'Live Quiz Status',
    'WhatsApp Opt-In'
  ];

  const rows = registrations.map(reg => {
    const details = reg.participantDetails || {};
    return [
      reg.participantId || '',
      details.fullName || 'Participant',
      details.email || '',
      details.phone || '',
      details.institution || '',
      details.city || '',
      details.state || '',
      reg.registeredAt ? format(new Date(reg.registeredAt), 'yyyy-MM-dd HH:mm:ss') : '—',
      reg.status || 'pending',
      reg.paymentStatus || 'free',
      reg.amount !== undefined ? reg.amount : '0',
      reg.quizStatus || 'not_joined',
      reg.whatsappOptIn ? 'Yes' : 'No'
    ].map(escapeCSVField);
  });

  const csvContent = [headers.join(','), ...rows.join('\n')].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const safeTitle = contestTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const dateStr = format(new Date(), 'yyyy-MM-dd-HHmm');
  
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `quizbuzz-registrations-${safeTitle}-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Renders a gorgeous, print-optimized document and launches the system print dialog to generate a high-fidelity PDF.
 */
export function exportToPDF({ contestTitle, registrations }: ExportDataOptions) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow popups.');
  }

  const dateStr = format(new Date(), 'PPP p');
  const totalCount = registrations.length;
  const confirmedCount = registrations.filter(r => r.status === 'confirmed').length;
  const paidCount = registrations.filter(r => r.paymentStatus === 'completed').length;
  
  // Calculate total revenue
  const revenue = registrations.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const tableRows = registrations.map((reg, index) => {
    const details = reg.participantDetails || {};
    const regDate = reg.registeredAt ? format(new Date(reg.registeredAt), 'dd MMM yyyy') : '—';
    
    // Status colors
    const isPaid = reg.paymentStatus === 'completed';
    const isConfirmed = reg.status === 'confirmed';

    return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td><strong>${details.fullName || 'Participant'}</strong><br/><span style="font-size: 9px; color: #64748b;">${reg.participantId}</span></td>
        <td>${details.email || '—'}<br/><span style="font-size: 9px; color: #64748b;">${details.phone || '—'}</span></td>
        <td>${details.institution || '—'}</td>
        <td style="text-align: center;">${regDate}</td>
        <td style="text-align: center;">
          <span style="padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; background-color: ${isConfirmed ? '#dcfce7' : '#fef3c7'}; color: ${isConfirmed ? '#166534' : '#92400e'};">
            ${(reg.status || 'pending').toUpperCase()}
          </span>
        </td>
        <td style="text-align: center;">
          <span style="padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; background-color: ${isPaid ? '#dcfce7' : '#fee2e2'}; color: ${isPaid ? '#166534' : '#991b1b'};">
            ${isPaid ? 'PAID' : (reg.paymentStatus || 'PENDING').toUpperCase()}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Registrations Report - ${contestTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
          
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          
          body {
            font-family: 'Inter', sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.5;
            background-color: #ffffff;
          }

          /* Header Styling */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }

          .brand-logo {
            font-weight: 900;
            font-size: 20px;
            letter-spacing: -0.5px;
            color: #000000;
          }

          .brand-logo span {
            color: #ef4444; /* Premium crimson accent */
          }

          .report-info {
            text-align: right;
          }

          .report-info h1 {
            margin: 0;
            font-size: 16px;
            font-weight: 800;
            color: #1e293b;
          }

          .report-info p {
            margin: 4px 0 0 0;
            color: #64748b;
            font-size: 10px;
          }

          /* KPI summary cards */
          .kpi-container {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }

          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            background-color: #f8fafc;
          }

          .kpi-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 4px;
          }

          .kpi-value {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
          }

          /* Table Styling */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }

          th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
            padding: 10px 8px;
            text-align: left;
            border: 1px solid #1e293b;
          }

          td {
            padding: 8px;
            border-bottom: 1px solid #e2e8f0;
            border-left: 1px solid #f1f5f9;
            border-right: 1px solid #f1f5f9;
            vertical-align: middle;
          }

          tr:nth-child(even) td {
            background-color: #f8fafc;
          }

          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
            background-color: #ffffff;
          }

          @media print {
            .no-print {
              display: none;
            }
            body {
              background-color: #ffffff;
            }
            tr {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-logo">Quiz<span>Buzz</span></div>
            <p style="margin: 4px 0 0 0; font-size: 10px; color: #475569; font-weight: 500;">Contest Admin Console</p>
          </div>
          <div class="report-info">
            <h1>Registrations Report</h1>
            <p>Contest: <strong>${contestTitle}</strong></p>
            <p>Generated: ${dateStr}</p>
          </div>
        </div>

        <div class="kpi-container">
          <div class="kpi-card">
            <div class="kpi-label">Total Registrations</div>
            <div class="kpi-value">${totalCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Confirmed Entries</div>
            <div class="kpi-value">${confirmedCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Paid Status</div>
            <div class="kpi-value">${paidCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Collected</div>
            <div class="kpi-value">₹${revenue.toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%; text-align: center;">#</th>
              <th style="width: 22%;">Participant</th>
              <th style="width: 22%;">Contact Details</th>
              <th style="width: 25%;">College / Institution</th>
              <th style="width: 11%; text-align: center;">Reg Date</th>
              <th style="width: 8%; text-align: center;">Status</th>
              <th style="width: 8%; text-align: center;">Payment</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          <span>QuizBuzz Admin Services &copy; ${new Date().getFullYear()}</span>
          <span>Page 1 of 1</span>
        </div>

        <script>
          // Automatic printing invocation when document is loaded
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
