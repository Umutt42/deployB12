import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
})
export class ToastComponent {
  toastService = inject(ToastService);

  icon(type: Toast['type']): string {
    return { success: '✓', error: '✕', warning: '⚠', info: 'i' }[type];
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
