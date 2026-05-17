'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';

interface TopicDistribution {
  topic: string;
  percentage: number;
  easy: number;
  medium: number;
  hard: number;
}

const DEFAULT_TOPICS: TopicDistribution[] = [
  { topic: 'C Programming', percentage: 50, easy: 20, medium: 60, hard: 20 },
  { topic: 'Python Programming', percentage: 30, easy: 30, medium: 50, hard: 20 },
  { topic: 'Java Programming', percentage: 20, easy: 25, medium: 50, hard: 25 },
];

export default function QuestionSelector({ contestId, onBack }: { contestId: string; onBack: () => void }) {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicDistribution[]>(DEFAULT_TOPICS);
  const [selectedQuestions, setSelectedQuestions] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleTopicChange = (index: number, field: keyof TopicDistribution, value: number) => {
    const newTopics = [...topics];
    newTopics[index] = { ...newTopics[index], [field]: value };
    
    // Adjust percentages to sum to 100
    if (field === 'percentage') {
      const others = newTopics.filter((_, i) => i !== index);
      const otherTotal = others.reduce((sum, t) => sum + t.percentage, 0);
      if (otherTotal < 100) {
        const remaining = 100 - value;
        const newOthers = others.length > 0 ? remaining / others.length : 0;
        others.forEach((_, i) => {
          const actualIndex = i < index ? i : i + 1;
          newTopics[actualIndex].percentage = newOthers;
        });
      }
    }
    
    setTopics(newTopics);
  };

  const addTopic = () => {
    setTopics([...topics, { topic: 'New Topic', percentage: 0, easy: 33, medium: 34, hard: 33 }]);
  };

  const removeTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const calculateQuestions = () => {
    const total = topics.reduce((sum, t) => sum + Math.round(totalQuestions * t.percentage / 100), 0);
    setSelectedQuestions(total);
  };

  const handleApply = async () => {
    if (selectedQuestions === 0) {
      alert('Please select at least one question');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Store selected questions configuration
      const questionConfig = {
        contestId,
        source: 'database',
        totalQuestions: selectedQuestions,
        distribution: topics,
        createdAt: new Date().toISOString(),
      };

      const existing = JSON.parse(localStorage.getItem('questionConfigs') || '[]');
      localStorage.setItem('questionConfigs', JSON.stringify([...existing, questionConfig]));

      alert(`Successfully selected ${selectedQuestions} questions from database!`);
      router.push(`/admin/contests/${contestId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Select from Database</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure topic distribution and difficulty levels
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Total Questions Input */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Total Questions to Select</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              type="number"
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1"
              placeholder="Enter total number of questions"
            />
            <Button onClick={calculateQuestions}>Calculate</Button>
          </div>
          {selectedQuestions > 0 && (
            <div className="text-sm font-medium text-primary">
              {selectedQuestions} questions will be selected based on distribution below
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topics Distribution */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Topic Distribution</CardTitle>
              <CardDescription>Set percentage and difficulty distribution for each topic</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addTopic} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Topic
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topics.map((topic, index) => (
            <div key={index} className="space-y-4 p-4 rounded-lg border border-border/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Topic Name</label>
                  <Input
                    value={topic.topic}
                    onChange={(e) => handleTopicChange(index, 'topic', e.target.value as any)}
                    placeholder="e.g., C Programming"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Percentage (%)</label>
                  <Input
                    type="number"
                    value={topic.percentage}
                    onChange={(e) => handleTopicChange(index, 'percentage', parseInt(e.target.value) || 0)}
                    max={100}
                    min={0}
                    placeholder="0-100"
                  />
                </div>
              </div>

              {/* Difficulty Distribution for Topic */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty Distribution</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Easy (%)</label>
                    <Input
                      type="number"
                      value={topic.easy}
                      onChange={(e) => handleTopicChange(index, 'easy', parseInt(e.target.value) || 0)}
                      max={100}
                      min={0}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Medium (%)</label>
                    <Input
                      type="number"
                      value={topic.medium}
                      onChange={(e) => handleTopicChange(index, 'medium', parseInt(e.target.value) || 0)}
                      max={100}
                      min={0}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hard (%)</label>
                    <Input
                      type="number"
                      value={topic.hard}
                      onChange={(e) => handleTopicChange(index, 'hard', parseInt(e.target.value) || 0)}
                      max={100}
                      min={0}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Total: {topic.easy + topic.medium + topic.hard}% 
                  {topic.easy + topic.medium + topic.hard !== 100 && ' (should be 100%)'}
                </div>
              </div>

              {/* Questions for this topic */}
              {selectedQuestions > 0 && (
                <div className="text-sm p-2 rounded bg-secondary/20">
                  This topic will have ~<strong>{Math.round(selectedQuestions * topic.percentage / 100)}</strong> questions
                </div>
              )}

              {/* Remove button */}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeTopic(index)}
                className="w-full gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove Topic
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedQuestions > 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-5 w-5" />
              Selection Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {topics.map((topic, index) => {
                const topicCount = Math.round(selectedQuestions * topic.percentage / 100);
                return (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-green-700 dark:text-green-300">{topic.topic}</span>
                    <Badge variant="secondary">{topicCount} questions</Badge>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-green-200 dark:border-green-800 pt-3 mt-3 font-semibold text-green-800 dark:text-green-200">
              Total: {selectedQuestions} questions
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={selectedQuestions === 0 || loading}
          className="flex-1"
        >
          {loading ? 'Applying...' : `Apply ${selectedQuestions} Questions`}
        </Button>
      </div>
    </div>
  );
}
