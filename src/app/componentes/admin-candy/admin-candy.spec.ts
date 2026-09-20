import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminCandy } from './admin-candy';

describe('AdminCandy', () => {
  let component: AdminCandy;
  let fixture: ComponentFixture<AdminCandy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCandy],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCandy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
