import * as XLSX from 'xlsx';

export interface ParsedOption {
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface ParsedQuestion {
  questionText: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  hint?: string;
  explanation?: string;
  options: ParsedOption[];
  marks?: number;
  negativeMark?: number;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
  warnings: string[];
}

/**
 * Parses files (.csv, .xlsx, .xls) using SheetJS, supports case-insensitive column headers,
 * enforces a limit of 100 questions, and drops extra rows with a clear validation warning.
 */
export function parseQuestionFile(buffer: ArrayBuffer, fileName: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      errors.push('The file does not contain any sheets.');
      return { questions, errors, warnings };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    // Convert to raw JSON rows (array of arrays)
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (rows.length < 2) {
      errors.push('The file must contain a header row and at least one question row.');
      return { questions, errors, warnings };
    }

    const headers = rows[0].map((h) => String(h || '').trim());

    // Helper to find index dynamically
    const getIndex = (names: string[]) => {
      return headers.findIndex((h) => names.some((n) => h.toLowerCase() === n.toLowerCase()));
    };

    const qTextIdx = getIndex(['questiontext', 'question', 'text']);
    const diffIdx = getIndex(['difficulty', 'level']);
    const catIdx = getIndex(['category', 'tag', 'tags']);
    const hintIdx = getIndex(['hint']);
    const expIdx = getIndex(['explanation']);
    const marksIdx = getIndex(['marks', 'mark', 'points']);
    const negMarksIdx = getIndex(['negativemark', 'negativemarks', 'negmark', 'negative_mark', 'penalty']);

    // Multiple possible option columns
    const optIdxs = [
      getIndex(['option1']),
      getIndex(['option2']),
      getIndex(['option3']),
      getIndex(['option4']),
      getIndex(['option5']),
      getIndex(['option6']),
    ];

    // Options can be mapped by a correctOption index column (1-6) or multiple isCorrect columns
    const correctIdx = getIndex(['correctoption', 'iscorrect', 'correct']);
    const isCorrectIdxs = [
      getIndex(['iscorrect1']),
      getIndex(['iscorrect2']),
      getIndex(['iscorrect3']),
      getIndex(['iscorrect4']),
      getIndex(['iscorrect5']),
      getIndex(['iscorrect6']),
    ];

    // Fallbacks to standard column offsets if headers are omitted or don't match
    const finalQTextIdx = qTextIdx !== -1 ? qTextIdx : 0;
    const finalDiffIdx = diffIdx !== -1 ? diffIdx : 1;
    const finalCatIdx = catIdx !== -1 ? catIdx : 2;
    const finalHintIdx = hintIdx !== -1 ? hintIdx : 3;
    const finalExpIdx = expIdx !== -1 ? expIdx : 4;
    const finalOptIdxs = optIdxs.map((idx, i) => (idx !== -1 ? idx : 5 + i));
    const finalCorrectIdx = correctIdx !== -1 ? correctIdx : 11;
    const finalIsCorrectIdxs = isCorrectIdxs.map((idx, i) => (idx !== -1 ? idx : 12 + i));

    // Limit enforcement check
    const totalQuestions = rows.length - 1;
    let rowsToParse = rows.slice(1);

    if (totalQuestions > 100) {
      warnings.push('LIMIT ENFORCED: This file contains ' + totalQuestions + ' questions, but a maximum of 100 questions can be uploaded at a time. The extra ' + (totalQuestions - 100) + ' questions have been skipped automatically.');
      rowsToParse = rowsToParse.slice(0, 100);
    }

    for (let i = 0; i < rowsToParse.length; i++) {
      const row = rowsToParse[i];
      if (!row || row.length === 0) continue;

      const rowNum = i + 2; // 1-based index (including skipped header)
      const questionText = String(row[finalQTextIdx] || '').trim();
      const rawDifficulty = String(row[finalDiffIdx] || 'MEDIUM').trim();
      const category = String(row[finalCatIdx] || 'General').trim();
      const hint = String(row[finalHintIdx] || '').trim();
      const explanation = String(row[finalExpIdx] || '').trim();

      let marks = 4;
      if (marksIdx !== -1 && row[marksIdx] !== undefined) {
        const val = parseFloat(String(row[marksIdx]).trim());
        if (!isNaN(val)) marks = val;
      }

      let negativeMark = 1;
      if (negMarksIdx !== -1 && row[negMarksIdx] !== undefined) {
        const val = parseFloat(String(row[negMarksIdx]).trim());
        if (!isNaN(val)) negativeMark = val;
      }

      if (!questionText) {
        errors.push(`Row ${rowNum}: Question text is missing.`);
        continue;
      }

      if (questionText.length < 5) {
        errors.push(`Row ${rowNum}: Question text must be at least 5 characters long.`);
        continue;
      }

      const difficulty = rawDifficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD';
      if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
        errors.push(`Row ${rowNum}: Difficulty must be EASY, MEDIUM, or HARD. Got "${rawDifficulty}".`);
        continue;
      }

      const parsedOptions: ParsedOption[] = [];
      let correctIdxValue = -1;

      if (finalCorrectIdx !== -1 && row[finalCorrectIdx] !== undefined) {
        const val = parseInt(String(row[finalCorrectIdx]).trim());
        if (!isNaN(val)) {
          correctIdxValue = val - 1; // 0-based
        }
      }

      for (let j = 0; j < 6; j++) {
        const optVal = String(row[finalOptIdxs[j]] || '').trim();
        if (!optVal) continue;

        let isCorrect = false;
        if (correctIdxValue !== -1) {
          isCorrect = j === correctIdxValue;
        } else {
          const isCorrCol = finalIsCorrectIdxs[j];
          if (isCorrCol !== -1 && row[isCorrCol] !== undefined) {
            const valStr = String(row[isCorrCol]).trim().toUpperCase();
            isCorrect = valStr === 'TRUE' || valStr === '1' || valStr === 'YES' || valStr === 'CORRECT';
          }
        }

        parsedOptions.push({
          text: optVal,
          isCorrect,
          position: parsedOptions.length,
        });
      }

      if (parsedOptions.length < 2) {
        errors.push(`Row ${rowNum}: Must provide at least 2 options (Option 1 & Option 2).`);
        continue;
      }

      const correctCount = parsedOptions.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        errors.push(`Row ${rowNum}: Must have exactly one correct answer (Found ${correctCount} correct options marked).`);
        continue;
      }

      questions.push({
        questionText,
        difficulty,
        tags: category ? [category] : ['General'],
        hint: hint || undefined,
        explanation: explanation || undefined,
        options: parsedOptions,
        marks,
        negativeMark,
      });
    }
  } catch (err: any) {
    errors.push(`Failed to parse file: ${err?.message ?? 'Unknown parsing error'}`);
  }

  return { questions, errors, warnings };
}
