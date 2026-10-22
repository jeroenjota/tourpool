const normalized = (value: string) =>
  value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('nl-NL');

export function suggestTeamName(firstName: string | null, lastName: string | null, existingNames: string[]) {
  const first = firstName?.trim() || 'Ploeg';
  const surnameLetters = Array.from(lastName?.trim() ?? '');
  const used = new Set(existingNames.map(normalized));
  const surnamePrefix = (length: number) =>
    surnameLetters.slice(0, length).join('').toLocaleUpperCase('nl-NL');
  const candidate = (prefix: string, suffix = '') =>
    [first, prefix, suffix].filter(Boolean).join(' ').trim();

  for (let length = 1; length <= surnameLetters.length; length++) {
    const name = candidate(surnamePrefix(length));
    if (!used.has(normalized(name))) return name;
  }

  const base = candidate(surnamePrefix(surnameLetters.length));
  if (!used.has(normalized(base))) return base;
  for (let number = 2; ; number++) {
    const name = candidate(surnamePrefix(surnameLetters.length), String(number));
    if (!used.has(normalized(name))) return name;
  }
}
