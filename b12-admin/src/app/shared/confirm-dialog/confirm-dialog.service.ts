import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?:  string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  visible = signal(false);
  title   = signal('Confirmation');
  message = signal('');
  danger  = signal(false);

  private resolveRef: ((value: boolean) => void) | null = null;

  confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
    this.message.set(message);
    this.title.set(options?.title ?? 'Confirmation');
    this.danger.set(options?.danger ?? false);
    this.visible.set(true);
    return new Promise(resolve => { this.resolveRef = resolve; });
  }

  resolve(value: boolean): void {
    this.visible.set(false);
    this.resolveRef?.(value);
    this.resolveRef = null;
  }
}
