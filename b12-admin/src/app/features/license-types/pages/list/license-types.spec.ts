import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicenseTypes } from './license-types';

describe('LicenseTypes', () => {
  let component: LicenseTypes;
  let fixture: ComponentFixture<LicenseTypes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LicenseTypes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LicenseTypes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
