'use client';

import { useState } from 'react';
import { Plus, Check, Trash2, GripVertical, Sparkles, BookOpen, Layers } from 'lucide-react';

export function QuestionBuilderSection() {
  const [questions, setQuestions] = useState([
    {
      id: 1,
      num: 18,
      category: 'Computer Science',
      question: 'What is the tightest worst-case time complexity of searching in an AVL balanced binary search tree with n elements?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correctIndex: 1,
      difficulty: 'Medium',
      points: 20,
    },
    {
      id: 2,
      num: 19,
      category: 'Logical Reasoning',
      question: 'Which graph traversal algorithm guarantees finding the shortest path in an unweighted graph?',
      options: ['Depth First Search (DFS)', 'Breadth First Search (BFS)', 'Topological Sort', 'Kruskal Algorithm'],
      correctIndex: 1,
      difficulty: 'Easy',
      points: 15,
    },
    {
      id: 3,
      num: 20,
      category: 'Mathematics',
      question: 'In a group of 50 engineers, 30 know Python, 25 know Rust, and 12 know both. How many know neither?',
      options: ['5 engineers', '7 engineers', '8 engineers', '12 engineers'],
      correctIndex: 1,
      difficulty: 'Medium',
      points: 20,
    },
    {
      id: 4,
      num: 21,
      category: 'General Aptitude',
      question: 'A train 150m long crosses a platform in 30 seconds at 54 km/h. What is the length of the platform?',
      options: ['150m', '250m', '300m', '450m'],
      correctIndex: 1,
      difficulty: 'Medium',
      points: 20,
    },
  ]);

  const [activeCategory, setActiveCategory] = useState('All Topics');
  const [newQuestionAdded, setNewQuestionAdded] = useState(false);

  const handleAddQuestion = () => {
    const nextNum = Math.max(...questions.map((q) => q.num)) + 1;
    const newQ = {
      id: Date.now(),
      num: nextNum,
      category: 'Computer Science',
      question: 'Which sorting algorithm has the best average-case time complexity of O(n log n) with O(1) extra space?',
      options: ['Merge Sort', 'Heapsort', 'Quicksort', 'Bubble Sort'],
      correctIndex: 1,
      difficulty: 'Hard',
      points: 25,
    };
    setQuestions([...questions, newQ]);
    setNewQuestionAdded(true);
    setTimeout(() => setNewQuestionAdded(false), 2000);
  };

  const filteredQuestions =
    activeCategory === 'All Topics'
      ? questions
      : questions.filter((q) => q.category === activeCategory);

  return (
    <section className="py-20 bg-[var(--secondary)]/30 border-b border-[var(--border)] relative" id="contest-builder">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Contest Builder
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Build the competition your way.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Create a contest around your rules, your questions, timing, and brand —<br />
            upload a CSV, write questions inline, or use a shared bank.
          </p>
        </div>

        {/* Builder UI Showcase */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
          {/* Builder Bar */}
          <div className="p-4 bg-[var(--secondary)]/70 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--foreground)]">
                Question Bank (50 Questions)
              </span>
              <span className="text-[11px] font-mono text-[var(--primary)] bg-[var(--card)] px-2 py-0.5 rounded border border-[var(--border)]">
                National Aptitude Sprint 2026
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Question
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="p-3.5 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] mr-1">Topic:</span>
            {['All Topics', 'Computer Science', 'Logical Reasoning', 'Mathematics', 'General Aptitude'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold'
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Question List */}
          <div className="p-5 space-y-4">
            {filteredQuestions.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">
                No questions in this topic yet.
              </div>
            )}
            {filteredQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20 hover:border-[var(--primary)]/60 transition-all shadow-xs"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <GripVertical className="w-4 h-4 text-[var(--muted-foreground)] cursor-grab" />
                    <span className="text-xs font-mono font-bold text-[var(--primary)] px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">
                      Q{q.num}
                    </span>
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      {q.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]">
                      {q.difficulty} · {q.points} pts
                    </span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-[var(--foreground)] mb-3 pl-6">
                  {q.question}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 text-xs">
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-2.5 rounded-lg border flex items-center justify-between ${
                        oIdx === q.correctIndex
                          ? 'border-[var(--success)] bg-[color-mix(in_oklch,var(--success)_12%,var(--card))] text-[var(--success)] font-semibold'
                          : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]'
                      }`}
                    >
                      <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                      {oIdx === q.correctIndex && <Check className="w-3.5 h-3.5" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {newQuestionAdded && (
              <div className="p-3 bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] border border-[var(--success)] rounded-xl text-center text-xs font-semibold text-[var(--success)] animate-bounce">
                ✓ Question added to contest bank and indexed for Round 3!
              </div>
            )}
          </div>

          {/* Bottom Features Footer */}
          <div className="p-4 bg-[var(--secondary)]/40 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-4">
              <span>✓ Shuffle options per student</span>
              <span>✓ Negative marking supported</span>
              <span>✓ LaTeX & Markdown rendered</span>
            </div>
            <span className="font-mono text-[var(--foreground)] font-semibold">
              Total Weight: 100 Points
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}