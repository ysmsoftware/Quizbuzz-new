import React from 'react';
import { MessageChannel } from '@/lib/types';
import { Card } from '@/components/ui/card';

interface MessagePreviewProps {
  body: string;
  channel: MessageChannel;
  variables?: string[];
}

const sampleValues: Record<string, string> = {
  fullName: 'John Doe',
  contestName: 'JavaScript Challenge 2024',
  participantId: 'QZCP12345ABC',
  contestTime: '2:00 PM',
  contestDate: 'May 15, 2024',
  startTime: '2:00 PM',
  quizUrl: 'https://quiz.example.com/quiz/abc123',
  score: '85',
  rank: '#12',
  resultUrl: 'https://quiz.example.com/results/abc123',
  certificateUrl: 'https://quiz.example.com/cert/abc123',
};

function interpolateVariables(text: string): string {
  let result = text;
  const variableRegex = /\{\{(\w+)\}\}/g;
  
  result = result.replace(variableRegex, (match, variable) => {
    return sampleValues[variable] || match;
  });
  
  return result;
}

export function MessagePreview({ body, channel, variables }: MessagePreviewProps) {
  const previewText = interpolateVariables(body);

  if (channel === 'email' || channel === 'both') {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email Preview</label>
        <Card className="p-6 bg-white border border-gray-200">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">From:</p>
              <p className="font-medium">Quiz Master &lt;noreply@quiz.example.com&gt;</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {previewText}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // WhatsApp preview
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">WhatsApp Preview</label>
      <div className="bg-gradient-to-b from-gray-100 to-gray-50 rounded-lg p-4 min-h-64">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-end gap-2 justify-end mb-3">
            <div className="bg-green-100 rounded-lg rounded-tr-none p-3 max-w-xs">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {previewText}
              </p>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        This is how the message will appear in WhatsApp
      </p>
    </div>
  );
}
