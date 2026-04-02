import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { HasRoleDirective } from '../../../core/auth/has-role.directive';
import { SidebarCountsService } from './sidebar-counts.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, HasRoleDirective],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  filterText = '';
  counts = inject(SidebarCountsService);

  matches(label: string): boolean {
    if (!this.filterText.trim()) return true;
    return label.toLowerCase().includes(this.filterText.toLowerCase());
  }
}
