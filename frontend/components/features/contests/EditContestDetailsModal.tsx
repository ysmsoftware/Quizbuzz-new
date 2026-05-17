'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
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
  const [formData, setFormData] = useState<Partial<Contest>>({
    title: contest.title,
    shortDescription: contest.shortDescription,
    description: contest.description,
    topic: contest.topic,
    category: contest.category,
    difficulty: contest.difficulty,
    fee: contest.fee,
    totalMarks: contest.totalMarks,
    passingMarks: contest.passingMarks,
    negativeMarking: contest.negativeMarking,
    negativeMarkValue: contest.negativeMarkValue,
    shuffleQuestions: contest.shuffleQuestions,
    shuffleOptions: contest.shuffleOptions,
    allowBackNavigation: contest.allowBackNavigation,
    tabSwitchLimit: contest.tabSwitchLimit,
  });

  const handleInputChange = (
    field: keyof typeof formData,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Validate required fields
      if (!formData.title?.trim()) {
        toast.error('Contest title is required');
        return;
      }

      if (!formData.shortDescription?.trim()) {
        toast.error('Short description is required');
        return;
      }

      if (formData.totalMarks === undefined || formData.totalMarks <= 0) {
        toast.error('Total marks must be greater than 0');
        return;
      }

      if (formData.passingMarks === undefined || formData.passingMarks < 0) {
        toast.error('Passing marks cannot be negative');
        return;
      }

      if (formData.passingMarks! > formData.totalMarks!) {
        toast.error('Passing marks cannot exceed total marks');
        return;
      }

      if (onSave) {
        await onSave(formData);
      }

      toast.success('Contest details updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving contest details:', error);
      toast.error('Failed to save contest details');
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contest Details</DialogTitle>
          <DialogDescription>
            Update the contest information. Some fields may be restricted based on the current phase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Contest Title</Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter contest title"
            />
          </div>

          {/* Short Description */}
          <div className="space-y-2">
            <Label htmlFor="shortDescription">Short Description</Label>
            <Textarea
              id="shortDescription"
              value={formData.shortDescription || ''}
              onChange={(e) => handleInputChange('shortDescription', e.target.value)}
              placeholder="Brief description for listings"
              rows={2}
            />
          </div>

          {/* Full Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Full Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Detailed contest description"
              rows={3}
            />
          </div>

          {/* Topic & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={formData.topic || ''}
                onChange={(e) => handleInputChange('topic', e.target.value)}
                placeholder="e.g., Java, Python"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category || ''}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="e.g., Programming"
              />
            </div>
          </div>

          {/* Difficulty & Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={formData.difficulty || ''} onValueChange={(value) => handleInputChange('difficulty', value)}>
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee">Registration Fee (₹)</Label>
              <Input
                id="fee"
                type="number"
                value={formData.fee || 0}
                onChange={(e) => handleInputChange('fee', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Marks Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalMarks">Total Marks</Label>
              <Input
                id="totalMarks"
                type="number"
                value={formData.totalMarks || ''}
                onChange={(e) => handleInputChange('totalMarks', parseInt(e.target.value) || 0)}
                placeholder="100"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passingMarks">Passing Marks</Label>
              <Input
                id="passingMarks"
                type="number"
                value={formData.passingMarks || ''}
                onChange={(e) => handleInputChange('passingMarks', parseInt(e.target.value) || 0)}
                placeholder="40"
                min="0"
              />
            </div>
          </div>

          {/* Negative Marking */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="negativeMarking">Enable Negative Marking</Label>
              <input
                id="negativeMarking"
                type="checkbox"
                checked={formData.negativeMarking || false}
                onChange={(e) => handleInputChange('negativeMarking', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
            {formData.negativeMarking && (
              <div className="space-y-2">
                <Label htmlFor="negativeMarkValue">Negative Mark per Wrong Answer</Label>
                <Input
                  id="negativeMarkValue"
                  type="number"
                  value={formData.negativeMarkValue || 0}
                  onChange={(e) => handleInputChange('negativeMarkValue', parseFloat(e.target.value) || 0)}
                  placeholder="0.25"
                  min="0"
                  step="0.25"
                />
              </div>
            )}
          </div>

          {/* Quiz Options */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="shuffleQuestions">Shuffle Questions</Label>
              <input
                id="shuffleQuestions"
                type="checkbox"
                checked={formData.shuffleQuestions || false}
                onChange={(e) => handleInputChange('shuffleQuestions', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shuffleOptions">Shuffle Options</Label>
              <input
                id="shuffleOptions"
                type="checkbox"
                checked={formData.shuffleOptions || false}
                onChange={(e) => handleInputChange('shuffleOptions', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="allowBackNavigation">Allow Back Navigation</Label>
              <input
                id="allowBackNavigation"
                type="checkbox"
                checked={formData.allowBackNavigation || false}
                onChange={(e) => handleInputChange('allowBackNavigation', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
          </div>

          {/* Tab Switch Limit */}
          <div className="space-y-2">
            <Label htmlFor="tabSwitchLimit">Tab Switch Limit (0 = Unlimited)</Label>
            <Input
              id="tabSwitchLimit"
              type="number"
              value={formData.tabSwitchLimit || 0}
              onChange={(e) => handleInputChange('tabSwitchLimit', parseInt(e.target.value) || 0)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
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
