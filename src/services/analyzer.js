const crypto = require('crypto');


function sha256(value) {
return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}


function isPalindrome(value) {
const normalized = value.toLowerCase();
const reversed = [...normalized].reverse().join('');
return normalized === reversed;
}


function uniqueCharCount(value) {
const normalized = value.toLowerCase();
return new Set([...normalized]).size;
}


function wordCount(value) {
const trimmed = value.trim();
if (!trimmed) return 0;
return trimmed.split(/\s+/).length;
}


function charFrequencyMap(value) {
const normalized = value.toLowerCase();
const freq = {};
for (const ch of normalized) {
if (/\s/.test(ch)) continue; // ignore whitespace in frequency map
freq[ch] = (freq[ch] || 0) + 1;
}
return freq;
}


function analyzeString(value) {
const id = sha256(value);
return {
id,
value,
properties: {
length: value.length,
is_palindrome: isPalindrome(value),
unique_characters: uniqueCharCount(value),
word_count: wordCount(value),
sha256_hash: id,
character_frequency_map: charFrequencyMap(value)
},
created_at: new Date().toISOString()
};
}


module.exports = {
analyzeString,
sha256
};