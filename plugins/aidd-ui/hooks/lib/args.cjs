// The argument list every engine command reads: options with a value, flags, and the rest.
class Refusal extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/** `args` as `{values, flags, rest}`: `values` holds each of `options` given with its value, `flags`
 * the set of `flags` given, `rest` every other argument in order. An option last on the line has no
 * value: `error` names it. */
function parse(args, { options = [], flags = [] }) {
  const values = {};
  const given = new Set();
  const rest = [];
  for (let at = 0; at < args.length; at += 1) {
    if (options.includes(args[at])) {
      if (at + 1 >= args.length) return { error: `${args[at]} needs a value` };
      values[args[at]] = args[(at += 1)];
    } else if (flags.includes(args[at])) given.add(args[at]);
    else rest.push(args[at]);
  }
  return { values, flags: given, rest };
}

module.exports = { parse, Refusal };
