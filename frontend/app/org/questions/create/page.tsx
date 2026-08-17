'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, Loader2,
  Upload, FileText, X, AlertCircle, AlertTriangle, ChevronDown,
  Copy, Check,
} from 'lucide-react';
import { useQuestions, useQuestionTags } from '@/lib/hooks/useQuestions';
import { toast } from 'sonner';
import { parseQuestionFile as parseFile } from '@/lib/utils/question-parser';
import { useBatchUpload, type BatchStep } from '@/lib/hooks/useBatchUpload';
import { MultiStepLoader } from '@/components/ui/multi-step-loader';
import { chunkArray } from '@/lib/utils';
import { BULK_UPLOAD_BATCH_SIZE, BULK_UPLOAD_MAX_TOTAL } from '@/lib/constants/bulk-upload';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionForm {
  questionText: string;
  /** Mapped to uppercase before sending: EASY | MEDIUM | HARD */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  /** Stored as the first tag entry (maps to backend `tags[]`) */
  category: string;
  hint: string;
  explanation: string;
  options: Option[];
}

// ─── AI prompt (mirrors buildAiPrompt in CertificateTemplateModal.tsx) ─────────
// Grounded in the real bulk-upload contract: question-parser.ts's primary column
// detection (questionText/difficulty/category/option1-6/correctOption) and the
// actual template at /templates/questions_template.csv — not aspirational.
// Works for both generating new questions from a topic and fixing an existing
// file already in the wrong format (e.g. isCorrect boolean columns).

