import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Topbar } from './layout/topbar/topbar';
import { Sidebar } from './layout/sidebar/sidebar';
import { MultiselectDropdown } from './multiselect/multiselect-dropdown';

export const SHARED_IMPORTS = [
  CommonModule,
  FormsModule,
  RouterLink,
  Topbar,
  Sidebar,
  MultiselectDropdown,
] as const;
