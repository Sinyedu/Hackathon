export interface PlannedMove {
  from: string;
  to: string;
}

const categories: Record<string, string[]> = {
  Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'],
  Documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'odt', 'rtf', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'],
  Archives: ['zip', 'tar', 'gz', '7z', 'rar', 'tgz'],
  Code: ['js', 'ts', 'py', 'rs', 'c', 'cpp', 'java', 'json', 'html', 'css', 'sh'],
  Media: ['mp3', 'wav', 'mp4', 'mov', 'mkv', 'flac'],
  Installers: ['exe', 'msi', 'dmg', 'deb', 'rpm', 'appimage'],
};

export function categoryFor(fileName: string): string {
  const extension = fileName.includes('.') ? (fileName.split('.').pop() ?? '').toLowerCase() : '';
  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) return category;
  }
  return 'Other';
}

/** Groups loose files in a folder into category subfolders. Already-sorted names are left alone. */
export function planSort(folder: string, fileNames: string[]): PlannedMove[] {
  return fileNames
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => ({ from: `${folder}/${name}`, to: `${folder}/${categoryFor(name)}/${name}` }));
}
