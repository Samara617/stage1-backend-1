// Natural language parsing logic
function parseNaturalLanguage(query) {
if (!query || typeof query !== 'string') {
return { parsed: null, errors: ['Query must be a non-empty string'] };
}


const q = query.toLowerCase().trim();
const parsed = {};
const notes = [];


// palindromic
if (/palindrome/.test(q)) parsed.is_palindrome = true;


// single word / multi word
if (/single\s+word/.test(q)) parsed.word_count = 1;
const moreThan = q.match(/(longer|more\s+than)\s+(\d+)\s*(characters|chars)?/);
if (moreThan) parsed.min_length = Number(moreThan[2]) + 1; // "longer than N" means N+1


const lessThan = q.match(/(shorter|less\s+than)\s+(\d+)\s*(characters|chars)?/);
if (lessThan) parsed.max_length = Number(lessThan[2]) - 1; // "shorter than N" means N-1


// contains the letter X
const containsLetter = q.match(/contain[s]?\s+(?:the\s+)?(?:letter\s+)?([a-z])/);
if (containsLetter) parsed.contains_character = containsLetter[1];


// first vowel heuristic
if (/first\s+vowel/.test(q)) {
parsed.contains_character = 'a';
notes.push('first vowel -> heuristic: a');
}


// Simple conflict check
if (parsed.min_length != null && parsed.max_length != null && parsed.min_length > parsed.max_length) {
return { parsed, errors: ['Conflicting filters: min_length > max_length'] };
}


if (Object.keys(parsed).length === 0) {
return { parsed: null, errors: ['Unable to parse natural language query'] };
}


return { parsed, errors: [], notes };
}


module.exports = { parseNaturalLanguage };