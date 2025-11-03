export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Espaços → hífens
    .replace(/[^\w\-]+/g, '')    // Remover caracteres especiais
    .replace(/\-\-+/g, '-')      // Múltiplos hífens → 1 hífen
    .replace(/^-+/, '')          // Remover hífen inicial
    .replace(/-+$/, '');         // Remover hífen final
};

export const generateUniqueSlug = (
  text: string, 
  existingSlugs: string[]
): string => {
  let slug = slugify(text);
  let counter = 1;
  
  while (existingSlugs.includes(slug)) {
    slug = `${slugify(text)}-${counter}`;
    counter++;
  }
  
  return slug;
};
