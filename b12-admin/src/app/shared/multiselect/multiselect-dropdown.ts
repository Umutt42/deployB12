import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-multiselect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multiselect-dropdown.html',
  styleUrl: './multiselect-dropdown.css',
})
export class MultiselectDropdown {
  @Input() options: string[] = [];
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();
  @Input() placeholder = 'Tous';

  open = false;

  constructor(private el: ElementRef) {}

  get label(): string {
    if (this.selected.length === 0) return this.placeholder;
    if (this.selected.length === 1) return this.selected[0];
    if (this.selected.length === 2) return this.selected.join(', ');
    return `${this.selected.length} sélectionnés`;
  }

  toggle(): void {
    this.open = !this.open;
  }

  isSelected(option: string): boolean {
    return this.selected.includes(option);
  }

  toggleOption(option: string, event: MouseEvent): void {
    event.stopPropagation();
    const next = this.isSelected(option)
      ? this.selected.filter((s) => s !== option)
      : [...this.selected, option];
    this.selectedChange.emit(next);
  }

  toggleAll(event: MouseEvent): void {
    event.stopPropagation();
    const next = this.selected.length === this.options.length ? [] : [...this.options];
    this.selectedChange.emit(next);
  }

  get allSelected(): boolean {
    return this.options.length > 0 && this.selected.length === this.options.length;
  }

  get someSelected(): boolean {
    return this.selected.length > 0 && this.selected.length < this.options.length;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }
}
