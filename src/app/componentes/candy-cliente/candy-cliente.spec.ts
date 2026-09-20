import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandyCliente } from './candy-cliente';

describe('CandyCliente', () => {
  let component: CandyCliente;
  let fixture: ComponentFixture<CandyCliente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandyCliente],
    }).compileComponents();

    fixture = TestBed.createComponent(CandyCliente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
