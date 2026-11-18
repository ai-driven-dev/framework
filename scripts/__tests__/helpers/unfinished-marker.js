// What a finished file must not hold. An autolink such as <https://example.com> is not a placeholder.
const PLACEHOLDER = /<!--|<(?!https?:)[^>\n]+>/u;
const UNFINISHED = new RegExp(`\\{\\{|${PLACEHOLDER.source}`, "u");

module.exports = { PLACEHOLDER, UNFINISHED };
