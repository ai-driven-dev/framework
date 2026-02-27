export interface SelectChoice {
  value: string;
  label: string;
}

export interface Prompter {
  confirm(message: string): Promise<boolean>;
  select(message: string, choices: SelectChoice[]): Promise<string>;
  checkbox(message: string, choices: SelectChoice[]): Promise<string[]>;
}
