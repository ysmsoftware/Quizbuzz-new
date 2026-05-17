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
  Upload, FileText, X, AlertCircle, ChevronDown,
} from 'lucide-react';
import { useQuestions, useQuestionTags } from '@/lib/hooks/useQuestions';
import { toast } from 'sonner';

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


// ─── CSV Bulk Upload helpers ──────────────────────────────────────────────────

/**
 * Expected CSV format (header row required):
 * questionText,difficulty,category,option1,option2,option3,option4,correctOption
 *
 * correctOption = 1-based index of the correct option column.
 * difficulty    = EASY | MEDIUM | HARD  (case-insensitive)
 * example row:
 *   "What is JSX?",MEDIUM,React,file extension,syntax extension for JS,variable name,class name,2
 */
function parseCSV(text: string): { questions: any[]; errors: string[] } {
  const lines = text.trim().split('\n').filter(Boolean);
  const errors: string[] = [];
  const questions: any[] = [];

  if (lines.length < 2) {
    errors.push('CSV must have a header row and at least one data row.');
    return { questions, errors };
  }

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVRow(lines[i]);
    const [questionText, rawDifficulty, category, opt1, opt2, opt3, opt4, rawCorrect] = cols;

    if (!questionText || !rawDifficulty || !opt1 || !opt2 || !rawCorrect) {
      errors.push(`Row ${i + 1}: Missing required fields (questionText, difficulty, option1, option2, correctOption).`);
      continue;
    }

    const difficulty = rawDifficulty.trim().toUpperCase();
    if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      errors.push(`Row ${i + 1}: difficulty must be EASY, MEDIUM, or HARD. Got "${rawDifficulty}".`);
      continue;
    }

    const correctIdx = parseInt(rawCorrect.trim()) - 1; // 0-based
    const rawOptions = [opt1, opt2, opt3, opt4].filter(Boolean);
    if (correctIdx < 0 || correctIdx >= rawOptions.length) {
      errors.push(`Row ${i + 1}: correctOption (${rawCorrect.trim()}) out of range.`);
      continue;
    }

    const options = rawOptions.map((text, idx) => ({
      text: text.trim(),
      isCorrect: idx === correctIdx,
      position: idx,
    }));

    questions.push({
      questionText: questionText.trim(),
      difficulty,
      tags: category?.trim() ? [category.trim()] : ['General'],
      options,
    });
  }

  return { questions, errors };
}

/** Split a CSV row respecting quoted fields */
function splitCSVRow(row: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateQuestionPage() {
  const router = useRouter();
  const { createQuestionMutation, bulkCreateMutation } = useQuestions();
  const { tags: existingTags } = useQuestionTags();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      router.push('/admin/questions');
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create question';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CSV upload ────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { questions, errors } = parseCSV(text);
      setCsvErrors(errors);
      setCsvPreview(questions);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (csvPreview.length === 0) {
      toast.error('No valid questions to upload');
      return;
    }
    setIsBulkSubmitting(true);
    try {
      const result = await bulkCreateMutation.mutateAsync(csvPreview);
      const data = (result as any)?.data;
      toast.success(`Bulk upload complete: ${data?.created ?? csvPreview.length} created, ${data?.failed ?? 0} failed`);
      setCsvPreview([]);
      setCsvErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.push('/admin/questions');
    } catch (err: any) {
      toast.error(err?.message ?? 'Bulk upload failed');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/questions">
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
              <CardDescription>
                Download the <Link href="/templates/questions_template.csv" className="text-primary hover:underline">CSV Template</Link> to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Choose CSV File</h3>
                <p className="text-muted-foreground text-sm">
                  Drag and drop or click to browse (Max 100 questions per file)
                </p>
              </div>

              {csvErrors.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm space-y-1 border border-destructive/20">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Validation Errors
                  </div>
                  {csvErrors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              {csvPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Preview ({csvPreview.length} questions)</h3>
                    <Button variant="ghost" size="sm" onClick={() => setCsvPreview([])} className="text-muted-foreground">
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
    </div>
  );
}
