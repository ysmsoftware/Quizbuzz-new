'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/hooks/useAuth';
import { useContests } from '@/lib/hooks/useContests';
import { useQuestionTags } from '@/lib/hooks/useQuestions';
import { useToast } from '@/components/ui/use-toast';
import { Stepper } from '@/components/shared/Stepper';
import { Loader2 } from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Contest title and details' },
  { id: 2, title: 'Timing', description: 'Dates and duration' },
  { id: 3, title: 'Questions', description: 'Questions and marks' },
  { id: 4, title: 'Settings', description: 'Proctoring & options' },
  { id: 5, title: 'Pricing', description: 'Registration fee' },
  { id: 6, title: 'Review', description: 'Final review' },
];

interface ContestForm {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  registrationStartDate: string;
  registrationEndDate: string;
  contestDate: string;
  contestStartTime: string;
  contestEndTime: string;
  durationMinutes: string;
  totalQuestions: string;
  totalMarks: string;
  passingMarks: string;
  negativeMarking: boolean;
  negativeMarkValue: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowBackNavigation: boolean;
  proctoringEnabled: boolean;
  fullscreenRequired: boolean;
  webcamRequired: boolean;
  registrationFee: string;
  maxParticipants: string;
}

export default function CreateContestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createContestMutation } = useContests();
  const { isLoggedIn, meQuery } = useAuth();
  const { tags } = useQuestionTags();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<ContestForm>({
    title: '',
    description: '',
    category: '',
    difficulty: 'medium',
    registrationStartDate: '',
    registrationEndDate: '',
    contestDate: '',
    contestStartTime: '',
    contestEndTime: '',
    durationMinutes: '120',
    totalQuestions: '50',
    totalMarks: '100',
    passingMarks: '40',
    negativeMarking: true,
    negativeMarkValue: '0.25',
    shuffleQuestions: true,
    shuffleOptions: true,
    allowBackNavigation: true,
    proctoringEnabled: true,
    fullscreenRequired: true,
    webcamRequired: true,
    registrationFee: '299',
    maxParticipants: '1000',
  });

  useEffect(() => {
    if (!meQuery.isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, meQuery.isLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, type, value } = e.currentTarget;
    const checked = (e.currentTarget as HTMLInputElement).checked;
    
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!form.title.trim()) newErrors.title = 'Title is required';
      if (!form.description.trim()) newErrors.description = 'Description is required';
      if (!form.category) newErrors.category = 'Category is required';
    }

    if (currentStep === 2) {
      if (!form.registrationStartDate) newErrors.registrationStartDate = 'Start date is required';
      if (!form.registrationEndDate) newErrors.registrationEndDate = 'End date is required';
      if (!form.contestDate) newErrors.contestDate = 'Contest date is required';
      if (!form.contestStartTime) newErrors.contestStartTime = 'Start time is required';
      if (!form.contestEndTime) newErrors.contestEndTime = 'End time is required';
    }

    if (currentStep === 3) {
      if (!form.totalQuestions) newErrors.totalQuestions = 'Number of questions is required';
      if (!form.totalMarks) newErrors.totalMarks = 'Total marks is required';
      if (!form.passingMarks) newErrors.passingMarks = 'Passing marks is required';
    }

    if (currentStep === 5) {
      if (!form.registrationFee) newErrors.registrationFee = 'Registration fee is required';
      if (!form.maxParticipants) newErrors.maxParticipants = 'Max participants is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateStep()) {
      setCurrentStep(Math.min(currentStep + 1, STEPS.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    try {
      // Map local form state to API payload
      const payload = {
        title: form.title,
        description: form.description,
        details: form.description, // Using same for now
        topics: [form.category],
        duration: parseInt(form.durationMinutes),
        maxParticipants: parseInt(form.maxParticipants),
        registrationDeadline: new Date(form.registrationEndDate + 'T' + '23:59:59').toISOString(),
        startTime: new Date(form.contestDate + 'T' + form.contestStartTime).toISOString(),
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        paymentEnabled: parseInt(form.registrationFee) > 0,
        paymentConfig: {
          amount: parseInt(form.registrationFee),
          currency: 'INR',
          description: `Entry fee for ${form.title}`
        },
        cutoffScore: (parseInt(form.passingMarks) / parseInt(form.totalMarks)) * 100
      };

      const result = await createContestMutation.mutateAsync(payload);
      
      if (result.success) {
        const contestId = (result.data as any)?.id;
        toast({
          title: "Success",
          description: "Contest created successfully!",
        });
        router.push(`/admin/contests/${contestId}?success=created`);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to create contest. Please try again.';
      setErrors({ submit: errorMessage });
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <Link href="/admin/contests" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Contests</span>
        </Link>
        <h1 className="text-3xl font-bold">Create New Contest</h1>
        <div className="w-[120px]" />
      </div>

      <div className="mx-auto max-w-4xl space-y-8">
        {/* Progress Steps */}
        <Stepper steps={STEPS} currentStep={currentStep} onStepChange={setCurrentStep} />

        {/* Form Content */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {errors.submit && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Contest Title *</label>
                  <Input
                    name="title"
                    placeholder="e.g., Java Advanced Programming"
                    value={form.title}
                    onChange={handleChange}
                    className={errors.title ? 'border-destructive' : ''}
                  />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium">Description *</label>
                  <textarea
                    name="description"
                    placeholder="Describe your contest..."
                    value={form.description}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md text-sm bg-background ${
                      errors.description ? 'border-destructive' : 'border-border/50'
                    }`}
                    rows={4}
                  />
                  {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Category *</label>
                    <Select value={form.category} onValueChange={(value) => handleSelectChange('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.length > 0 ? (
                          tags.map((tag) => (
                            <SelectItem key={tag} value={tag}>
                              {tag.charAt(0).toUpperCase() + tag.slice(1)}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="General">General</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Difficulty Level</label>
                    <Select value={form.difficulty} onValueChange={(value) => handleSelectChange('difficulty', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Timing */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Registration Start Date *</label>
                    <Input
                      type="date"
                      name="registrationStartDate"
                      value={form.registrationStartDate}
                      onChange={handleChange}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className={cn(
                        'cursor-pointer [appearance:none] [&::-webkit-calendar-picker-indicator]:cursor-pointer',
                        errors.registrationStartDate ? 'border-destructive' : ''
                      )}
                    />
                    {errors.registrationStartDate && <p className="text-xs text-destructive mt-1">{errors.registrationStartDate}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Registration End Date *</label>
                    <Input
                      type="date"
                      name="registrationEndDate"
                      value={form.registrationEndDate}
                      onChange={handleChange}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className={cn(
                        'cursor-pointer [appearance:none] [&::-webkit-calendar-picker-indicator]:cursor-pointer',
                        errors.registrationEndDate ? 'border-destructive' : ''
                      )}
                    />
                    {errors.registrationEndDate && <p className="text-xs text-destructive mt-1">{errors.registrationEndDate}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Contest Date *</label>
                  <Input
                    type="date"
                    name="contestDate"
                    value={form.contestDate}
                    onChange={handleChange}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className={cn(
                      'cursor-pointer [appearance:none] [&::-webkit-calendar-picker-indicator]:cursor-pointer',
                      errors.contestDate ? 'border-destructive' : ''
                    )}
                  />
                  {errors.contestDate && <p className="text-xs text-destructive mt-1">{errors.contestDate}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Start Time *</label>
                    <Input
                      type="time"
                      name="contestStartTime"
                      value={form.contestStartTime}
                      onChange={handleChange}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className={cn(
                        'cursor-pointer [appearance:none] [&::-webkit-calendar-picker-indicator]:cursor-pointer',
                        errors.contestStartTime ? 'border-destructive' : ''
                      )}
                    />
                    {errors.contestStartTime && <p className="text-xs text-destructive mt-1">{errors.contestStartTime}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium">End Time *</label>
                    <Input
                      type="time"
                      name="contestEndTime"
                      value={form.contestEndTime}
                      onChange={handleChange}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className={cn(
                        'cursor-pointer [appearance:none] [&::-webkit-calendar-picker-indicator]:cursor-pointer',
                        errors.contestEndTime ? 'border-destructive' : ''
                      )}
                    />
                    {errors.contestEndTime && <p className="text-xs text-destructive mt-1">{errors.contestEndTime}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Input
                    type="number"
                    name="durationMinutes"
                    value={form.durationMinutes}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Questions */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Total Questions *</label>
                    <Input
                      type="number"
                      name="totalQuestions"
                      value={form.totalQuestions}
                      onChange={handleChange}
                      className={errors.totalQuestions ? 'border-destructive' : ''}
                    />
                    {errors.totalQuestions && <p className="text-xs text-destructive mt-1">{errors.totalQuestions}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Total Marks *</label>
                    <Input
                      type="number"
                      name="totalMarks"
                      value={form.totalMarks}
                      onChange={handleChange}
                      className={errors.totalMarks ? 'border-destructive' : ''}
                    />
                    {errors.totalMarks && <p className="text-xs text-destructive mt-1">{errors.totalMarks}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Passing Marks *</label>
                    <Input
                      type="number"
                      name="passingMarks"
                      value={form.passingMarks}
                      onChange={handleChange}
                      className={errors.passingMarks ? 'border-destructive' : ''}
                    />
                    {errors.passingMarks && <p className="text-xs text-destructive mt-1">{errors.passingMarks}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Negative Mark Value</label>
                    <Input
                      type="number"
                      step="0.01"
                      name="negativeMarkValue"
                      value={form.negativeMarkValue}
                      onChange={handleChange}
                      disabled={!form.negativeMarking}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="negativeMarking"
                    name="negativeMarking"
                    checked={form.negativeMarking}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, negativeMarking: !!checked }))
                    }
                  />
                  <label htmlFor="negativeMarking" className="text-sm font-medium cursor-pointer">
                    Enable negative marking
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="shuffleQuestions"
                    name="shuffleQuestions"
                    checked={form.shuffleQuestions}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, shuffleQuestions: !!checked }))
                    }
                  />
                  <label htmlFor="shuffleQuestions" className="text-sm font-medium cursor-pointer">
                    Shuffle questions for each participant
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="shuffleOptions"
                    name="shuffleOptions"
                    checked={form.shuffleOptions}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, shuffleOptions: !!checked }))
                    }
                  />
                  <label htmlFor="shuffleOptions" className="text-sm font-medium cursor-pointer">
                    Shuffle options for each participant
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="allowBackNavigation"
                    name="allowBackNavigation"
                    checked={form.allowBackNavigation}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, allowBackNavigation: !!checked }))
                    }
                  />
                  <label htmlFor="allowBackNavigation" className="text-sm font-medium cursor-pointer">
                    Allow backward navigation
                  </label>
                </div>
              </div>
            )}

            {/* Step 4: Settings */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Proctoring Settings</p>
                  <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                    Enable AI-powered monitoring to prevent cheating
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="proctoringEnabled"
                    name="proctoringEnabled"
                    checked={form.proctoringEnabled}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, proctoringEnabled: !!checked }))
                    }
                  />
                  <label htmlFor="proctoringEnabled" className="text-sm font-medium cursor-pointer">
                    Enable AI Proctoring
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="fullscreenRequired"
                    name="fullscreenRequired"
                    checked={form.fullscreenRequired}
                    disabled={!form.proctoringEnabled}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, fullscreenRequired: !!checked }))
                    }
                  />
                  <label htmlFor="fullscreenRequired" className="text-sm font-medium cursor-pointer">
                    Require fullscreen mode
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="webcamRequired"
                    name="webcamRequired"
                    checked={form.webcamRequired}
                    disabled={!form.proctoringEnabled}
                    onCheckedChange={(checked) =>
                      setForm(prev => ({ ...prev, webcamRequired: !!checked }))
                    }
                  />
                  <label htmlFor="webcamRequired" className="text-sm font-medium cursor-pointer">
                    Require webcam access
                  </label>
                </div>
              </div>
            )}

            {/* Step 5: Pricing */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Registration Fee (₹) *</label>
                  <Input
                    type="number"
                    name="registrationFee"
                    value={form.registrationFee}
                    onChange={handleChange}
                    className={errors.registrationFee ? 'border-destructive' : ''}
                  />
                  {errors.registrationFee && <p className="text-xs text-destructive mt-1">{errors.registrationFee}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium">Max Participants *</label>
                  <Input
                    type="number"
                    name="maxParticipants"
                    value={form.maxParticipants}
                    onChange={handleChange}
                    className={errors.maxParticipants ? 'border-destructive' : ''}
                  />
                  {errors.maxParticipants && <p className="text-xs text-destructive mt-1">{errors.maxParticipants}</p>}
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-200">✓ Ready to publish</p>
                  <p className="text-xs text-green-800 dark:text-green-300 mt-1">
                    Review the details below and click Create to publish your contest
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Basic Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Title</p>
                        <p className="font-medium">{form.title}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{form.category}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Timing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium">{form.contestDate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium">{form.durationMinutes} minutes</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Questions & Marks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Questions</p>
                        <p className="font-medium">{form.totalQuestions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Marks</p>
                        <p className="font-medium">{form.totalMarks}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Pricing</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Fee</p>
                        <p className="font-medium">₹{form.registrationFee}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Max Participants</p>
                        <p className="font-medium">{form.maxParticipants}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </div>

          {currentStep === STEPS.length ? (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Creating...' : 'Create Contest'}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
