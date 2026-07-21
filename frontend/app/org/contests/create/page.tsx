'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
    Calendar,
    CheckCircle2,
    Clock,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePayout } from '@/lib/hooks/use-payout';
import { useToast } from '@/components/ui/use-toast';
import { useContests } from '@/lib/hooks/useContests';
import { Stepper } from '@/components/shared/Stepper';
import { Loader2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { uploadBanner } from '@/lib/api/contests.api';

const STEPS = [
    { id: 1, title: 'Basic Info', description: 'Title, description, details, topics, and rules' },
    { id: 2, title: 'Schedule & Limits', description: 'Date/time, duration, and participant cap' },
    { id: 3, title: 'Pricing & Prizes', description: 'Fees, prizes, and shuffle settings' },
];

interface PrizeBracket {
    rankFrom: number;
    rankTo: number;
    amount: number;
    currency: string;
    label: string;
    benefits: string[];
}

interface ContestForm {
    title: string;
    description: string;
    details: string;
    topics: string[];
    rules: string[];
    registrationDeadline: string;
    startTime: string;
    duration: string;
    maxParticipants: string;
    cutoffScore: string;
    showResultsAfter: string;
    paymentEnabled: boolean;
    paymentAmount: string;
    paymentCurrency: string;
    paymentDescription: string;
    prizes: PrizeBracket[];
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    proctoringEnabled: boolean;
    bannerImage?: string;
}

export default function CreateContestPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { createContestMutation } = useContests();
    const { isLoggedIn, meQuery } = useAuth();
    const payout = usePayout();

    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Tag inputs helper state
    const [topicInput, setTopicInput] = useState('');
    const [ruleInput, setRuleInput] = useState('');
    const [benefitInputs, setBenefitInputs] = useState<Record<number, string>>({});

    const [form, setForm] = useState<ContestForm>({
        title: '',
        description: '',
        details: '',
        topics: [],
        rules: [],
        registrationDeadline: '',
        startTime: '',
        duration: '90',
        maxParticipants: '',
        cutoffScore: '60',
        showResultsAfter: '24',
        paymentEnabled: false,
        paymentAmount: '',
        paymentCurrency: 'INR',
        paymentDescription: '',
        prizes: [],
        shuffleQuestions: true,
        shuffleOptions: false,
        proctoringEnabled: true,
        bannerImage: undefined,
    });

    // Helpers for registrationDeadline
    const deadlineDate = form.registrationDeadline ? new Date(form.registrationDeadline.split('T')[0] + 'T00:00:00') : undefined;
    const deadlineTime = form.registrationDeadline ? form.registrationDeadline.split('T')[1] || '12:00' : '12:00';

    const handleDeadlineDateChange = (date?: Date) => {
        if (date) {
            const dateStr = format(date, 'yyyy-MM-dd');
            setForm(prev => ({
                ...prev,
                registrationDeadline: `${dateStr}T${deadlineTime}`
            }));
        } else {
            setForm(prev => ({
                ...prev,
                registrationDeadline: ''
            }));
        }
        if (errors.registrationDeadline) {
            setErrors(prev => ({ ...prev, registrationDeadline: '' }));
        }
    };

    const handleDeadlineTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const timeStr = e.target.value;
        const datePart = form.registrationDeadline ? form.registrationDeadline.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
        setForm(prev => ({
            ...prev,
            registrationDeadline: `${datePart}T${timeStr}`
        }));
        if (errors.registrationDeadline) {
            setErrors(prev => ({ ...prev, registrationDeadline: '' }));
        }
    };

    // Helpers for startTime
    const startDate = form.startTime ? new Date(form.startTime.split('T')[0] + 'T00:00:00') : undefined;
    const startTimeVal = form.startTime ? form.startTime.split('T')[1] || '12:00' : '12:00';

    const handleStartDateChange = (date?: Date) => {
        if (date) {
            const dateStr = format(date, 'yyyy-MM-dd');
            setForm(prev => ({
                ...prev,
                startTime: `${dateStr}T${startTimeVal}`
            }));
        } else {
            setForm(prev => ({
                ...prev,
                startTime: ''
            }));
        }
        if (errors.startTime) {
            setErrors(prev => ({ ...prev, startTime: '' }));
        }
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const timeStr = e.target.value;
        const datePart = form.startTime ? form.startTime.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
        setForm(prev => ({
            ...prev,
            startTime: `${datePart}T${timeStr}`
        }));
        if (errors.startTime) {
            setErrors(prev => ({ ...prev, startTime: '' }));
        }
    };

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

    const [uploadingBanner, setUploadingBanner] = useState(false);

    const handleBannerSelect = async (file: File, preview: string) => {
        setUploadingBanner(true);
        try {
            const res = await uploadBanner({ fileData: preview, fileName: file.name });
            if (res.data) {
                setForm(prev => ({ ...prev, bannerImage: res.data.url }));
                toast({
                    title: "Success",
                    description: "Banner image uploaded successfully!",
                });
            }
        } catch (err: any) {
            toast({
                title: "Upload Failed",
                description: err?.message || "Failed to upload banner image.",
                variant: "destructive",
            });
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleBannerClear = () => {
        setForm(prev => ({ ...prev, bannerImage: undefined }));
    };

    // Topics helpers
    const handleAddTopic = () => {
        const value = topicInput.trim().replace(/,$/, '');
        if (value && !form.topics.includes(value)) {
            setForm(prev => ({ ...prev, topics: [...prev.topics, value] }));
        }
        setTopicInput('');
    };

    const handleTopicKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTopic();
        }
    };

    const handleRemoveTopic = (indexToRemove: number) => {
        setForm(prev => ({
            ...prev,
            topics: prev.topics.filter((_, idx) => idx !== indexToRemove),
        }));
    };

    // Rules helpers
    const handleAddRule = () => {
        const value = ruleInput.trim();
        if (value && !form.rules.includes(value)) {
            setForm(prev => ({ ...prev, rules: [...prev.rules, value] }));
        }
        setRuleInput('');
    };

    const handleRuleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddRule();
        }
    };

    const handleRemoveRule = (indexToRemove: number) => {
        setForm(prev => ({
            ...prev,
            rules: prev.rules.filter((_, idx) => idx !== indexToRemove),
        }));
    };

    // Prizes brackets helpers
    const handleAddPrizeBracket = () => {
        setForm(prev => ({
            ...prev,
            prizes: [
                ...prev.prizes,
                {
                    rankFrom: prev.prizes.length + 1,
                    rankTo: prev.prizes.length + 1,
                    amount: 0,
                    currency: 'INR',
                    label: '',
                    benefits: [],
                },
            ],
        }));
    };

    const handleRemovePrizeBracket = (indexToRemove: number) => {
        setForm(prev => ({
            ...prev,
            prizes: prev.prizes.filter((_, idx) => idx !== indexToRemove),
        }));
    };

    const handlePrizeFieldChange = (index: number, field: keyof PrizeBracket, value: any) => {
        setForm(prev => {
            const updatedPrizes = [...prev.prizes];
            updatedPrizes[index] = {
                ...updatedPrizes[index],
                [field]: value,
            };
            return { ...prev, prizes: updatedPrizes };
        });
    };

    const handleAddBenefit = (prizeIndex: number) => {
        const value = (benefitInputs[prizeIndex] || '').trim();
        if (!value) return;
        setForm(prev => {
            const updatedPrizes = [...prev.prizes];
            if (!updatedPrizes[prizeIndex].benefits.includes(value)) {
                updatedPrizes[prizeIndex] = {
                    ...updatedPrizes[prizeIndex],
                    benefits: [...updatedPrizes[prizeIndex].benefits, value],
                };
            }
            return { ...prev, prizes: updatedPrizes };
        });
        setBenefitInputs(prev => ({ ...prev, [prizeIndex]: '' }));
    };

    const handleRemoveBenefit = (prizeIndex: number, benefitIndex: number) => {
        setForm(prev => {
            const updatedPrizes = [...prev.prizes];
            updatedPrizes[prizeIndex] = {
                ...updatedPrizes[prizeIndex],
                benefits: updatedPrizes[prizeIndex].benefits.filter((_, idx) => idx !== benefitIndex),
            };
            return { ...prev, prizes: updatedPrizes };
        });
    };

    const validateStep = (): boolean => {
        const newErrors: Record<string, string> = {};
        const now = new Date();

        if (currentStep === 1) {
            if (!form.title.trim()) {
                newErrors.title = 'Title is required';
            } else if (form.title.length < 3 || form.title.length > 200) {
                newErrors.title = 'Title must be between 3 and 200 characters';
            }
        }

        if (currentStep === 2) {
            if (!form.registrationDeadline) {
                newErrors.registrationDeadline = 'Registration deadline is required';
            } else {
                const d = new Date(form.registrationDeadline);
                if (isNaN(d.getTime())) {
                    newErrors.registrationDeadline = 'Invalid date';
                } else if (d <= now) {
                    newErrors.registrationDeadline = 'Registration deadline must be in the future';
                }
            }

            if (!form.startTime) {
                newErrors.startTime = 'Start time is required';
            } else {
                const d = new Date(form.startTime);
                if (isNaN(d.getTime())) {
                    newErrors.startTime = 'Invalid date';
                } else if (d <= now) {
                    newErrors.startTime = 'Start time must be in the future';
                }
            }

            if (form.registrationDeadline && form.startTime) {
                const dReg = new Date(form.registrationDeadline);
                const dStart = new Date(form.startTime);
                if (dStart <= dReg) {
                    newErrors.startTime = 'Start time must be after the registration deadline';
                }
            }

            const duration = Number(form.duration);
            if (!form.duration || isNaN(duration) || duration < 10 || duration > 480) {
                newErrors.duration = 'Duration must be between 10 and 480 minutes';
            }

            if (form.maxParticipants) {
                const maxPart = Number(form.maxParticipants);
                if (isNaN(maxPart) || maxPart <= 0 || !Number.isInteger(maxPart)) {
                    newErrors.maxParticipants = 'Max participants must be a positive integer';
                }
            }

            if (form.cutoffScore) {
                const cutoff = Number(form.cutoffScore);
                if (isNaN(cutoff) || cutoff < 0 || cutoff > 100) {
                    newErrors.cutoffScore = 'Cutoff score must be between 0 and 100';
                }
            }

            if (form.showResultsAfter) {
                const showResults = Number(form.showResultsAfter);
                if (isNaN(showResults) || showResults < 0) {
                    newErrors.showResultsAfter = 'Must be a non-negative number';
                }
            }
        }

        if (currentStep === 3) {
            if (form.paymentEnabled) {
                const amount = Number(form.paymentAmount);
                if (!form.paymentAmount || isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
                    newErrors.paymentAmount = 'Amount must be a positive integer';
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
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
            const payload = {
                title: form.title,
                description: form.description || undefined,
                details: form.details || undefined,
                topics: form.topics,
                rules: form.rules,
                paymentEnabled: form.paymentEnabled,
                paymentConfig: form.paymentEnabled ? {
                    amount: Number(form.paymentAmount),
                    currency: form.paymentCurrency || 'INR',
                    description: form.paymentDescription || undefined,
                } : undefined,
                duration: Number(form.duration),
                cutoffScore: form.cutoffScore ? Number(form.cutoffScore) : undefined,
                maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined,
                registrationDeadline: new Date(form.registrationDeadline).toISOString(),
                startTime: new Date(form.startTime).toISOString(),
                shuffleQuestions: form.shuffleQuestions,
                shuffleOptions: form.shuffleOptions,
                proctoringEnabled: form.proctoringEnabled,
                showResultsAfter: Number(form.showResultsAfter) || 24,
                prizes: form.prizes.map(p => ({
                    rankFrom: Number(p.rankFrom),
                    rankTo: Number(p.rankTo),
                    amount: Number(p.amount),
                    currency: p.currency || 'INR',
                    label: p.label || undefined,
                    benefits: p.benefits,
                })),
                bannerImage: form.bannerImage || undefined,
            };

            const result = await createContestMutation.mutateAsync(payload);

            if (result.success) {
                const contestId = (result.data as any)?.id;
                toast({
                    title: "Success",
                    description: "Contest created successfully!",
                });
                router.push(`/org/contests/${contestId}/overview`);
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to create contest. Please try again.';
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <Link href="/org/contests" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back to Contests</span>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Create New Contest</h1>
                <div className="w-[120px]" />
            </div>

            <div className="mx-auto max-w-4xl space-y-8">
                {/* Progress Steps */}
                <Stepper steps={STEPS} currentStep={currentStep} onStepChange={setCurrentStep} />

                {/* Form Content */}
                <Card className="border-border/50 shadow-sm rounded-2xl">
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
                            <div className="space-y-5">
                                <div>
                                    <label className="text-sm font-semibold mb-1 block">Contest Title *</label>
                                    <Input
                                        name="title"
                                        placeholder="e.g., Java Advanced Programming Championship"
                                        value={form.title}
                                        onChange={handleChange}
                                        className={cn('transition-all', errors.title ? 'border-destructive focus-visible:ring-destructive' : '')}
                                    />
                                    {errors.title ? (
                                        <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.title}</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mt-1">Make it unique and self-explanatory.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-sm font-semibold mb-1 block">Contest Banner Image</label>
                                    <FileUpload
                                        onFileSelect={handleBannerSelect}
                                        onClear={handleBannerClear}
                                        preview={form.bannerImage}
                                        aspectRatio="banner"
                                        maxSizeMB={5}
                                        helperText="Recommended: 1200×400px · max 5 MB"
                                    />
                                    {uploadingBanner && (
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 animate-pulse">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                            Uploading banner image...
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-sm font-semibold mb-1 block">Short Description</label>
                                    <Textarea
                                        name="description"
                                        placeholder="A brief summary about the contest..."
                                        value={form.description}
                                        onChange={handleChange}
                                        rows={2}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold mb-1 block">Rich Text Details / Markdown</label>
                                    <Textarea
                                        name="details"
                                        placeholder="## About this Contest&#10;Describe instructions, syllabus, patterns, rules..."
                                        value={form.details}
                                        onChange={handleChange}
                                        className="font-mono"
                                        rows={6}
                                    />
                                </div>

                                {/* Topics / Tags Input */}
                                <div>
                                    <label className="text-sm font-semibold mb-1 block">Topics / Tags</label>
                                    <div className="flex gap-2 mb-2">
                                        <Input
                                            placeholder="Type a topic (e.g. Java, DBMS) and press Enter or comma"
                                            value={topicInput}
                                            onChange={(e) => setTopicInput(e.target.value)}
                                            onKeyDown={handleTopicKeyDown}
                                        />
                                        <Button type="button" variant="outline" onClick={handleAddTopic}>Add</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border rounded-md border-border/30 bg-muted/20">
                                        {form.topics.length === 0 ? (
                                            <span className="text-xs text-muted-foreground self-center px-1">No topics added yet.</span>
                                        ) : (
                                            form.topics.map((topic, index) => (
                                                <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1 py-0.5">
                                                    <span>{topic}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTopic(index)}
                                                        className="text-muted-foreground hover:text-foreground rounded-full"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Rules List Input */}
                                <div>
                                    <label className="text-sm font-semibold mb-1 block">Contest Rules</label>
                                    <div className="flex gap-2 mb-2">
                                        <Input
                                            placeholder="Type a rule (e.g. No tab switching) and press Enter"
                                            value={ruleInput}
                                            onChange={(e) => setRuleInput(e.target.value)}
                                            onKeyDown={handleRuleKeyDown}
                                        />
                                        <Button type="button" variant="outline" onClick={handleAddRule}>Add</Button>
                                    </div>
                                    <div className="border rounded-md border-border/30 bg-muted/20 p-3 space-y-2 min-h-[80px]">
                                        {form.rules.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No rules defined yet.</p>
                                        ) : (
                                            <ul className="list-decimal pl-5 space-y-1">
                                                {form.rules.map((rule, index) => (
                                                    <li key={index} className="text-sm text-foreground">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span>{rule}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveRule(index)}
                                                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Schedule & Limits */}
                        {currentStep === 2 && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold mb-1 block">Registration Deadline *</label>
                                        <div className="flex gap-2 w-full">
                                            <div className="flex-1">
                                                <DatePicker
                                                    value={deadlineDate}
                                                    onChange={handleDeadlineDateChange}
                                                    className={cn('w-full', errors.registrationDeadline ? 'border-destructive' : '')}
                                                />
                                            </div>
                                            <div className="w-[110px] shrink-0">
                                                <Input
                                                    type="time"
                                                    value={deadlineTime}
                                                    onChange={handleDeadlineTimeChange}
                                                    className={cn('w-full h-9 text-xs', errors.registrationDeadline ? 'border-destructive' : '')}
                                                />
                                            </div>
                                        </div>
                                        {errors.registrationDeadline && (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.registrationDeadline}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold mb-1 block">Contest Start Time *</label>
                                        <div className="flex gap-2 w-full">
                                            <div className="flex-1">
                                                <DatePicker
                                                    value={startDate}
                                                    onChange={handleStartDateChange}
                                                    className={cn('w-full', errors.startTime ? 'border-destructive' : '')}
                                                />
                                            </div>
                                            <div className="w-[110px] shrink-0">
                                                <Input
                                                    type="time"
                                                    value={startTimeVal}
                                                    onChange={handleStartTimeChange}
                                                    className={cn('w-full h-9 text-xs', errors.startTime ? 'border-destructive' : '')}
                                                />
                                            </div>
                                        </div>
                                        {errors.startTime && (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.startTime}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold mb-1 block">Duration (minutes) *</label>
                                        <Input
                                            type="number"
                                            name="duration"
                                            value={form.duration}
                                            onChange={handleChange}
                                            placeholder="90"
                                            className={cn(errors.duration ? 'border-destructive' : '')}
                                        />
                                        {errors.duration ? (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.duration}</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground mt-1">Allowed range: 10 to 480 minutes (8 hours).</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold mb-1 block">Max Participants (Optional)</label>
                                        <Input
                                            type="number"
                                            name="maxParticipants"
                                            value={form.maxParticipants}
                                            onChange={handleChange}
                                            placeholder="e.g. 500"
                                            className={cn(errors.maxParticipants ? 'border-destructive' : '')}
                                        />
                                        {errors.maxParticipants && (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.maxParticipants}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold mb-1 block">Cutoff Score (% Optional)</label>
                                        <Input
                                            type="number"
                                            name="cutoffScore"
                                            value={form.cutoffScore}
                                            onChange={handleChange}
                                            placeholder="60"
                                            className={cn(errors.cutoffScore ? 'border-destructive' : '')}
                                        />
                                        {errors.cutoffScore && (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.cutoffScore}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold mb-1 block">Show Results After (Hours)</label>
                                        <Input
                                            type="number"
                                            name="showResultsAfter"
                                            value={form.showResultsAfter}
                                            onChange={handleChange}
                                            placeholder="24"
                                            className={cn(errors.showResultsAfter ? 'border-destructive' : '')}
                                        />
                                        {errors.showResultsAfter && (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.showResultsAfter}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Pricing & Prizes (combined) */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                {!payout.isActive && (
                                    <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        <AlertDescription className="flex items-center justify-between text-xs font-medium w-full">
                                            <span>Set up payouts before enabling paid registration for your contests.</span>
                                            <Link href="/org/settings?tab=payouts" className="underline font-bold hover:text-amber-700 dark:hover:text-amber-100 shrink-0 ml-2">
                                                Configure Payouts
                                            </Link>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Switch for pricing */}
                                <div className="flex items-center justify-between p-4 border border-border/50 rounded-2xl bg-muted/10">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-semibold">Enable Paid Registration</label>
                                        <p className="text-xs text-muted-foreground">Charge participants an entry fee to register.</p>
                                    </div>
                                    <Switch
                                        checked={form.paymentEnabled && payout.isActive}
                                        disabled={!payout.isActive}
                                        onCheckedChange={(checked) =>
                                            setForm(prev => ({ ...prev, paymentEnabled: checked }))
                                        }
                                    />
                                </div>

                                {/* Paid Details Fields */}
                                {form.paymentEnabled && (
                                    <div className="p-4 border border-border/50 rounded-2xl bg-card space-y-4">
                                        <h3 className="text-sm font-semibold">Payment Configurations</h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold mb-1 block">Fee Amount (₹) *</label>
                                                <Input
                                                    type="number"
                                                    name="paymentAmount"
                                                    value={form.paymentAmount}
                                                    onChange={handleChange}
                                                    placeholder="199"
                                                    className={cn(errors.paymentAmount ? 'border-destructive' : '')}
                                                />
                                                {errors.paymentAmount && (
                                                    <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.paymentAmount}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold mb-1 block">Currency</label>
                                                <Select
                                                    value={form.paymentCurrency}
                                                    onValueChange={(val) => handleSelectChange('paymentCurrency', val)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold mb-1 block">Payment Description (Optional)</label>
                                            <Input
                                                name="paymentDescription"
                                                value={form.paymentDescription}
                                                onChange={handleChange}
                                                placeholder="Entry fee for DSA Championship"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Prizes Sections */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold">Prize Brackets</h3>
                                            <p className="text-xs text-muted-foreground">Define ranks and awards for winners.</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddPrizeBracket}
                                            className="gap-1"
                                        >
                                            <Plus className="h-4 w-4" /> Add Bracket
                                        </Button>
                                    </div>

                                    {form.prizes.length === 0 ? (
                                        <div className="text-center py-6 border-2 border-dashed border-border/50 rounded-2xl text-muted-foreground text-xs">
                                            No prize brackets defined yet. Add brackets if you want to reward winners.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {form.prizes.map((prize, idx) => (
                                                <Card key={idx} className="border-border/60 bg-muted/5 relative rounded-2xl overflow-hidden transition-all hover:border-primary/30">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePrizeBracket(idx)}
                                                        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <CardHeader className="pb-3 pr-10">
                                                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                            Prize Bracket #{idx + 1}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Label (e.g. Gold, Winner)</label>
                                                                <Input
                                                                    value={prize.label}
                                                                    onChange={(e) => handlePrizeFieldChange(idx, 'label', e.target.value)}
                                                                    placeholder="Gold Winner"
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Rank From *</label>
                                                                    <Input
                                                                        type="number"
                                                                        value={prize.rankFrom}
                                                                        onChange={(e) => handlePrizeFieldChange(idx, 'rankFrom', Number(e.target.value))}
                                                                        className="h-8 text-xs"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Rank To *</label>
                                                                    <Input
                                                                        type="number"
                                                                        value={prize.rankTo}
                                                                        onChange={(e) => handlePrizeFieldChange(idx, 'rankTo', Number(e.target.value))}
                                                                        className="h-8 text-xs"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Prize Amount</label>
                                                                <Input
                                                                    type="number"
                                                                    value={prize.amount}
                                                                    onChange={(e) => handlePrizeFieldChange(idx, 'amount', Number(e.target.value))}
                                                                    placeholder="5000"
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-semibold mb-1 block text-muted-foreground">Currency</label>
                                                                <Select
                                                                    value={prize.currency}
                                                                    onValueChange={(val) => handlePrizeFieldChange(idx, 'currency', val)}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        {/* Prize Benefits */}
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-semibold block text-muted-foreground">Benefits / Perks</label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    value={benefitInputs[idx] || ''}
                                                                    onChange={(e) =>
                                                                        setBenefitInputs(prev => ({ ...prev, [idx]: e.target.value }))
                                                                    }
                                                                    placeholder="e.g. Intern Opportunity, Trophy"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            handleAddBenefit(idx);
                                                                        }
                                                                    }}
                                                                    className="h-8 text-xs"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 text-xs"
                                                                    onClick={() => handleAddBenefit(idx)}
                                                                >
                                                                    Add
                                                                </Button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {prize.benefits.map((benefit, benefitIdx) => (
                                                                    <Badge
                                                                        key={benefitIdx}
                                                                        variant="outline"
                                                                        className="text-[10px] bg-background flex items-center gap-1 pr-1 py-0.5"
                                                                    >
                                                                        <span>{benefit}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveBenefit(idx, benefitIdx)}
                                                                            className="text-muted-foreground hover:text-destructive rounded-full"
                                                                        >
                                                                            <X className="h-2 w-2" />
                                                                        </button>
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Shuffling Options */}
                                <div className="border border-border/50 rounded-2xl p-4 bg-muted/10 space-y-3">
                                    <h3 className="text-sm font-semibold">Quiz Settings</h3>

                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="shuffleQuestions"
                                            checked={form.shuffleQuestions}
                                            onCheckedChange={(checked) =>
                                                setForm(prev => ({ ...prev, shuffleQuestions: !!checked }))
                                            }
                                        />
                                        <label htmlFor="shuffleQuestions" className="text-sm font-medium cursor-pointer">
                                            Shuffle questions for each participant (Default: true)
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id="shuffleOptions"
                                            checked={form.shuffleOptions}
                                            onCheckedChange={(checked) =>
                                                setForm(prev => ({ ...prev, shuffleOptions: !!checked }))
                                            }
                                        />
                                        <label htmlFor="shuffleOptions" className="text-sm font-medium cursor-pointer">
                                            Shuffle options for each participant (Default: false)
                                        </label>
                                    </div>
                                </div>

                                {/* Proctoring Toggle */}
                                <div className="flex items-center justify-between rounded-2xl border border-border/50 p-4">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-semibold">Enable Proctoring</label>
                                        <p className="text-xs text-muted-foreground">
                                            When enabled, participants must allow camera access and will be
                                            monitored for face detection, tab switching, and audio anomalies.
                                            Disable for load testing or low-stakes contests.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={form.proctoringEnabled}
                                        onCheckedChange={(checked) =>
                                            setForm(prev => ({ ...prev, proctoringEnabled: checked }))
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between gap-4">
                    <Button
                        variant="outline"
                        className="rounded-xl h-11 border-border/50"
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
                            className="rounded-xl h-11 gap-2 shadow-lg shadow-primary/20"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Creating...' : 'Create Contest'}
                        </Button>
                    ) : (
                        <Button className="rounded-xl h-11" onClick={handleNext}>
                            Next
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}