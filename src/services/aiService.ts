import axios from 'axios';

export interface InterviewQuestion {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  category: string;
}

interface ScoreResult { score: number; feedback: string; }

export class AIService {
  private static instance: AIService;
  private readonly hasServerAI: boolean;

  private constructor() {
    // We cannot expose server key in client; rely on presence indicator via env flag if desired
    this.hasServerAI = Boolean(process.env.REACT_APP_GEMINI_API_KEY); // optional indicator
  }

  static getInstance(): AIService {
    if (!AIService.instance) AIService.instance = new AIService();
    return AIService.instance;
  }

  // --------------- Fallback Data ---------------
  private fallbackQuestions(): InterviewQuestion[] {
    return [
      { id: 'q1', text: 'Explain the difference between let, const, and var in JavaScript.', difficulty: 'easy', timeLimit: 20, category: 'JavaScript' },
      { id: 'q2', text: 'What is the Virtual DOM in React?', difficulty: 'easy', timeLimit: 20, category: 'React' },
      { id: 'q3', text: 'How do you create a custom React hook?', difficulty: 'medium', timeLimit: 60, category: 'React' },
      { id: 'q4', text: 'Explain Express.js middleware.', difficulty: 'medium', timeLimit: 60, category: 'Node.js' },
      { id: 'q5', text: 'Design a scalable chat application.', difficulty: 'hard', timeLimit: 120, category: 'System Design' },
      { id: 'q6', text: 'How would you optimize React performance?', difficulty: 'hard', timeLimit: 120, category: 'Performance' }
    ];
  }

  private fallbackScore(question: string, answer: string, difficulty?: string): ScoreResult {
    if (!answer || answer.trim().length < 10) return { score: 0, feedback: 'Answer too short' };
    let base = Math.min(60, answer.length / 4);
    const keywords = ['javascript','react','node','api','component','state'];
    const matches = keywords.filter(k => answer.toLowerCase().includes(k)).length;
    base += matches * 8;
    if (difficulty === 'easy') base += 10; else if (difficulty === 'hard') base -= 5;
    const score = Math.max(0, Math.min(100, Math.round(base)));
    return { score, feedback: score >= 75 ? 'Strong answer!' : score >= 55 ? 'Decent answer, add more depth.' : 'Needs more technical detail.' };
  }

  private fallbackSummary(candidate: any, answers: any[]): { score: number; summary: string } {
    const total = answers.reduce((s,a)=> s + (a.score||0), 0);
    const avg = answers.length ? Math.round(total / answers.length) : 0;
    return {
      score: avg,
      summary: `${candidate.name} completed the interview with an overall score of ${avg}%. This summary is generated using fallback logic (AI proxy unavailable).`
    };
  }

  // --------------- API Helpers ---------------
  private async postJSON<T>(url: string, body: any): Promise<T> {
    const resp = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    return resp.data as T;
  }

  // --------------- Public Methods ---------------
  async generateQuestions(candidateInfo: any): Promise<InterviewQuestion[]> {
    try {
      const data = await this.postJSON<{ questions: InterviewQuestion[] }>('/api/gemini-generate-questions', { candidate: candidateInfo });
      if (!Array.isArray(data.questions) || data.questions.length !== 6) throw new Error('Invalid questions payload');
      return data.questions;
    } catch (e) {
      console.warn('Falling back to static questions:', (e as Error).message);
      return this.fallbackQuestions();
    }
  }

  async scoreAnswer(question: string, answer: string, difficulty?: string): Promise<ScoreResult> {
    try {
      const data = await this.postJSON<ScoreResult>('/api/gemini-score-answer', { question, answer, difficulty });
      if (typeof data.score !== 'number') throw new Error('Invalid score payload');
      return data;
    } catch (e) {
      console.warn('Falling back to heuristic scoring:', (e as Error).message);
      return this.fallbackScore(question, answer, difficulty);
    }
  }

  async generateSummary(candidate: any, answers: any[]): Promise<{ score: number; summary: string }> {
    const total = answers.reduce((s,a)=> s + (a.score||0), 0);
    const avg = answers.length ? Math.round(total / answers.length) : 0;
    try {
      const data = await this.postJSON<{ summary: string }>('/api/gemini-summary', { candidate, answers });
      if (!data.summary) throw new Error('Missing summary');
      return { score: avg, summary: data.summary };
    } catch (e) {
      console.warn('Falling back to basic summary:', (e as Error).message);
      return this.fallbackSummary(candidate, answers);
    }
  }

  async generateChatResponse(message: string, context: any): Promise<string> {
    const field = context.currentField;
    if (field === 'Name') return 'Please provide your full name.';
    if (field === 'Email') return 'Please provide your email.';
    if (field === 'Phone') return 'Please provide your phone.';
    return 'Please provide the information.';
  }
}
