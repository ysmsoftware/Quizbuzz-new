'use client';

import { useState, useEffect } from 'react';
import { Contest } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface EditContestDetailsModalProps {
  contest: Contest;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (updates: Partial<Contest>) => Promise<void>;
}

export function EditContestDetailsModal({
  contest,
  isOpen,
  onOpenChange,
  onSave,
}: EditContestDetailsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [topicInput, setTopicInput] = useState('');

  const formatToLocalDatetime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState<any>({
    title: '',
    description: '',
    details: '',
    topics: [],
    rules: [],
    registrationDeadline: '',
    startTime: '',
    durationMinutes: 90,
    maxParticipants: '',
    cutoffScore: 60,
    showResultsAfter: 24,
    shuffleQuestions: true,
    shuffleOptions: false,
    proctoringEnabled: true,
    defaultQuestionMarks: 1,
    defaultQuestionNegativeMark: 0.5,
  });

  // Pre-populate data whenever modal is opened
  useEffect(() => {
    if (isOpen && contest) {
      setFormData({
        title: contest.title || '',
        description: contest.description || '',
        details: (contest as any).details || '',
        topics: contest.tags || [],
        rules: contest.rules || [],
        registrationDeadline: formatToLocalDatetime(contest.registrationDeadline),
        startTime: formatToLocalDatetime(contest.startTime),
        durationMinutes: contest.durationMinutes || 90,
        maxParticipants: contest.maxParticipants || '',
        cutoffScore: contest.cutoffScore !== undefined && contest.cutoffScore !== null ? contest.cutoffScore : 60,
        showResultsAfter: contest.showResultsAfter !== undefined && contest.showResultsAfter !== null ? contest.showResultsAfter : 24,
        shuffleQuestions: contest.shuffleQuestions ?? true,
        shuffleOptions: contest.shuffleOptions ?? false,
        proctoringEnabled: contest.proctoringEnabled ?? true,
        defaultQuestionMarks: contest.defaultQuestionMarks ?? 1,
        defaultQuestionNegativeMark: contest.defaultQuestionNegativeMark ?? 0.5,
      });
      setTopicInput('');
      setActiveTab('general');
    }
  }, [isOpen, contest]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Topics helpers
  const handleAddTopic = () => {
    const val = topicInput.trim().replace(/,$/, '');
    if (val && !formData.topics.includes(val)) {
      handleInputChange('topics', [...formData.topics, val]);
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
    handleInputChange(
      'topics',
      formData.topics.filter((_: any, idx: number) => idx !== indexToRemove)
    );
  };

  const isDraft = contest.serverStatus === 'DRAFT';

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Validation
      if (!formData.title?.trim()) {
        toast.error('Contest title is required');
        return;
      }

      if (formData.cutoffScore !== undefined && (formData.cutoffScore < 0 || formData.cutoffScore > 100)) {
        toast.error('Passing cutoff score must be between 0 and 100%');
        return;
      }

      if (formData.durationMinutes !== undefined && formData.durationMinutes < 10) {
        toast.error('Duration must be at least 10 minutes');
        return;
      }

      if (formData.defaultQuestionMarks !== undefined && Number(formData.defaultQuestionMarks) <= 0) {
        toast.error('Default Marks must be greater than 0');
        return;
      }

      if (formData.defaultQuestionNegativeMark !== undefined && Number(formData.defaultQuestionNegativeMark) < 0) {
        toast.error('Default Negative Mark penalty cannot be negative');
        return;
      }

      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        details: formData.details.trim() || null,
        topics: formData.topics,
        shuffleQuestions: formData.shuffleQuestions,
        shuffleOptions: formData.shuffleOptions,
        proctoringEnabled: formData.proctoringEnabled,
        defaultQuestionMarks: Number(formData.defaultQuestionMarks),
        defaultQuestionNegativeMark: Number(formData.defaultQuestionNegativeMark),
        maxParticipants: formData.maxParticipants ? Number(formData.maxParticipants) : null,
        cutoffScore: Number(formData.cutoffScore),
        showResultsAfter: Number(formData.showResultsAfter),
      };

      // Timing fields are editable only in Draft phase
      if (isDraft) {
        if (!formData.startTime) {
          toast.error('Start time is required');
          return;
        }
        if (!formData.registrationDeadline) {
          toast.error('Registration deadline is required');
          return;
        }

        const start = new Date(formData.startTime);
        const deadline = new Date(formData.registrationDeadline);

        if (start < deadline) {
          toast.error('Contest start time must be at or after the registration deadline');
          return;
        }

        payload.startTime = start.toISOString();
        payload.registrationDeadline = deadline.toISOString();
        payload.duration = Number(formData.durationMinutes);
        payload.durationMinutes = Number(formData.durationMinutes);
      }

      if (onSave) {
        await onSave(payload);
      }

      toast.success('Contest details updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving contest details:', error);
      toast.error(error?.message || 'Failed to save contest details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSaving) {
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Edit Contest Details</DialogTitle>
          <DialogDescription>
            Update contest properties and configurations. Timings and settings are subject to phase constraints.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="scoring">Settings</TabsTrigger>
            </TabsList>

            {/* General Info */}
            <TabsContent value="general" className="space-y-4 outline-none">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Contest Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter contest title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Short Summary</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Short summary for cards and search listings"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="details" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Full Details (Markdown / Text)</Label>
                <Textarea
                  id="details"
                  value={formData.details}
                  onChange={(e) => handleInputChange('details', e.target.value)}
                  placeholder="Contest description, detailed syllabus, instructions..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Topics</Label>
                <div className="flex flex-wrap gap-2 p-2 border border-input bg-background rounded-md min-h-[40px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  {formData.topics?.map((topic: string, index: number) => (
                    <span key={index} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2.5 py-1 rounded-full">
                      {topic}
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(index)}
                        className="text-muted-foreground hover:text-foreground font-bold text-xs"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  <input
                    placeholder="Type topic and press Enter or comma..."
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={handleTopicKeyDown}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Schedule & Constraints */}
            <TabsContent value="schedule" className="space-y-4 outline-none">
              {!isDraft && (
                <div className="flex gap-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 mb-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Timings are locked.</span> Because this contest is already published, start times and deadlines cannot be updated directly via details. Please use the <span className="font-semibold">Reschedule Contest</span> option on the overview screen instead.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Start Date & Time</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    disabled={!isDraft}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationDeadline" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Registration Deadline</Label>
                  <Input
                    id="registrationDeadline"
                    type="datetime-local"
                    value={formData.registrationDeadline}
                    disabled={!isDraft}
                    onChange={(e) => handleInputChange('registrationDeadline', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="durationMinutes" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Duration (Mins)</Label>
                  <Input
                    id="durationMinutes"
                    type="number"
                    min={10}
                    value={formData.durationMinutes}
                    disabled={!isDraft}
                    onChange={(e) => handleInputChange('durationMinutes', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxParticipants" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    min={0}
                    value={formData.maxParticipants}
                    onChange={(e) => handleInputChange('maxParticipants', e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="Unlimited"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cutoffScore" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Cutoff Score (%)</Label>
                  <Input
                    id="cutoffScore"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.cutoffScore}
                    onChange={(e) => handleInputChange('cutoffScore', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="showResultsAfter" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Publish Results Delay (Hours after end)</Label>
                <Input
                  id="showResultsAfter"
                  type="number"
                  min={0}
                  value={formData.showResultsAfter}
                  onChange={(e) => handleInputChange('showResultsAfter', parseInt(e.target.value) || 0)}
                />
              </div>
            </TabsContent>

            {/* Scoring Defaults & Proctoring */}
            <TabsContent value="scoring" className="space-y-4 outline-none">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultQuestionMarks" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Default Marks Per Question</Label>
                  <Input
                    id="defaultQuestionMarks"
                    type="number"
                    min={1}
                    value={formData.defaultQuestionMarks}
                    onChange={(e) => handleInputChange('defaultQuestionMarks', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultQuestionNegativeMark" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Default Negative Mark</Label>
                  <Input
                    id="defaultQuestionNegativeMark"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.defaultQuestionNegativeMark}
                    onChange={(e) => handleInputChange('defaultQuestionNegativeMark', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                <h4 className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quiz Controls</h4>
                
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <Label htmlFor="shuffleQuestions" className="font-medium text-sm">Shuffle Questions</Label>
                    <p className="text-[11px] text-muted-foreground">Randomize question order for each participant attempt.</p>
                  </div>
                  <Switch
                    id="shuffleQuestions"
                    checked={formData.shuffleQuestions}
                    onCheckedChange={(checked) => handleInputChange('shuffleQuestions', checked)}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-border/40">
                  <div className="space-y-0.5">
                    <Label htmlFor="shuffleOptions" className="font-medium text-sm">Shuffle Options</Label>
                    <p className="text-[11px] text-muted-foreground">Randomize order of multiple choice choices.</p>
                  </div>
                  <Switch
                    id="shuffleOptions"
                    checked={formData.shuffleOptions}
                    onCheckedChange={(checked) => handleInputChange('shuffleOptions', checked)}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-border/40">
                  <div className="space-y-0.5">
                    <Label htmlFor="proctoringEnabled" className="font-medium text-sm">Enable AI Proctoring</Label>
                    <p className="text-[11px] text-muted-foreground">Monitor tab switching, browser exits, and integrity violations.</p>
                  </div>
                  <Switch
                    id="proctoringEnabled"
                    checked={formData.proctoringEnabled}
                    onCheckedChange={(checked) => handleInputChange('proctoringEnabled', checked)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 border-t border-border/40 gap-2 sm:gap-0 bg-muted/10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
