import type {
  Organization,
  Contest,
  Question,
  Registration,
  QuizAttempt,
  MessageTemplate,
  SentMessage,
  TeamMember,
  DifficultyLevel,
} from '@/lib/types';

// Standalone types for Mock DB
export interface Contact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  institution?: string;
  city?: string;
  state?: string;
  country: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  registrationId: string;
  contactId: string;
  contestId: string;
  amount: number;
  currency: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: 'captured' | 'failed' | 'refunded';
  method: string;
  createdAt: string;
}

// ============================================
// MOCK DATABASE - Single source of truth
// ============================================

// Helper to generate contacts
function generateContacts(): Contact[] {
  const institutions = ['IIT Bombay', 'NIT Surat', 'Delhi University', 'BITS Pilani', 'Pune University', 'Anna University', 'VIT Chennai', 'Manipal University', 'NMIMS Mumbai', 'IIIT Hyderabad'];
  const cities = ['Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'];
  const states = ['Maharashtra', 'Karnataka', 'Delhi', 'Telangana', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Haryana'];
  const firstNames = ['Arjun', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali', 'Rohan', 'Divya', 'Aditya', 'Neha', 'Kunal', 'Pooja', 'Harsh', 'Ananya', 'Nikhil'];
  const lastNames = ['Sharma', 'Patel', 'Gupta', 'Reddy', 'Malhotra', 'Singh', 'Kumar', 'Verma', 'Bansal', 'Iyer'];

  const contacts: Contact[] = [];
  for (let i = 1; i <= 50; i++) {
    const firstName = firstNames[(i - 1) % firstNames.length];
    const lastName = lastNames[Math.floor((i - 1) / firstNames.length) % lastNames.length];
    const institution = institutions[(i - 1) % institutions.length];
    const city = cities[(i - 1) % cities.length];
    const state = states[(i - 1) % states.length];

    contacts.push({
      id: `contact-${String(i).padStart(3, '0')}`,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`,
      phone: `+91${9800000000 + i}`,
      institution,
      city,
      state,
      country: 'India',
      createdAt: new Date(2024, 0, 15 + (i % 30)).toISOString(),
    });
  }

  return contacts;
}

// Helper to generate questions for a contest
function generateQuestionsForContest(contestId: string, totalQuestions: number): Question[] {
  const questions: Question[] = [];
  const topics: Record<string, string[]> = {
    'contest-001': ['Algebra', 'Geometry', 'Calculus', 'Number Theory', 'Combinatorics'],
    'contest-002': ['Data Structures', 'Algorithms', 'Dynamic Programming', 'Graph Theory', 'String Algorithms'],
    'contest-003': ['History', 'Geography', 'Science', 'Current Affairs', 'Sports', 'Culture'],
    'contest-004': ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Astronomy'],
    'contest-005': ['Business Strategy', 'Finance', 'Marketing', 'Operations', 'Economics'],
    'contest-006': ['Grammar', 'Vocabulary', 'Reading Comprehension', 'Writing', 'Phonetics'],
    'contest-sim-001': ['General Knowledge', 'Science', 'History', 'Geography', 'Technology', 'Sports', 'Arts', 'Business', 'Health', 'Environment'],
  };

  const topicList = topics[contestId] || ['General'];
  const difficulties: DifficultyLevel[] = ['easy', 'medium', 'hard'];
  const questionTexts: Record<string, string[]> = {
    'contest-001': [
      'Solve for x: 2x² + 5x + 3 = 0',
      'Find the area of a triangle with sides 3, 4, 5',
      'Integrate ∫x² dx from 0 to 1',
      'Find the greatest common divisor of 48 and 18',
      'How many permutations of {1,2,3,4} are there?',
      'What is the value of sin(π/6)?',
      'Solve: 3x + 2y = 7 and x - y = 1',
      'Find the derivative of f(x) = x³ + 2x²',
      'What is the sum of angles in a pentagon?',
      'Prove that √2 is irrational',
    ],
    'contest-002': [
      'What is the time complexity of quicksort?',
      'Implement a function to reverse a linked list',
      'Find the longest palindromic substring',
      'Solve the 0/1 knapsack problem',
      'What is a binary search tree?',
      'Find the shortest path in a graph',
      'Implement depth-first search',
      'What is the space complexity of merge sort?',
      'Design a hash table from scratch',
      'Find the median of two sorted arrays',
    ],
    'contest-003': [
      'Who was the first President of India?',
      'What is the capital of Australia?',
      'In which year did the Titanic sink?',
      'Who wrote the Harry Potter series?',
      'What is the largest desert in the world?',
      'How many continents are there?',
      'What is the chemical symbol for Gold?',
      'Who directed the movie Avatar?',
      'What is the smallest country in the world?',
      'How many sides does a hexagon have?',
    ],
    'contest-004': [
      'What is the SI unit of force?',
      'Define pH and give the pH range of water at 25°C',
      'What is photosynthesis?',
      'What is the speed of light in vacuum?',
      'What are the three states of matter?',
      'What is the chemical formula of salt?',
      'How many bones are in the human body?',
      'What is oxidation number?',
      'What is the process of mitosis?',
      'What is gravity?',
    ],
    'contest-005': [
      'What is SWOT analysis?',
      'Define market segmentation',
      'What is break-even point?',
      'Explain the concept of pricing strategy',
      'What is supply chain management?',
      'Define ROI (Return on Investment)',
      'What is corporate social responsibility?',
      'Explain the Boston Matrix',
      'What is customer lifetime value?',
      'Define competitive advantage',
    ],
    'contest-006': [
      'Which is the correct spelling?',
      'Choose the correct tense',
      'What does the idiom "break the ice" mean?',
      'Select the correct pronoun',
      'Choose the correct preposition',
      'What is the plural of "child"?',
      'Choose the correct article',
      'What is a synonym for "happy"?',
      'Select the correct verb form',
      'What is the opposite of "difficult"?',
    ],
    'contest-sim-001': [
      'Which planet in our solar system has the most moons?',
      'Who was the first person to walk on the moon?',
      'What is the capital of France?',
      'What is the chemical formula for water?',
      'In which year did World War II end?',
      'How many countries are there in the world?',
      'What is the largest ocean on Earth?',
      'Who invented the telephone?',
      'What is the currency of Japan?',
      'How many sides does a triangle have?',
    ],
  };

  const texts = questionTexts[contestId] || ['What is the answer?'];

  for (let i = 1; i <= totalQuestions; i++) {
    const optionLetters = ['A', 'B', 'C', 'D'];
    const correctIndex = Math.floor(Math.random() * 4);
    const options = optionLetters.map((letter, idx) => ({
      id: `opt-${contestId}-${i}-${letter}`,
      text: `Option ${letter}`,
    }));

    questions.push({
      id: `q-${contestId}-${i}`,
      contestId,
      questionNumber: i,
      type: 'mcq',
      text: texts[i - 1] || `Question ${i}`,
      options,
      correctOptionIds: [`opt-${contestId}-${i}-${optionLetters[correctIndex]}`],
      marks: contestId === 'contest-sim-001' ? 10 : Math.ceil(100 / totalQuestions),
      negativeMarks: 0,
      difficulty: difficulties[(i - 1) % difficulties.length],
      hint: 'Think carefully about the options',
      explanation: `The correct answer is ${optionLetters[correctIndex]}. This option is correct because...`,
      tags: [topicList[(i - 1) % topicList.length]],
    });
  }

  return questions;
}

// Helper to generate registrations
function generateRegistrations(contests: Contest[], contacts: Contact[]): Registration[] {
  const registrations: Registration[] = [];
  let regIndex = 0;

  const contestDistribution: Record<string, number> = {
    'contest-001': 80,
    'contest-002': 40,
    'contest-003': 60,
    'contest-004': 45,
    'contest-005': 35,
    'contest-006': 50,
    'contest-sim-001': 25,
  };

  for (const [contestId, count] of Object.entries(contestDistribution)) {
    const contest = contests.find(c => c.id === contestId);
    if (!contest) continue;

    for (let i = 0; i < count && i < contacts.length; i++) {
      const contact = contacts[i];
      const isPaid = Math.random() > 0.2; // 80% paid
      regIndex++;

      registrations.push({
        id: `reg-${String(regIndex).padStart(4, '0')}`,
        contestId,
        participantId: `part-${String(regIndex).padStart(4, '0')}`,
        status: contestId === 'contest-sim-001' ? 'confirmed' : (isPaid ? 'confirmed' : 'pending'),
        registeredAt: new Date(2024, 1, Math.floor(Math.random() * 20) + 1).toISOString(),
        paymentId: isPaid ? `pay-${String(regIndex).padStart(4, '0')}` : undefined,
        paymentStatus: isPaid ? 'completed' : 'pending',
        amount: contest.registrationFee || 0,
        paymentMethod: isPaid ? ['card', 'upi', 'netbanking'][Math.floor(Math.random() * 3)] : undefined,
        participantDetails: {
          fullName: contact.fullName,
          email: contact.email,
          phone: contact.phone,
          institution: contact.institution,
          city: contact.city,
          state: contact.state,
          country: contact.country,
        },
        whatsappOptIn: Math.random() > 0.5,
        customFields: {},
      });
    }
  }

  return registrations;
}

// Helper to generate payments
function generatePayments(registrations: Registration[]): Payment[] {
  return registrations
    .filter(r => r.paymentStatus === 'completed' && r.paymentId)
    .map(r => ({
      id: r.paymentId!,
      registrationId: r.id,
      contactId: `contact-${r.id.split('-')[1]}`, // Derived from registration ID
      contestId: r.contestId,
      amount: r.amount || 0,
      currency: 'INR',
      razorpayOrderId: `order-${r.id}`,
      razorpayPaymentId: `pay-${r.id}`,
      status: 'captured' as const,
      method: (r.paymentMethod || 'card') as any,
      createdAt: r.registeredAt,
    }));
}

// Helper to generate attempts
function generateAttempts(registrations: Registration[], contests: Contest[]): QuizAttempt[] {
  const attempts: QuizAttempt[] = [];
  const completedContests = contests.filter(c => c.status === 'completed');

  registrations.forEach((reg, idx) => {
    const contest = contests.find(c => c.id === reg.contestId);
    if (!contest || !completedContests.includes(contest)) return;

    // ~70% of registrations have attempts
    if (Math.random() > 0.7) return;

    const durationMs = (contest.durationMinutes || 60) * 60 * 1000;
    const timeSpentSeconds = Math.floor(Math.random() * (durationMs / 1000));

    attempts.push({
      id: `attempt-${reg.id}`,
      registrationId: reg.id,
      contestId: reg.contestId,
      participantId: reg.participantId,
      status: 'submitted',
      startedAt: new Date(Date.now() - durationMs * 2).toISOString(),
      submittedAt: new Date(Date.now() - durationMs).toISOString(),
      timeSpentSeconds,
      answers: [],
      score: Math.floor(Math.random() * 100),
      proctoringViolations: [],
    });
  });

  return attempts;
}

// Main MockDB object
export const MockDB = {
  organization: {
    id: 'org-quizbuzz',
    name: 'QuizBuzz Academy',
    slug: 'quizbuzz-academy',
    description: "India's premier online quiz and competition platform",
    website: 'https://quizbuzz.in',
    industry: 'Education Technology',
    logo: '/images/org/logo.png',
    primaryColor: '#6366F1',
    secondaryColor: '#F59E0B',
    testMode: true,
    razorpayKeyId: 'rzp_test_mock1234',
    whatsappNumber: '+919876543210',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  } as Organization,

  teamMembers: [
    {
      id: 'team-001',
      orgId: 'org-quizbuzz',
      email: 'admin@quizbuzz.in',
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      joinedAt: '2023-01-01T00:00:00Z',
    },
    {
      id: 'team-002',
      orgId: 'org-quizbuzz',
      email: 'editor@quizbuzz.in',
      name: 'Content Editor',
      role: 'editor',
      status: 'active',
      joinedAt: '2023-02-01T00:00:00Z',
    },
  ] as TeamMember[],

  contests: [
    {
      id: 'contest-001',
      title: 'National Mathematics Olympiad 2024',
      slug: 'national-math-olympiad-2024',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'Test your mathematical prowess in this prestigious national-level competition featuring challenging problems from algebra, geometry, and calculus.',
      shortDescription: 'Mathematics competition',
      topic: 'Mathematics',
      tags: ['mathematics', 'olympiad', 'hard'],
      category: 'Mathematics',
      difficulty: 'hard',
      status: 'published',
      startTime: new Date(2024, 2, 20, 10, 0).toISOString(),
      registrationDeadline: new Date(2024, 2, 15, 23, 59).toISOString(),
      registrationStartDate: '2024-01-01T00:00:00Z',
      registrationEndDate: '2024-03-15T23:59:59Z',
      contestDate: '2024-03-20',
      contestStartTime: '10:00',
      contestEndTime: '13:00',
      durationMinutes: 180,
      timezone: 'Asia/Kolkata',
      totalQuestions: 30,
      totalMarks: 100,
      passingMarks: 40,
      negativeMarking: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowBackNavigation: true,
      proctoringEnabled: true,
      fullscreenRequired: true,
      webcamRequired: true,
      tabSwitchLimit: 3,
      fee: 299,
      currency: 'INR',
      registrationFee: 299,
      maxParticipants: 5000,
      currentParticipants: 3247,
      prizes: [
        { rank: 1, title: 'Gold Medal', amount: 50000, description: 'Full scholarship' },
        { rank: 2, title: 'Silver Medal', amount: 25000, description: 'Cash prize' },
        { rank: 3, title: 'Bronze Medal', amount: 10000, description: 'Cash prize' },
      ],
      rules: ['Maintain internet connection', 'No tab switching', 'Webcam must be on'],
      publishedAt: '2024-01-01T00:00:00Z',
      cancelledAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 3247, confirmed: 2900, paid: 2600, submitted: 1800, questions: 30 },
    } as Contest,
    {
      id: 'contest-002',
      title: 'CodeSprint Championship',
      slug: 'codesprint-championship',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'A high-stakes coding competition designed to test algorithmic thinking and problem-solving speed.',
      shortDescription: 'Coding competition',
      topic: 'Programming',
      tags: ['programming', 'algorithms', 'hard'],
      category: 'Programming',
      difficulty: 'hard',
      status: 'published',
      startTime: new Date(2024, 3, 5, 14, 0).toISOString(),
      registrationDeadline: new Date(2024, 3, 1, 23, 59).toISOString(),
      registrationStartDate: '2024-02-01T00:00:00Z',
      registrationEndDate: '2024-04-01T23:59:59Z',
      contestDate: '2024-04-05',
      contestStartTime: '14:00',
      contestEndTime: '17:00',
      durationMinutes: 180,
      timezone: 'Asia/Kolkata',
      totalQuestions: 25,
      totalMarks: 100,
      passingMarks: 35,
      negativeMarking: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      allowBackNavigation: true,
      proctoringEnabled: true,
      fullscreenRequired: true,
      webcamRequired: false,
      tabSwitchLimit: 5,
      fee: 499,
      currency: 'INR',
      registrationFee: 499,
      maxParticipants: 3000,
      currentParticipants: 1856,
      prizes: [
        { rank: 1, title: 'Champion', amount: 100000, description: 'Job offer' },
        { rank: 2, title: 'Runner Up', amount: 50000, description: 'Internship' },
        { rank: 3, title: 'Third Place', amount: 25000, description: 'Cash prize' },
      ],
      rules: ['Stable internet required', 'No external help allowed'],
      publishedAt: '2024-02-01T00:00:00Z',
      cancelledAt: null,
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 1856, confirmed: 1670, paid: 1500, submitted: 1050, questions: 25 },
    } as Contest,
    {
      id: 'contest-003',
      title: 'General Knowledge Challenge',
      slug: 'general-knowledge-challenge',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'A comprehensive quiz covering current affairs, history, science, geography, and culture from around the world.',
      shortDescription: 'GK Challenge',
      topic: 'General Knowledge',
      tags: ['general-knowledge', 'medium'],
      category: 'General Knowledge',
      difficulty: 'medium',
      status: 'published',
      startTime: new Date(2024, 2, 28, 11, 0).toISOString(),
      registrationDeadline: new Date(2024, 2, 25, 23, 59).toISOString(),
      registrationStartDate: '2024-02-15T00:00:00Z',
      registrationEndDate: '2024-03-25T23:59:59Z',
      contestDate: '2024-03-28',
      contestStartTime: '11:00',
      contestEndTime: '12:30',
      durationMinutes: 90,
      timezone: 'Asia/Kolkata',
      totalQuestions: 50,
      totalMarks: 100,
      passingMarks: 45,
      negativeMarking: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowBackNavigation: true,
      proctoringEnabled: false,
      fullscreenRequired: true,
      webcamRequired: false,
      tabSwitchLimit: 3,
      fee: 149,
      currency: 'INR',
      registrationFee: 149,
      maxParticipants: 10000,
      currentParticipants: 7523,
      prizes: [
        { rank: 1, title: 'Champion', amount: 15000, description: 'Trophy and cash' },
        { rank: 2, title: 'Runner Up', amount: 10000, description: 'Medal and cash' },
        { rank: 3, title: 'Third Place', amount: 5000, description: 'Medal and cash' },
      ],
      rules: [],
      publishedAt: '2024-02-15T00:00:00Z',
      cancelledAt: null,
      createdAt: '2024-02-15T00:00:00Z',
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 7523, confirmed: 6770, paid: 6000, submitted: 4200, questions: 50 },
    } as Contest,
    {
      id: 'contest-004',
      title: 'Science Quiz Bowl',
      slug: 'science-quiz-bowl',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'Dive deep into physics, chemistry, biology, and earth sciences in this exciting science competition.',
      shortDescription: 'Science competition',
      topic: 'Science',
      tags: ['science', 'medium'],
      category: 'Science',
      difficulty: 'medium',
      status: 'published',
      startTime: new Date(2024, 3, 15, 9, 0).toISOString(),
      registrationDeadline: new Date(2024, 3, 10, 23, 59).toISOString(),
      registrationStartDate: '2024-03-01T00:00:00Z',
      registrationEndDate: '2024-04-10T23:59:59Z',
      contestDate: '2024-04-15',
      contestStartTime: '09:00',
      contestEndTime: '11:00',
      durationMinutes: 120,
      timezone: 'Asia/Kolkata',
      totalQuestions: 40,
      totalMarks: 100,
      passingMarks: 40,
      negativeMarking: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowBackNavigation: true,
      proctoringEnabled: true,
      fullscreenRequired: true,
      webcamRequired: true,
      tabSwitchLimit: 3,
      fee: 199,
      currency: 'INR',
      registrationFee: 199,
      maxParticipants: 8000,
      currentParticipants: 4102,
      prizes: [
        { rank: 1, title: 'Science Champion', amount: 25000, description: 'Trophy and voucher' },
        { rank: 2, title: 'Runner Up', amount: 15000, description: 'Medal and books' },
        { rank: 3, title: 'Third Place', amount: 8000, description: 'Medal' },
      ],
      rules: [],
      publishedAt: '2024-03-01T00:00:00Z',
      cancelledAt: null,
      createdAt: '2024-03-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 4102, confirmed: 3692, paid: 3282, submitted: 2300, questions: 40 },
    } as Contest,
    {
      id: 'contest-005',
      title: 'Business Case Competition',
      slug: 'business-case-competition',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'Analyze real-world business scenarios and demonstrate your strategic thinking and problem-solving abilities.',
      shortDescription: 'Business strategy',
      topic: 'Business',
      tags: ['business', 'hard'],
      category: 'Business',
      difficulty: 'hard',
      status: 'active',
      startTime: new Date(2024, 2, 22, 15, 0).toISOString(),
      registrationDeadline: new Date(2024, 2, 18, 23, 59).toISOString(),
      registrationStartDate: '2024-02-20T00:00:00Z',
      registrationEndDate: '2024-03-18T23:59:59Z',
      contestDate: '2024-03-22',
      contestStartTime: '15:00',
      contestEndTime: '18:00',
      durationMinutes: 180,
      timezone: 'Asia/Kolkata',
      totalQuestions: 20,
      totalMarks: 100,
      passingMarks: 50,
      negativeMarking: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      allowBackNavigation: true,
      proctoringEnabled: true,
      fullscreenRequired: true,
      webcamRequired: true,
      tabSwitchLimit: 2,
      fee: 599,
      currency: 'INR',
      registrationFee: 599,
      maxParticipants: 2000,
      currentParticipants: 1876,
      prizes: [
        { rank: 1, title: 'Business Strategist', amount: 75000, description: 'Internship at Fortune 500' },
        { rank: 2, title: 'Strategic Thinker', amount: 40000, description: 'Mentorship program' },
        { rank: 3, title: 'Analyst', amount: 20000, description: 'Course scholarship' },
      ],
      rules: [],
      publishedAt: '2024-02-20T00:00:00Z',
      cancelledAt: null,
      createdAt: '2024-02-20T00:00:00Z',
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 1876, confirmed: 1688, paid: 1500, submitted: 1050, questions: 20 },
    } as Contest,
    {
      id: 'contest-006',
      title: 'English Proficiency Test',
      slug: 'english-proficiency-test',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'Assess your English language skills across reading comprehension, grammar, vocabulary, and writing.',
      shortDescription: 'English language test',
      topic: 'Language',
      tags: ['english', 'easy'],
      category: 'Language',
      difficulty: 'easy',
      status: 'published',
      startTime: new Date(2024, 3, 25, 10, 0).toISOString(),
      registrationDeadline: new Date(2024, 3, 20, 23, 59).toISOString(),
      registrationStartDate: '2024-03-05T00:00:00Z',
      registrationEndDate: '2024-04-20T23:59:59Z',
      contestDate: '2024-04-25',
      contestStartTime: '10:00',
      contestEndTime: '11:30',
      durationMinutes: 90,
      timezone: 'Asia/Kolkata',
      totalQuestions: 60,
      totalMarks: 100,
      passingMarks: 50,
      negativeMarking: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowBackNavigation: true,
      proctoringEnabled: false,
      fullscreenRequired: false,
      webcamRequired: false,
      tabSwitchLimit: 5,
      fee: 99,
      currency: 'INR',
      registrationFee: 99,
      maxParticipants: 15000,
      currentParticipants: 8934,
      prizes: [
        { rank: 1, title: 'Language Master', amount: 10000, description: 'Course scholarship' },
        { rank: 2, title: 'Wordsmith', amount: 7500, description: 'Book collection' },
        { rank: 3, title: 'Grammar Guru', amount: 5000, description: 'Course voucher' },
      ],
      rules: [],
      publishedAt: '2024-03-05T00:00:00Z',
      cancelledAt: null,
      createdAt: '2024-03-05T00:00:00Z',
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 8934, confirmed: 8041, paid: 7234, submitted: 5063, questions: 60 },
    } as Contest,
    // The Always-Live Simulation Contest
    {
      id: 'contest-sim-001',
      title: 'QuizBuzz Live Demo Contest',
      slug: 'live-demo-contest',
      orgId: 'org-quizbuzz',
      orgSlug: 'quizbuzz-academy',
      description: 'A live demonstration contest with real proctoring and timing.',
      shortDescription: 'Live demo with camera monitoring',
      topic: 'General Knowledge',
      tags: ['demo', 'live', 'general-knowledge'],
      category: 'General Knowledge',
      difficulty: 'medium',
      status: 'active',
      startTime: new Date(Date.now() - 1000).toISOString(), // Always started
      registrationDeadline: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      registrationStartDate: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      registrationEndDate: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      contestDate: new Date().toISOString().split('T')[0],
      contestStartTime: '00:00',
      contestEndTime: '23:59',
      durationMinutes: 30,
      timezone: 'Asia/Kolkata',
      totalQuestions: 10,
      totalMarks: 100,
      passingMarks: 40,
      negativeMarking: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowBackNavigation: true,
      proctoringEnabled: true,
      fullscreenRequired: true,
      webcamRequired: true,
      tabSwitchLimit: 3,
      fee: 0,
      currency: 'INR',
      registrationFee: 0,
      maxParticipants: 100,
      currentParticipants: 25,
      prizes: [
        { rank: 1, title: 'Demo Champion', amount: 0, description: 'Certificate of Excellence' },
      ],
      rules: [
        'This is a live simulation for demo purposes.',
        'Camera must remain on at all times.',
        'No tab switching allowed.',
      ],
      publishedAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      cancelledAt: null,
      createdAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      organizerId: 'org-quizbuzz',
      _counts: { registered: 25, confirmed: 25, paid: 25, submitted: 0, questions: 10 },
    } as Contest,
  ],

  // Generate questions dynamically
  get questions(): Question[] {
    if (!(this as any)._questionsCache) {
      const all: Question[] = [];
      for (const contest of this.contests) {
        const qs = generateQuestionsForContest(contest.id, contest.totalQuestions);
        all.push(...qs);
      }
      (this as any)._questionsCache = all;
    }
    return (this as any)._questionsCache;
  },

  // Generate contacts dynamically
  get contacts(): Contact[] {
    if (!(this as any)._contactsCache) {
      (this as any)._contactsCache = generateContacts();
    }
    return (this as any)._contactsCache;
  },

  // Generate registrations dynamically
  get registrations(): Registration[] {
    if (!(this as any)._registrationsCache) {
      (this as any)._registrationsCache = generateRegistrations(this.contests, this.contacts);
    }
    return (this as any)._registrationsCache;
  },

  // Generate payments dynamically
  get payments(): Payment[] {
    if (!(this as any)._paymentsCache) {
      (this as any)._paymentsCache = generatePayments(this.registrations);
    }
    return (this as any)._paymentsCache;
  },

  // Generate attempts dynamically
  get attempts(): QuizAttempt[] {
    if (!(this as any)._attemptsCache) {
      (this as any)._attemptsCache = generateAttempts(this.registrations, this.contests);
    }
    return (this as any)._attemptsCache;
  },

  // Placeholder for submissions (derived from attempts)
  get submissions() {
    return this.attempts.filter(a => a.status === 'submitted');
  },

  // Placeholder for certificates
  get certificates() {
    return [] as any[];
  },

  // Placeholder for results
  get results() {
    return [] as any[];
  },

  // Message templates
  messageTemplates: [
    {
      id: 'tmpl-001',
      orgId: 'org-quizbuzz',
      name: 'Registration Confirmed',
      channel: 'both',
      body: 'Dear {{fullName}}, your registration for {{contestTitle}} has been confirmed. Contest starts on {{contestDate}} at {{contestStartTime}}.',
      variables: ['fullName', 'contestTitle', 'contestDate', 'contestStartTime'],
      isSystem: true,
      systemEvent: 'registration_confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tmpl-002',
      orgId: 'org-quizbuzz',
      name: 'Day Before Reminder',
      channel: 'both',
      body: 'Dear {{fullName}}, reminder: {{contestTitle}} starts tomorrow at {{contestStartTime}}. Make sure your system is ready.',
      variables: ['fullName', 'contestTitle', 'contestStartTime'],
      isSystem: true,
      systemEvent: 'day_before_reminder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tmpl-003',
      orgId: 'org-quizbuzz',
      name: 'Hour Reminder',
      channel: 'whatsapp',
      body: 'Quick reminder: {{contestTitle}} starts in 1 hour at {{contestStartTime}}. Log in early!',
      variables: ['contestTitle', 'contestStartTime'],
      isSystem: true,
      systemEvent: 'hour_reminder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tmpl-004',
      orgId: 'org-quizbuzz',
      name: 'Contest Started',
      channel: 'email',
      body: '{{contestTitle}} is now live! Click here to enter: {{contestLink}}',
      variables: ['contestTitle', 'contestLink'],
      isSystem: true,
      systemEvent: 'contest_started',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tmpl-005',
      orgId: 'org-quizbuzz',
      name: 'Results Published',
      channel: 'both',
      body: 'Results for {{contestTitle}} are now available. Your rank: {{rank}}. View your results here: {{resultsLink}}',
      variables: ['contestTitle', 'rank', 'resultsLink'],
      isSystem: true,
      systemEvent: 'results_published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tmpl-006',
      orgId: 'org-quizbuzz',
      name: 'Certificate Ready',
      channel: 'both',
      body: 'Congratulations {{fullName}}! Your certificate for {{contestTitle}} is ready. Download it here: {{certificateLink}}',
      variables: ['fullName', 'contestTitle', 'certificateLink'],
      isSystem: true,
      systemEvent: 'certificate_ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as MessageTemplate[],

  // Sent messages
  sentMessages: [
    {
      id: 'msg-001',
      contestId: 'contest-001',
      templateId: 'tmpl-001',
      channel: 'email',
      sentAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
      totalRecipients: 100,
      deliveredCount: 98,
      failedCount: 2,
      status: 'sent',
    },
    {
      id: 'msg-002',
      contestId: 'contest-001',
      templateId: 'tmpl-002',
      channel: 'whatsapp',
      sentAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
      totalRecipients: 100,
      deliveredCount: 95,
      failedCount: 5,
      status: 'sent',
    },
    {
      id: 'msg-003',
      contestId: 'contest-002',
      templateId: 'tmpl-001',
      channel: 'email',
      sentAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
      totalRecipients: 80,
      deliveredCount: 80,
      failedCount: 0,
      status: 'sent',
    },
  ] as SentMessage[],

  // Proctoring logs (for violations)
  proctoringLogs: [],

  // Analytics cache
  analyticsCache: {
    totalRegistrations: 26419,
    totalRevenue: 1500000,
    totalContests: 7,
    totalParticipants: 50,
    conversionRate: 0.65,
    averageSessionDuration: 2400,
    topContests: ['contest-003', 'contest-001', 'contest-004'],
    dailyRegistrations: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 3600000).toISOString().split('T')[0],
      count: Math.floor(Math.random() * 500) + 100,
    })),
  },
};