function buildQuestionsAiPrompt(): string {
  return `I'm building a multiple-choice question bank for an online contest/quiz platform. Questions are uploaded as a CSV/Excel file with this exact header row and column order:

questionText,difficulty,category,option1,option2,option3,option4,correctOption

- questionText: the question itself, 5-2000 characters.
- difficulty: exactly one of EASY, MEDIUM, or HARD (case-insensitive).
- category: a single topic/tag for the question (e.g. "React", "SQL", "General Knowledge").
- option1..option4: the four answer choices, 1-500 characters each. You can add up to two more columns (option5, option6) if a question needs 5 or 6 choices — 2 is the minimum, 6 is the maximum.
- correctOption: the 1-based index of the correct answer among the options you provided for that row (e.g. 2 means option2 is correct). One number, not a boolean, and never more than one correct answer per question.

Two optional extra columns are also supported if wanted: hint (max 500 characters) and explanation (max 2000 characters) — add them as extra columns after correctOption, with those exact header names.

This prompt covers two different jobs — read both option blocks near the bottom, fill in ONLY the one that matches what I'm doing right now, and ignore the other:
- OPTION A — GENERATE NEW QUESTIONS FROM A TOPIC: I'll give you a topic and how many questions I want; write brand-new multiple-choice questions in the exact CSV format above.
- OPTION B — FIX AN EXISTING FILE: I'll paste my existing CSV/spreadsheet data below, in whatever format it's currently in; convert it to the exact CSV format above, correcting anything that doesn't match — wrong header names, separate per-option "isCorrect" boolean columns instead of a single correctOption index, wrong difficulty casing, etc. Keep the original question wording and answers intact, only fix the structure/format.

Rules that apply either way:
1. Output plain CSV text only — the header row exactly as shown, then one row per question, comma-separated, with any field containing a comma or quote wrapped in double quotes.
2. Every row needs exactly one correct answer marked via the correctOption index — never zero, never more than one.
3. Don't invent extra columns beyond questionText, difficulty, category, option1-6, correctOption, hint, explanation — anything else is ignored by the system.

--- FILL IN ONLY ONE OF THE TWO SECTIONS BELOW ---

OPTION A — Generate new questions:
[Topic, number of questions, difficulty mix, and any other requirements. Leave blank if using Option B instead.]

OPTION B — Fix an existing file:
[Paste your existing CSV/spreadsheet content here, including its header row. Leave blank if using Option A instead.]

Give me back the complete CSV file content only, ready to save as a .csv and upload as-is. If you were fixing an existing file, also include a short bullet list of exactly what was wrong and what you changed.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateQuestionPage() {
  const router = useRouter();
  const { createQuestionMutation, bulkCreateMutation } = useQuestions();
  const { tags: existingTags } = useQuestionTags();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const batchUpload = useBatchUpload();
  const isBulkSubmitting = batchUpload.status === 'running';
  const [isDragging, setIsDragging] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedAiPrompt, setCopiedAiPrompt] = useState(false);

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(buildQuestionsAiPrompt());
    setCopiedAiPrompt(true);
    toast.success('Prompt copied — paste it into ChatGPT, Claude, or any AI tool');
    setTimeout(() => setCopiedAiPrompt(false), 2000);
  };

  // Use existing tags from the backend, fallback to 'General' if empty
  const allCategories = existingTags.length > 0 ? existingTags : ['General'];
  const filteredCategories = allCategories.filter((c) =>
    c.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const [form, setForm] = useState<QuestionForm>({
    questionText: '',
    difficulty: 'MEDIUM',
    category: 'General',
    hint: '',
    explanation: '',
    options: [
      { id: '1', text: '', isCorrect: true },
      { id: '2', text: '', isCorrect: false },
      { id: '3', text: '', isCorrect: false },
      { id: '4', text: '', isCorrect: false },
    ],
  });

  // ── Option handlers ────────────────────────────────────────────────────────

  const handleAddOption = () => {
    if (form.options.length >= 6) return;
    setForm((f) => ({
      ...f,
      options: [...f.options, { id: Date.now().toString(), text: '', isCorrect: false }],
    }));
  };

  const handleRemoveOption = (id: string) => {
    if (form.options.length <= 2) return;
    setForm((f) => ({ ...f, options: f.options.filter((o) => o.id !== id) }));
  };

  const handleOptionChange = (id: string, text: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o) => (o.id === id ? { ...o, text } : o)),
    }));
  };

  const handleCorrectToggle = (id: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o) => ({ ...o, isCorrect: o.id === id })),
    }));
  };

  // ── Build backend payload ─────────────────────────────────────────────────

  const buildPayload = () => ({
    questionText: form.questionText.trim(),
    difficulty: form.difficulty,                        // already uppercase
    tags: form.category ? [form.category] : ['General'],
    hint: form.hint.trim() || undefined,
    explanation: form.explanation.trim() || undefined,
    options: form.options.map((o, idx) => ({
      text: o.text.trim(),
      isCorrect: o.isCorrect,
      position: idx,                                    // backend requires position
    })),
  });

  // ── Submit single question ────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.questionText.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (form.questionText.trim().length < 5) {
      toast.error('Question text must be at least 5 characters');
      return;
    }
    const hasCorrect = form.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      toast.error('Mark one option as the correct answer');
      return;
    }
    const emptyOptions = form.options.filter((o) => !o.text.trim());
    if (emptyOptions.length > 0) {
      toast.error('All option fields must be filled in');
      return;
    }

    setIsSubmitting(true);
    try {
      await createQuestionMutation.mutateAsync(buildPayload());
      toast.success('Question created successfully!');
      router.push('/org/questions');
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create question';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CSV / Excel File upload ────────────────────────────────────────────────
  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      const { questions, errors, warnings } = parseFile(arrayBuffer, file.name);
      setCsvErrors(errors);
      setCsvWarnings(warnings);
      setCsvPreview(questions);

      if (errors.length > 0) {
        toast.error('File parsed with validation errors.');
      } else if (warnings.length > 0) {
        toast.warning('File parsed with warnings. Extra rows were automatically skipped.');
      } else {
        toast.success(`Successfully parsed ${questions.length} questions.`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  }, []);

  // Bulk uploads are always sent in fixed-size batches (BULK_UPLOAD_BATCH_SIZE),
  // even when the file is small — this keeps the resume-on-failure behaviour
  // consistent regardless of how many questions were uploaded.
  //
  // NB: this takes `steps` as a parameter rather than reading `batchUpload.steps`
  // — the hook's return value here is a snapshot from the render that kicked the
  // upload off (before `start()` populated it), so reading it directly reports
  // 0 created/failed even though every batch actually succeeded.
  const finalizeBulkUpload = (steps: BatchStep[]) => {
    let created = 0;
    let failed = 0;
    steps.forEach((_, i) => {
      const r = batchUpload.getResult(i) as { created?: number; failed?: number } | undefined;
      created += r?.created ?? 0;
      failed += r?.failed ?? 0;
    });
    toast.success(`Bulk upload complete: ${created} created${failed ? `, ${failed} failed` : ''}`);
    setCsvPreview([]);
    setCsvErrors([]);
    setCsvWarnings([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    batchUpload.reset();
    router.push('/org/questions');
  };

  const handleBulkSubmit = async () => {
    if (csvPreview.length === 0) {
      toast.error('No valid questions to upload');
      return;
    }

    const batches = chunkArray(csvPreview, BULK_UPLOAD_BATCH_SIZE);
    const steps: BatchStep[] = batches.map((batch, i) => ({
      label: `Uploading batch ${i + 1} of ${batches.length} (${batch.length} question${batch.length === 1 ? '' : 's'})`,
      run: async () => {
        const res: any = await bulkCreateMutation.mutateAsync(batch);
        const data = res?.data;
        // The backend creates a batch in a single transaction — it's all-or-nothing,
        // so `created === 0` means this whole batch failed and should be retried.
        if (!data || data.created === 0) {
          throw new Error(data?.errors?.[0]?.reason ?? `Batch ${i + 1} failed to upload`);
        }
        return data;
      },
    }));

    const outcome = await batchUpload.start(steps);
    if (outcome.completed) finalizeBulkUpload(steps);
  };

  const handleResumeBulkUpload = async () => {
    const outcome = await batchUpload.resume();
    // Safe to read batchUpload.steps here — this closure comes from the render
    // triggered by the user clicking "Resume", by which point the hook's state
    // already reflects the in-progress steps array (unlike the initial submit).
    if (outcome.completed) finalizeBulkUpload(batchUpload.steps);
  };

  const handleCancelBulkUpload = () => {
    batchUpload.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/org/questions">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Create New Question</h1>
              <p className="text-sm text-muted-foreground">Add questions individually or via bulk upload</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showBulkUpload ? 'outline' : 'default'}
              onClick={() => setShowBulkUpload(false)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Single Question
            </Button>
            <Button
              variant={showBulkUpload ? 'default' : 'outline'}
              onClick={() => setShowBulkUpload(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {showBulkUpload ? (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Bulk Upload (CSV)</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>
                  Download the <a href="/templates/questions_template.csv" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CSV Template</a> to get started.
                </span>
                <button
                  type="button"
                  onClick={handleCopyAiPrompt}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  {copiedAiPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedAiPrompt ? 'Copied!' : 'Copy AI Prompt (to fix)'}
                </button>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[1.02] shadow-md shadow-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/10'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 ${
                  isDragging ? 'bg-primary/20 scale-110' : 'bg-primary/10'
                }`}>
                  <Upload className={`h-6 w-6 text-primary transition-transform duration-300 ${isDragging ? 'animate-bounce' : ''}`} />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                  {isDragging ? 'Drop your file here!' : 'Choose CSV, Excel or Sheets File'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  Drag and drop or click to browse (Max {BULK_UPLOAD_MAX_TOTAL} questions per file — uploaded in batches of {BULK_UPLOAD_BATCH_SIZE})
                </p>
              </div>

              {csvErrors.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm space-y-1 border border-destructive/20 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Validation Errors
                  </div>
                  {csvErrors.map((err, i) => (
                    <div key={i} className="pl-6 list-item list-disc">{err}</div>
                  ))}
                </div>
              )}

              {csvWarnings.length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm space-y-1 border border-yellow-500/20 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Validation Warnings
                  </div>
                  {csvWarnings.map((warn, i) => (
                    <div key={i} className="pl-6 list-item list-disc">{warn}</div>
                  ))}
                </div>
              )}

              {csvPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Preview ({csvPreview.length} questions)</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCsvPreview([]);
                        setCsvErrors([]);
                        setCsvWarnings([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 border-b">Question</th>
                          <th className="text-left p-2 border-b w-[100px]">Difficulty</th>
                          <th className="text-left p-2 border-b w-[100px]">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((q, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-secondary/50">
                            <td className="p-2 truncate max-w-[200px]">{q.questionText}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[10px]">
                                {q.difficulty}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {q.tags[0]}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {batchUpload.status === 'error' ? (
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                        <AlertCircle className="h-4 w-4" />
                        Batch {batchUpload.currentIndex + 1} of {batchUpload.steps.length} failed
                      </div>
                      <p className="text-sm text-muted-foreground">{batchUpload.error}</p>
                      {batchUpload.currentIndex > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Batches 1–{batchUpload.currentIndex} already uploaded and saved to your question bank — resuming only retries what&apos;s left, nothing will be duplicated.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCancelBulkUpload}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleResumeBulkUpload} className="gap-2">
                          <Upload className="h-4 w-4" />
                          Resume Upload
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={handleBulkSubmit}
                      className="w-full gap-2"
                      disabled={isBulkSubmitting || csvErrors.length > 0}
                    >
                      {isBulkSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Import {csvPreview.length} Questions
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Question Content</CardTitle>
                <CardDescription>Write your question and define its core properties.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question Text</label>
                  <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter your question here..."
                    value={form.questionText}
                    onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Difficulty</label>
                    <Select
                      value={form.difficulty}
                      onValueChange={(val: any) => setForm({ ...form, difficulty: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EASY">Easy</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HARD">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium">Category / Tag</label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. React, Math, GK"
                        value={categoryInput}
                        onChange={(e) => {
                          setCategoryInput(e.target.value);
                          setShowCategoryDropdown(true);
                          setForm({ ...form, category: e.target.value });
                        }}
                        onFocus={() => setShowCategoryDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                      />
                      {showCategoryDropdown && filteredCategories.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-md shadow-lg z-50 py-1 max-h-[200px] overflow-y-auto">
                          {filteredCategories.map((cat) => (
                            <div
                              key={cat}
                              className="px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                              onMouseDown={() => {
                                setForm({ ...form, category: cat });
                                setCategoryInput(cat);
                                setShowCategoryDropdown(false);
                              }}
                            >
                              {cat}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hint (Optional)</label>
                    <Input
                      placeholder="Give users a clue"
                      value={form.hint}
                      onChange={(e) => setForm({ ...form, hint: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Explanation (Optional)</label>
                    <Input
                      placeholder="Explain the correct answer"
                      value={form.explanation}
                      onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Options</CardTitle>
                  <CardDescription>Add at least 2 options and mark one as correct.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddOption} className="gap-2" disabled={form.options.length >= 6}>
                  <Plus className="h-4 w-4" />
                  Add Option
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.options.map((option, index) => (
                  <div key={option.id} className="flex gap-3">
                    <button
                      onClick={() => handleCorrectToggle(option.id)}
                      className={`h-10 w-10 flex items-center justify-center rounded-md border transition-all ${
                        option.isCorrect
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <CheckCircle2 className={`h-5 w-5 ${option.isCorrect ? 'scale-110' : 'scale-100 opacity-20'}`} />
                    </button>
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option.text}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(option.id)}
                      disabled={form.options.length <= 2}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={handleSave} size="lg" className="w-full gap-2 shadow-lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving Question...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Question
                </>
              )}
            </Button>
          </div>
        )}
      </main>

      <MultiStepLoader
        loadingStates={batchUpload.steps.map((s) => ({ text: s.label }))}
        loading={batchUpload.status === 'running'}
        value={batchUpload.currentIndex}
        errorIndex={batchUpload.status === 'error' ? batchUpload.currentIndex : null}
      />
    </div>
  );
}
