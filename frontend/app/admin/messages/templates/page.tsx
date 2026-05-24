'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Search, Copy, Check, MessageSquare, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { MessageTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMessageTemplates } from '@/lib/hooks/useMessageTemplates';
import { Badge } from '@/components/ui/badge';

export default function TemplatesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { templates, loading } = useMessageTemplates('org-1');

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.subject && t.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Template ID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Message Templates</h1>
          <p className="text-muted-foreground mt-1">
            System defined templates for transactional notifications, emails and WhatsApp alerts.
          </p>
        </div>
        <div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/admin/messages')} 
            className="gap-2 rounded-xl border-slate-200 hover:bg-slate-50 transition-all hover:scale-[1.02] shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Message Logs
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="border-slate-100 shadow-sm rounded-2xl bg-white/60 backdrop-blur-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by template name, ID or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500 bg-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500 animate-pulse">Loading templates from backend...</p>
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all duration-300 rounded-2xl group flex flex-col justify-between bg-white"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md w-fit">
                      <span className="truncate max-w-[120px]">{template.id}</span>
                      <button 
                        onClick={() => handleCopyId(template.id)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy Template ID"
                      >
                        {copiedId === template.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`rounded-full px-2.5 py-0.5 gap-1 text-xs font-semibold ${
                      template.channel.toLowerCase() === 'email' 
                        ? 'bg-blue-50 text-blue-700 border-blue-100' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}
                  >
                    {template.channel.toLowerCase() === 'email' ? (
                      <Mail className="h-3 w-3" />
                    ) : (
                      <MessageSquare className="h-3 w-3" />
                    )}
                    {template.channel}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-grow">
                {template.subject && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</span>
                    <p className="text-sm font-medium text-slate-700 line-clamp-1">{template.subject}</p>
                  </div>
                )}

                <div className="space-y-1 flex-grow">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Body</span>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl max-h-[140px] overflow-y-auto text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
                    {template.body}
                  </div>
                </div>

                {template.variables && template.variables.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Parameters</span>
                    <div className="flex flex-wrap gap-1.5">
                      {template.variables.map((variable) => (
                        <span 
                          key={variable} 
                          className="text-[10px] font-semibold font-mono bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full transition-colors"
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-slate-100 shadow-sm rounded-2xl bg-white py-12 text-center">
          <CardContent className="text-slate-500 space-y-2">
            <p className="text-lg font-semibold">No templates found</p>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              We couldn't find any templates matching your search criteria. Try modifying your terms.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
