/** The trees planted to watch each size guard bite, one builder per breach. */
const lines = (count: number, line: (index: number) => string): string =>
  Array.from({ length: count }, (_, index) => line(index)).join("\n");

export const longFunction = (name: string, body: number): string =>
  `export function ${name}(): number {\n  let n = 0;\n${lines(body, () => "  n += 1;")}\n  return n;\n}\n`;

export const tangled = (
  name: string
): string => `export function ${name}(items: number[][], flag: boolean): number {
  let total = 0;
  for (const row of items) {
    for (const cell of row) {
      if (cell > 0 && flag) {
        for (let i = 0; i < cell; i++) {
          if (i % 2 === 0 || flag) {
            total += i;
          } else if (i > 3 && cell > 4) {
            total -= i;
          }
        }
      }
    }
  }
  return total;
}
`;

export const branches = (name: string, count: number): string =>
  `export function ${name}(n: number): number {\n  let total = 0;\n${lines(count, (index) => `  if (n > ${index}) total += 1;`)}\n  return total;\n}\n`;

export const twoClasses = (suffix: string): string =>
  `export class First${suffix} {}\nexport class Second${suffix} {}\n`;

export const constants = (count: number, prefix: string): string =>
  `${lines(count, (index) => `export const ${prefix}${index} = ${index};`)}\n`;

export const fourParams = (
  suffix: string
): string => `export function four${suffix}(a: number, b: number, c: number, d: number): number {
  return a + b + c + d;
}
export const arrow${suffix} = (a: number, b: number, c: number, d: number): number => a + b + c + d;
export class Method${suffix} {
  sum(a: number, b: number, c: number, d: number): number {
    return a + b + c + d;
  }
}
export interface Port${suffix} {
  sum(a: number, b: number, c: number, d: number): number;
}
`;

export const constructorWith = (count: number, suffix: string): string => {
  const params = Array.from({ length: count }, (_, i) => `private readonly p${i}: number`);
  return `export class Wired${suffix} {\n  constructor(${params.join(", ")}) {}\n}\n`;
};
