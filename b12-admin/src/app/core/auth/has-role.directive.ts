import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Directive({
  selector: '[hasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private tpl = inject(TemplateRef<any>);
  private vcr = inject(ViewContainerRef);
  private auth = inject(AuthService);

  @Input('hasRole') set roles(value: Array<'ADMIN' | 'USER' | 'VISITOR'>) {
    this.vcr.clear();
    if (this.auth.hasAnyRole(...(value ?? []))) {
      this.vcr.createEmbeddedView(this.tpl);
    }
  }
}
