import { SubTheme } from './sub-theme.model';

export interface Theme {
  id?: number;
  name: string;
  description?: string | null;
  archived: boolean;
  subThemes?: SubTheme[];

  createdAt?: string; // ✅
  updatedAt?: string; // ✅

  updatedBy?: string;

}
